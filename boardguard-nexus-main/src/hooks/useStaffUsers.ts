import { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';

export interface StaffUser {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  role: 'mod' | 'admin';
  discordId: string;
  lastSeen: number;
  isOnline?: boolean;
  discordStatus?: 'online' | 'idle' | 'dnd' | 'offline';
}

const STAFF_USERS_KEY = 'staff_users_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export function useStaffUsers() {
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load staff users from localStorage cache
  const loadFromCache = (): StaffUser[] => {
    try {
      const cached = localStorage.getItem(STAFF_USERS_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Check if cache is still valid (5 minutes)
        if (Date.now() - timestamp < CACHE_DURATION) {
          return data;
        }
      }
    } catch (error) {
      console.warn('Error loading staff users cache:', error);
    }
    return [];
  };

  // Save staff users to localStorage cache
  const saveToCache = (users: StaffUser[]) => {
    try {
      const cacheData = {
        data: users,
        timestamp: Date.now()
      };
      localStorage.setItem(STAFF_USERS_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Error saving staff users cache:', error);
    }
  };

  // Add a new staff user (when someone logs in)
  const addStaffUser = (user: StaffUser) => {
    setStaffUsers(prev => {
      // Remove existing user with same ID if exists
      const filtered = prev.filter(u => u.id !== user.id && u.discordId !== user.discordId);
      const updated = [...filtered, { ...user, lastSeen: Date.now() }];
      saveToCache(updated);
      return updated;
    });
  };

  // Update user's last seen time
  const updateUserActivity = (discordId: string) => {
    setStaffUsers(prev => {
      const updated = prev.map(user =>
        user.discordId === discordId
          ? { ...user, lastSeen: Date.now(), isOnline: true }
          : user
      );
      saveToCache(updated);
      return updated;
    });
  };

  // Mark users as offline if they haven't been seen recently
  const updateOnlineStatus = () => {
    const now = Date.now();
    const ONLINE_THRESHOLD = 10 * 60 * 1000; // 10 minutes

    setStaffUsers(prev => {
      const updated = prev.map(user => ({
        ...user,
        isOnline: (now - user.lastSeen) < ONLINE_THRESHOLD
      }));

      // Only save if there are changes
      const hasChanges = updated.some((user, index) =>
        user.isOnline !== prev[index]?.isOnline
      );

      if (hasChanges) {
        saveToCache(updated);
      }

      return updated;
    });
  };

  // Initialize and load staff users
  useEffect(() => {
    const initializeStaffUsers = async () => {
      // Load from localStorage cache immediately to prevent delay
      const cachedUsers = loadFromCache();
      if (cachedUsers.length > 0) {
        setStaffUsers(cachedUsers);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }

      setError(null);

      try {
        // Try to fetch from CachedStaff first (pre-computed by bot)
        const cachedStaff = await apiClient.getCachedStaffMembers();
        setStaffUsers(cachedStaff);
        saveToCache(cachedStaff);
      } catch (cachedError) {
        console.warn('CachedStaff not available, falling back to Discord API:', cachedError);

        try {
          // Fallback to live Discord API
          const discordStaff = await apiClient.getDiscordStaffMembers();
          setStaffUsers(discordStaff);
          saveToCache(discordStaff);
        } catch (discordError) {
          console.warn('Discord API also failed:', discordError);

          // If we don't have cached users and both APIs fail
          if (cachedUsers.length === 0) {
            setError('Unable to load staff members. They will appear as they log in.');
          }
        }
      }

      setIsLoading(false);
    };

    initializeStaffUsers();

    // Update online status every minute
    const statusInterval = setInterval(updateOnlineStatus, 60000);

    return () => clearInterval(statusInterval);
  }, []);

  // Get only available staff users (mod/admin excluding current user)
  const getAvailableStaffUsers = (currentUserId?: string) => {
    return staffUsers.filter(user =>
      user.id !== currentUserId &&
      user.discordId !== currentUserId &&
      (user.role === 'mod' || user.role === 'admin')
    );
  };

  return {
    staffUsers,
    isLoading,
    error,
    addStaffUser,
    updateUserActivity,
    getAvailableStaffUsers,
    refetch: async () => {
      // Clear cache and reload from CachedStaff
      localStorage.removeItem(STAFF_USERS_KEY);
      setStaffUsers([]);
      setIsLoading(true);
      setError(null);

      try {
        // Try to refresh from CachedStaff first
        const cachedStaff = await apiClient.getCachedStaffMembers();
        setStaffUsers(cachedStaff);
        saveToCache(cachedStaff);
      } catch (cachedError) {
        console.warn('CachedStaff refresh failed, using Discord API:', cachedError);

        try {
          const discordStaff = await apiClient.getDiscordStaffMembers();
          setStaffUsers(discordStaff);
          saveToCache(discordStaff);
        } catch (discordError) {
          console.error('Error refetching staff users:', discordError);
          setError('Unable to refresh staff members');
        }
      }

      setIsLoading(false);
    },

    // Force refresh cached staff (trigger bot update)
    forceRefreshCache: async () => {
      try {
        await apiClient.refreshCachedStaff();

        // Wait a moment then reload
        setTimeout(async () => {
          const cachedStaff = await apiClient.getCachedStaffMembers();
          setStaffUsers(cachedStaff);
          saveToCache(cachedStaff);
        }, 2000);
      } catch (error) {
        console.error('Error forcing cache refresh:', error);
      }
    }
  };
}