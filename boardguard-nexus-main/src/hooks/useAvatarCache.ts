import { useState, useEffect, useCallback } from 'react';
import { useStaffUsers } from './useStaffUsers';

const AVATAR_CACHE_KEY = 'avatar_cache';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

interface AvatarCacheEntry {
  username: string;
  userId?: string;
  displayName: string;
  avatarUrl: string | null;
  timestamp: number;
}

interface AvatarCache {
  [key: string]: AvatarCacheEntry;
}

class AvatarCacheManager {
  private cache: AvatarCache = {};

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(AVATAR_CACHE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const now = Date.now();

        // Clean expired entries
        Object.keys(data).forEach(key => {
          if (now - data[key].timestamp < CACHE_DURATION) {
            this.cache[key] = data[key];
          }
        });

        this.saveToStorage();
      }
    } catch (error) {
      console.warn('Failed to load avatar cache:', error);
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify(this.cache));
    } catch (error) {
      console.warn('Failed to save avatar cache:', error);
    }
  }

  private generateKey(username: string, userId?: string): string {
    return userId ? `${username}_${userId}` : username;
  }

  cacheAvatar(username: string, displayName: string, avatarUrl: string | null, userId?: string) {
    const key = this.generateKey(username, userId);
    this.cache[key] = {
      username,
      userId,
      displayName,
      avatarUrl,
      timestamp: Date.now()
    };
    this.saveToStorage();
  }

  getAvatar(username: string, userId?: string): AvatarCacheEntry | null {
    const key = this.generateKey(username, userId);
    return this.cache[key] || null;
  }

  preloadUserAvatar(username: string, userId: string | undefined, staffUsers: any[], discordUser: any, currentUser: any): AvatarCacheEntry {

    const cached = this.getAvatar(username, userId);
    if (cached) {
      return cached;
    }

    let displayName = username;
    let avatarUrl: string | null = null;

    // Check JWT token first
    if (currentUser && userId === currentUser.userId) {
      displayName = currentUser.username || displayName;
      if (discordUser && discordUser.avatar) {
        avatarUrl = `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`;
      }
    }

    // Check Discord user
    if (!avatarUrl && discordUser) {
      if (userId === discordUser.id || userId === `discord_${discordUser.id}`) {
        displayName = discordUser.username || discordUser.global_name || discordUser.display_name || displayName;
        if (discordUser.avatar) {
          avatarUrl = `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`;
        }
      }
    }

    // Check staff users
    if (!avatarUrl && staffUsers.length > 0) {
      const staffUser = staffUsers.find(su =>
        su.username === username ||
        su.displayName === username ||
        su.id === userId ||
        su.discordId === userId ||
        (typeof userId === 'string' && su.discordId === userId.replace('discord_', ''))
      );

      if (staffUser) {
        displayName = staffUser.displayName || staffUser.username || displayName;
        if (staffUser.avatar && staffUser.discordId) {
          avatarUrl = `https://cdn.discordapp.com/avatars/${staffUser.discordId}/${staffUser.avatar}.png`;
        }
      }
    }

    const result = {
      username,
      userId,
      displayName,
      avatarUrl,
      timestamp: Date.now()
    };

    this.cacheAvatar(username, displayName, avatarUrl, userId);

    return result;
  }
}

const avatarCacheManager = new AvatarCacheManager();

export function useAvatarCache() {
  const { staffUsers } = useStaffUsers();
  const [, forceUpdate] = useState({});

  // Get current user from JWT
  const getCurrentUser = useCallback(() => {
    const authToken = localStorage.getItem('auth_token');
    if (authToken) {
      try {
        return JSON.parse(atob(authToken.split('.')[1]));
      } catch {
        return null;
      }
    }
    return null;
  }, []);

  // Get Discord user
  const getDiscordUser = useCallback(() => {
    const storedUser = localStorage.getItem('discord_user');
    if (storedUser) {
      try {
        return JSON.parse(storedUser);
      } catch {
        return null;
      }
    }
    return null;
  }, []);

  const preloadAvatar = useCallback((username: string, userId?: string) => {
    const currentUser = getCurrentUser();
    const discordUser = getDiscordUser();

    return avatarCacheManager.preloadUserAvatar(
      username,
      userId,
      staffUsers,
      discordUser,
      currentUser
    );
  }, [staffUsers]);

  const getAvatar = useCallback((username: string, userId?: string) => {
    return avatarCacheManager.getAvatar(username, userId);
  }, []);

  // Force re-render when staff users change
  useEffect(() => {
    forceUpdate({});
  }, [staffUsers]);

  return {
    preloadAvatar,
    getAvatar
  };
}