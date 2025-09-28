import { useCallback } from 'react';
import type { CardAction } from '@/components/KanbanCard';

interface CurrentUser {
  id: string;
  username: string;
}

// Get current user - returns null if no authenticated user found
const getCurrentUser = (): CurrentUser | null => {
  // First check for JWT token
  const authToken = localStorage.getItem('auth_token');

  if (authToken) {
    try {
      // Decode JWT payload (simple base64 decode, no verification)
      const payload = JSON.parse(atob(authToken.split('.')[1]));

      if (payload.userId && payload.username) {
        return {
          id: payload.userId,
          username: payload.username
        };
      }
    } catch (error) {
      console.error('Error parsing JWT token:', error);
    }
  }

  // Check for discord_user (legacy)
  const storedUser = localStorage.getItem('discord_user');

  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);

      return {
        id: user.id || `discord_${user.id}`,
        username: user.username || user.global_name || user.display_name || 'Utente'
      };
    } catch (error) {
      console.error('Error parsing Discord user:', error);
    }
  }

  // Don't use staff users as fallback to avoid wrong attribution
  return null;
};

export const useCardActions = () => {
  const generateActionId = () => {
    const timestamp = Date.now();
    const random1 = Math.random().toString(36).substr(2, 9);
    const random2 = Math.random().toString(36).substr(2, 9);
    return `action_${timestamp}_${random1}_${random2}`;
  };

  const createAction = useCallback((
    cardId: string,
    action: CardAction['action'],
    details?: CardAction['details']
  ): CardAction | null => {
    const user = getCurrentUser();

    if (!user) {
      console.warn('Cannot create action: no authenticated user found');
      return null;
    }

    const actionObject = {
      id: generateActionId(),
      cardId,
      userId: user.id,
      username: user.username,
      action,
      details,
      timestamp: Date.now()
    };

    return actionObject;
  }, []);

  const logCardCreated = useCallback((cardId: string) => {
    return createAction(cardId, 'created');
  }, [createAction]);

  const logCardMoved = useCallback((cardId: string, fromList: string, toList: string) => {
    return createAction(cardId, 'moved', {
      from: fromList,
      to: toList
    });
  }, [createAction]);

  const logCardEdited = useCallback((cardId: string, field: string, oldValue?: string, newValue?: string) => {
    return createAction(cardId, 'edited', {
      field,
      oldValue,
      newValue
    });
  }, [createAction]);

  const logCardDeleted = useCallback((cardId: string) => {
    return createAction(cardId, 'deleted');
  }, [createAction]);

  const logCardRestored = useCallback((cardId: string) => {
    return createAction(cardId, 'restored');
  }, [createAction]);

  const logMemberAdded = useCallback((cardId: string, memberName: string) => {
    return createAction(cardId, 'member_added', {
      memberName
    });
  }, [createAction]);

  const logMemberRemoved = useCallback((cardId: string, memberName: string) => {
    return createAction(cardId, 'member_removed', {
      memberName
    });
  }, [createAction]);

  // Comment system removed

  const logDueDateChanged = useCallback((cardId: string, newDate?: string, oldDate?: string) => {
    return createAction(cardId, 'due_date_changed', {
      oldValue: oldDate,
      newValue: newDate
    });
  }, [createAction]);

  const logLabelAdded = useCallback((cardId: string, labelName: string) => {
    return createAction(cardId, 'label_added', {
      labelName
    });
  }, [createAction]);

  const logLabelRemoved = useCallback((cardId: string, labelName: string) => {
    return createAction(cardId, 'label_removed', {
      labelName
    });
  }, [createAction]);

  return {
    logCardCreated,
    logCardMoved,
    logCardEdited,
    logCardDeleted,
    logCardRestored,
    logMemberAdded,
    logMemberRemoved,
    logDueDateChanged,
    logLabelAdded,
    logLabelRemoved
  };
};