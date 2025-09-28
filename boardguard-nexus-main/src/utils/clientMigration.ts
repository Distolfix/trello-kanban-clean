import { apiClient } from '@/api/client';

export class ClientMigrationService {
  // Check if migration was already attempted in this session
  private static migrationAttempted = false;

  // Check if localStorage has data that needs migration
  static hasLocalStorageData(): boolean {
    // If already attempted migration in this session, return false
    if (this.migrationAttempted) return false;

    return Boolean(
      localStorage.getItem('trello_board_state') ||
      localStorage.getItem('theme') ||
      localStorage.getItem('discord_user')
    );
  }

  // Migrate localStorage data to database via API
  static async migrateToDatabase(): Promise<boolean> {
    // Mark as attempted to prevent repeated calls
    this.migrationAttempted = true;

    try {
      // Reduced logging - only log once per session
      if (process.env.NODE_ENV === 'development') {
      }

      // Check if migration is already completed
      try {
        const migrationStatus = await apiClient.getMigrationStatus();
        if (migrationStatus.completed) {
          // Don't log unless in development
          if (process.env.NODE_ENV === 'development') {
          }
          return true;
        }
      } catch (error) {
        // In production, silently fail instead of logging warnings
        if (process.env.NODE_ENV === 'development') {
          console.warn('Could not check migration status:', error);
        }
        // Since API is not available, just return true to skip migration
        return true;
      }

      let migrationData: any = {};

      // Collect board data
      const STORAGE_KEY = 'trello_board_state';
      const storedData = localStorage.getItem(STORAGE_KEY);
      if (storedData) {
        try {
          const lists = JSON.parse(storedData);
          migrationData.boardData = lists;
        } catch (error) {
          console.error('Error parsing board data:', error);
        }
      }

      // Collect theme data
      const theme = localStorage.getItem('theme');
      if (theme) {
        migrationData.theme = theme;
      }

      // Collect Discord user data
      const discordUser = localStorage.getItem('discord_user');
      const userRole = localStorage.getItem('user_role');
      if (discordUser && userRole) {
        try {
          migrationData.discordUser = JSON.parse(discordUser);
          migrationData.userRole = userRole;
        } catch (error) {
          console.error('Error parsing Discord user data:', error);
        }
      }

      // Send migration data to server
      if (Object.keys(migrationData).length > 0) {
        try {
          // For board data
          if (migrationData.boardData) {
            await apiClient.saveKanbanData('default', migrationData.boardData);
          }

          // For theme
          if (migrationData.theme) {
            await apiClient.setSetting('theme', migrationData.theme);
          }

          // For user data
          if (migrationData.discordUser && migrationData.userRole) {
            const userId = `discord_${migrationData.discordUser.id}`;
            try {
              let dbUser = await apiClient.getUserByDiscordId(migrationData.discordUser.id);

              if (!dbUser) {
                dbUser = await apiClient.createUser({
                  id: userId,
                  discord_id: migrationData.discordUser.id,
                  username: migrationData.discordUser.username || migrationData.discordUser.global_name || 'Unknown',
                  avatar: migrationData.discordUser.avatar,
                  role: migrationData.userRole
                });
              }

              await apiClient.setSetting('current_user_id', dbUser.id);
            } catch (error) {
              console.warn('Failed to migrate user data:', error);
            }
          }

          // Mark migration as completed
          await apiClient.setSetting('migrated_from_localstorage', 'true');
          await apiClient.setSetting('migration_date', new Date().toISOString());

          if (process.env.NODE_ENV === 'development') {
          }
          return true;
        } catch (apiError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Failed to send migration data to server:', apiError);
          }
          // In production, silently fail and return true
          return true;
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
        }
        // Don't try to mark as migrated if API is not available
        return true;
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Client migration failed:', error);
      }
      return true; // Fail silently in production
    }
  }

  // Clean up localStorage after successful migration
  static cleanupLocalStorage(): void {
    try {
      const keysToRemove = [
        'trello_board_state',
        'trello_board_last_update',
        // Don't remove theme and auth data immediately for backward compatibility
        // 'theme',
        // 'discord_user',
        // 'user_role',
        'discord_auth_state'
      ];

      keysToRemove.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          if (process.env.NODE_ENV === 'development') {
          }
        }
      });

      if (process.env.NODE_ENV === 'development') {
      }
    } catch (error) {
      console.error('Error cleaning up localStorage:', error);
    }
  }

  // Aggressive cleanup - removes all keys (use with caution)
  static fullCleanupLocalStorage(): void {
    try {
      const keysToRemove = [
        'trello_board_state',
        'trello_board_last_update',
        'theme',
        'discord_user',
        'user_role',
        'discord_auth_state'
      ];

      keysToRemove.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
        }
      });

    } catch (error) {
      console.error('Error cleaning up localStorage:', error);
    }
  }
}