import { useState, useEffect, useCallback } from 'react';
import type { CardAction } from '@/components/KanbanCard';

const LOCAL_ACTIONS_KEY = 'card_actions_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface CachedAction {
  action: CardAction;
  timestamp: number;
}

interface ActionsCache {
  [cardId: string]: CachedAction[];
}

class LocalActionStorage {
  private cache: ActionsCache = {};

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(LOCAL_ACTIONS_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        // Remove expired actions
        const now = Date.now();
        const cleanedCache: ActionsCache = {};

        Object.entries(data).forEach(([cardId, actions]) => {
          const validActions = (actions as CachedAction[]).filter(
            cached => (now - cached.timestamp) < CACHE_DURATION
          );
          if (validActions.length > 0) {
            cleanedCache[cardId] = validActions;
          }
        });

        this.cache = cleanedCache;
        this.saveToStorage();
      }
    } catch (error) {
      console.warn('Failed to load action cache:', error);
      this.cache = {};
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(LOCAL_ACTIONS_KEY, JSON.stringify(this.cache));
    } catch (error) {
      console.warn('Failed to save action cache:', error);
    }
  }

  addAction(cardId: string, action: CardAction) {
    if (!this.cache[cardId]) {
      this.cache[cardId] = [];
    }

    // Avoid duplicates
    const exists = this.cache[cardId].some(cached => cached.action.id === action.id);
    if (!exists) {
      this.cache[cardId].push({
        action,
        timestamp: Date.now()
      });
      this.saveToStorage();
    }
  }

  getActions(cardId: string): CardAction[] {
    const cached = this.cache[cardId] || [];
    return cached.map(c => c.action).sort((a, b) => a.timestamp - b.timestamp);
  }

  removeAction(cardId: string, actionId: string) {
    if (this.cache[cardId]) {
      this.cache[cardId] = this.cache[cardId].filter(
        cached => cached.action.id !== actionId
      );
      this.saveToStorage();
    }
  }

  clearCard(cardId: string) {
    delete this.cache[cardId];
    this.saveToStorage();
  }

  mergeWithApiActions(cardId: string, apiActions: CardAction[]): CardAction[] {
    const localActions = this.getActions(cardId);
    const allActions = [...apiActions];

    // Add local actions that are not in API response
    localActions.forEach(localAction => {
      const existsInApi = apiActions.some(apiAction => apiAction.id === localAction.id);
      if (!existsInApi) {
        allActions.push(localAction);
      }
    });

    // Sort by timestamp
    return allActions.sort((a, b) => a.timestamp - b.timestamp);
  }

  // Comment system removed
}

const actionStorage = new LocalActionStorage();

export function useLocalCardActions(cardId: string) {
  const [localActions, setLocalActions] = useState<CardAction[]>([]);

  useEffect(() => {
    setLocalActions(actionStorage.getActions(cardId));
  }, [cardId]);

  const addAction = useCallback((action: CardAction) => {
    actionStorage.addAction(cardId, action);
    setLocalActions(actionStorage.getActions(cardId));
  }, [cardId]);

  const removeAction = useCallback((actionId: string) => {
    actionStorage.removeAction(cardId, actionId);
    setLocalActions(actionStorage.getActions(cardId));
  }, [cardId]);

  const mergeWithApiActions = useCallback((apiActions: CardAction[]) => {
    return actionStorage.mergeWithApiActions(cardId, apiActions);
  }, [cardId]);

  // Comment system removed

  const clearActions = useCallback(() => {
    actionStorage.clearCard(cardId);
    setLocalActions([]);
  }, [cardId]);

  return {
    localActions,
    addAction,
    removeAction,
    mergeWithApiActions,
    clearActions
  };
}