import { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';

interface DiscordUser {
  id: string;
  username: string;
  global_name?: string;
  avatar?: string;
}

interface AuthState {
  user: DiscordUser | null;
  role: 'default' | 'mod' | 'admin';
  isLoading: boolean;
}

export function useDatabaseDiscordAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    role: 'default',
    isLoading: true
  });

  // Initialize auth state from database
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Try to get current user from database
        const userSetting = await apiClient.getSetting('current_user_id');
        if (userSetting && userSetting.value) {
          const dbUser = await apiClient.getUser(userSetting.value);
          if (dbUser) {
            setAuthState({
              user: {
                id: dbUser.discord_id || dbUser.id,
                username: dbUser.username,
                avatar: dbUser.avatar
              },
              role: dbUser.role,
              isLoading: false
            });
            return;
          }
        }
      } catch (error) {
        console.warn('Database auth check failed, trying localStorage:', error);
      }

      // Fallback to localStorage
      try {
        const savedUser = localStorage.getItem('discord_user');
        const savedRole = localStorage.getItem('user_role');

        if (savedUser && savedRole) {
          const userData = JSON.parse(savedUser);
          setAuthState({
            user: userData,
            role: savedRole as 'default' | 'mod' | 'admin',
            isLoading: false
          });

          // Try to migrate to database
          try {
            const userId = `discord_${userData.id}`;
            let dbUser = await apiClient.getUserByDiscordId(userData.id);

            if (!dbUser) {
              dbUser = await apiClient.createUser({
                id: userId,
                discord_id: userData.id,
                username: userData.username || userData.global_name || 'Unknown',
                avatar: userData.avatar,
                role: savedRole as 'default' | 'mod' | 'admin'
              });
            }

            // Set as current user
            await apiClient.setSetting('current_user_id', dbUser.id);
          } catch (migrationError) {
            console.warn('Auth migration failed:', migrationError);
          }
        } else {
          setAuthState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    };

    initializeAuth();
  }, []);

  const login = async (code: string, state: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // This would typically make a request to your backend
      // For now, simulating the Discord auth process
      const mockDiscordResponse = {
        user: {
          id: `user_${Date.now()}`,
          username: 'TestUser',
          avatar: null
        },
        role: 'default' as const
      };

      const { user, role } = mockDiscordResponse;

      // Save user to database
      const userId = `discord_${user.id}`;
      let dbUser = await apiClient.getUserByDiscordId(user.id);

      if (!dbUser) {
        dbUser = await apiClient.createUser({
          id: userId,
          discord_id: user.id,
          username: user.username,
          avatar: user.avatar || undefined,
          role
        });
      } else {
        // Update existing user
        dbUser = await apiClient.updateUser(dbUser.id, {
          username: user.username,
          avatar: user.avatar || undefined,
          role
        });
      }

      // Set as current user
      await apiClient.setSetting('current_user_id', dbUser.id);

      // Update auth state
      setAuthState({
        user: {
          id: user.id,
          username: user.username,
          avatar: user.avatar || undefined
        },
        role: dbUser.role,
        isLoading: false
      });

      // Keep localStorage for backward compatibility
      localStorage.setItem('discord_user', JSON.stringify(user));
      localStorage.setItem('user_role', dbUser.role);

      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      };
    }
  };

  const logout = async () => {
    try {
      // Remove current user setting
      await apiClient.setSetting('current_user_id', '');
    } catch (error) {
      console.warn('Database logout failed:', error);
    }

    // Clear localStorage
    localStorage.removeItem('discord_user');
    localStorage.removeItem('user_role');
    localStorage.removeItem('discord_auth_state');

    // Reset auth state
    setAuthState({
      user: null,
      role: 'default',
      isLoading: false
    });
  };

  const updateUserRole = async (newRole: 'default' | 'mod' | 'admin') => {
    try {
      const userSetting = await apiClient.getSetting('current_user_id');
      if (userSetting && userSetting.value && authState.user) {
        const dbUser = await apiClient.updateUser(userSetting.value, { role: newRole });
        if (dbUser) {
          setAuthState(prev => ({ ...prev, role: newRole }));
          localStorage.setItem('user_role', newRole);
        }
      }
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  };

  return {
    user: authState.user,
    role: authState.role,
    isLoading: authState.isLoading,
    login,
    logout,
    updateUserRole
  };
}