import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/api/client';
import { ClientMigrationService } from '@/utils/clientMigration';
import type { KanbanListData } from '@/db/types';
import { useCardActions } from './useCardActions';

const DEFAULT_BOARD_ID = 'default';

export const useDatabaseBoardState = (initialLists: KanbanListData[]) => {
  const [lists, setLists] = useState<KanbanListData[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    logCardCreated,
    logCardMoved,
    logCardEdited,
    logCardDeleted,
    logMemberAdded,
    logMemberRemoved,
    logCommentAdded,
    logDueDateChanged
  } = useCardActions();

  // Helper function to load actions for all cards
  const loadCardActions = useCallback(async (lists: KanbanListData[]): Promise<KanbanListData[]> => {
    try {
      const listsWithActions = await Promise.all(
        lists.map(async (list) => {
          const cardsWithActions = await Promise.all(
            list.cards.map(async (card) => {
              try {
                const actions = await apiClient.getCardActions(card.id);
                // Use API actions if available, otherwise keep existing local actions
                const finalActions = (actions && actions.length > 0) ? actions : (card.actions || []);

                // Comment system removed

                return {
                  ...card,
                  actions: finalActions
                };
              } catch (error) {
                console.warn(`Failed to load actions for card ${card.id}:`, error);
                // Keep existing local actions
                return {
                  ...card,
                  actions: card.actions || []
                };
              }
            })
          );
          return {
            ...list,
            cards: cardsWithActions
          };
        })
      );
      return listsWithActions;
    } catch (error) {
      console.warn('Failed to load card actions:', error);
      return lists;
    }
  }, [logCardCreated]);

  // Initialize database and handle migration
  useEffect(() => {
    const initializeData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check if client-side migration is needed
        if (ClientMigrationService.hasLocalStorageData()) {
          try {
            if (process.env.NODE_ENV === 'development') {
            }
            const migrationSuccess = await ClientMigrationService.migrateToDatabase();
            if (migrationSuccess) {
              ClientMigrationService.cleanupLocalStorage();
              if (process.env.NODE_ENV === 'development') {
              }
            }
          } catch (migrationError) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('Client migration failed:', migrationError);
            }
          }
        }

        // Load data from database
        try {
          const boardLists = await apiClient.getListsByBoard(DEFAULT_BOARD_ID);

          if (boardLists && boardLists.length > 0) {
            // Load actions for all cards
            const listsWithActions = await loadCardActions(boardLists);
            setLists(listsWithActions);
          } else if (initialLists.length > 0) {
            // Create initial data if no data exists
            await apiClient.saveKanbanData(DEFAULT_BOARD_ID, initialLists);
            const listsWithActions = await loadCardActions(initialLists);
            setLists(listsWithActions);
          }
        } catch (apiError) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('API not available, falling back to localStorage:', apiError);
          }
          // Fallback to localStorage if API is not available
          const stored = localStorage.getItem('trello_board_state');
          if (stored) {
            const parsed = JSON.parse(stored);
            const listsWithActions = await loadCardActions(parsed);
            setLists(listsWithActions);
          } else {
            const listsWithActions = await loadCardActions(initialLists);
            setLists(listsWithActions);
          }
        }

        setLastUpdate(Date.now());
      } catch (err) {
        console.error('Error initializing database:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, [initialLists]);

  const updateLists = useCallback(async (newLists: KanbanListData[]) => {
    try {
      // Update database via API
      await apiClient.saveKanbanData(DEFAULT_BOARD_ID, newLists);

      // Update local state
      setLists(newLists);
      setLastUpdate(Date.now());

      // Dispatch custom event for cross-tab synchronization
      window.dispatchEvent(new CustomEvent('board-updated', {
        detail: { lists: newLists, timestamp: Date.now() }
      }));
    } catch (err) {
      console.warn('API update failed, falling back to localStorage:', err);
      // Fallback to localStorage
      localStorage.setItem('trello_board_state', JSON.stringify(newLists));
      setLists(newLists);
      setLastUpdate(Date.now());
    }
  }, []);

  const updateCardPosition = useCallback(async (cardId: string, newListId: string, newPosition: number) => {

    try {
      // Find old list for logging
      const oldList = lists.find(list => list.cards.some(card => card.id === cardId));
      const newList = lists.find(list => list.id === newListId);

      await apiClient.updateCard(cardId, { list_id: newListId, position: newPosition });

      // Log the card move action if lists changed
      if (oldList && newList && oldList.id !== newListId) {
        const moveAction = logCardMoved(cardId, oldList.title, newList.title);

        // Save the action to the database
        if (moveAction) {
          try {
            await apiClient.createCardAction(moveAction);
          } catch (actionError) {
            console.warn('Failed to save move action to database:', actionError);
          }
        }

        // Update card with new action
        const updatedLists = lists.map(list => {
          if (list.id === newListId) {
            return {
              ...list,
              cards: list.cards.map(card => {
                if (card.id === cardId) {
                  return {
                    ...card,
                    actions: [...(card.actions || []), ...(moveAction ? [moveAction] : [])]
                  };
                }
                return card;
              })
            };
          }
          return list;
        });
        setLists(updatedLists);
      }

      // Reload lists from database
      const finalLists = await apiClient.getListsByBoard(DEFAULT_BOARD_ID);
      const finalListsWithActions = await loadCardActions(finalLists);
      setLists(finalListsWithActions);
      setLastUpdate(Date.now());
    } catch (err) {
      console.error('Error updating card position:', err);

      // Fallback: update locally and persist to localStorage
      if (oldList && newList && oldList.id !== newListId) {
        const moveAction = logCardMoved(cardId, oldList.title, newList.title);

        // Try to save the action to the database even in fallback mode
        if (moveAction) {
          try {
            await apiClient.createCardAction(moveAction);
          } catch (actionError) {
            console.warn('Failed to save fallback move action to database:', actionError);
          }
        }

        const updatedLists = lists.map(list => {
          if (list.id === oldList.id) {
            return {
              ...list,
              cards: list.cards.filter(card => card.id !== cardId)
            };
          }
          if (list.id === newListId) {
            const cardToMove = oldList.cards.find(c => c.id === cardId);
            if (cardToMove) {
              const cardWithAction = {
                ...cardToMove,
                actions: [...(cardToMove.actions || []), ...(moveAction ? [moveAction] : [])]
              };
              const newCards = [...list.cards];
              newCards.splice(newPosition, 0, cardWithAction);
              return { ...list, cards: newCards };
            }
          }
          return list;
        });

        setLists(updatedLists);
        localStorage.setItem('trello_board_state', JSON.stringify(updatedLists));
        setLastUpdate(Date.now());
      }

      setError(err instanceof Error ? err.message : 'Failed to update card position');
    }
  }, [lists, logCardMoved]);

  const updateListPosition = useCallback(async (listId: string, newPosition: number) => {
    try {
      await apiClient.updateList(listId, { position: newPosition });

      // Reload lists from database
      const updatedLists = await apiClient.getListsByBoard(DEFAULT_BOARD_ID);
      const updatedListsWithActions = await loadCardActions(updatedLists);
      setLists(updatedListsWithActions);
      setLastUpdate(Date.now());
    } catch (err) {
      console.error('Error updating list position:', err);
      setError(err instanceof Error ? err.message : 'Failed to update list position');
    }
  }, []);

  const addCard = useCallback(async (listId: string, cardData: Omit<KanbanListData['cards'][0], 'id'>) => {
    try {
      const cardId = `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const list = lists.find(l => l.id === listId);
      const position = list ? list.cards.length : 0;

      await apiClient.createCard({
        id: cardId,
        list_id: listId,
        title: cardData.title,
        description: cardData.description,
        position,
        due_date: cardData.dueDate ? Math.floor(cardData.dueDate.getTime() / 1000) : undefined,
        labels: cardData.labels,
        attachments: cardData.attachments,
        members: cardData.members
      });

      // Log card creation action
      const createAction = logCardCreated(cardId);
      if (!createAction) {
        console.warn('Cannot create card action: no authenticated user');
        return;
      }

      // Save the action to the database
      try {
        await apiClient.createCardAction(createAction);
      } catch (actionError) {
        console.warn('Failed to save action to database:', actionError);
      }

      // Add action to newly created card
      const newCard = {
        ...cardData,
        id: cardId,
        actions: createAction ? [createAction] : []
      };

      // Update local state first
      const updatedLists = lists.map(list => {
        if (list.id === listId) {
          return {
            ...list,
            cards: [...list.cards, newCard]
          };
        }
        return list;
      });
      setLists(updatedLists);

      // Reload lists from database
      const finalLists = await apiClient.getListsByBoard(DEFAULT_BOARD_ID);
      const finalListsWithActions = await loadCardActions(finalLists);
      setLists(finalListsWithActions);
      setLastUpdate(Date.now());

      return cardId;
    } catch (err) {
      console.error('Error adding card:', err);
      setError(err instanceof Error ? err.message : 'Failed to add card');
      return null;
    }
  }, [lists, logCardCreated]);

  const updateCard = useCallback(async (cardId: string, updates: Partial<KanbanListData['cards'][0]>) => {
    try {
      // Find current card to track changes
      const currentCard = lists.flatMap(list => list.cards).find(card => card.id === cardId);
      const actions: any[] = [];

      if (currentCard) {
        // Track title changes
        if (updates.title && updates.title !== currentCard.title) {
          actions.push(logCardEdited(cardId, 'title', currentCard.title, updates.title));
        }

        // Track description changes
        if (updates.description !== undefined && updates.description !== currentCard.description) {
          actions.push(logCardEdited(cardId, 'description', currentCard.description, updates.description));
        }

        // Track due date changes
        if (updates.dueDate !== currentCard.dueDate) {
          const oldDate = currentCard.dueDate ? currentCard.dueDate.toISOString() : undefined;
          const newDate = updates.dueDate ? updates.dueDate.toISOString() : undefined;
          actions.push(logDueDateChanged(cardId, newDate, oldDate));
        }

        // Track member changes
        if (updates.members && JSON.stringify(updates.members) !== JSON.stringify(currentCard.members)) {
          const oldMembers = currentCard.members || [];
          const newMembers = updates.members || [];

          // Find added members
          newMembers.forEach(member => {
            if (!oldMembers.find(m => m.id === member.id)) {
              actions.push(logMemberAdded(cardId, member.username));
            }
          });

          // Find removed members
          oldMembers.forEach(member => {
            if (!newMembers.find(m => m.id === member.id)) {
              actions.push(logMemberRemoved(cardId, member.username));
            }
          });
        }
      }

      await apiClient.updateCard(cardId, {
        title: updates.title,
        description: updates.description,
        due_date: updates.dueDate ? Math.floor(updates.dueDate.getTime() / 1000) : undefined,
        labels: updates.labels,
        attachments: updates.attachments,
        members: updates.members
      });

      // Add actions to card
      if (actions.length > 0) {
        const updatedLists = lists.map(list => ({
          ...list,
          cards: list.cards.map(card => {
            if (card.id === cardId) {
              return {
                ...card,
                ...updates,
                actions: [...(card.actions || []), ...actions]
              };
            }
            return card;
          })
        }));
        setLists(updatedLists);
      }

      // Reload lists from database
      const finalLists = await apiClient.getListsByBoard(DEFAULT_BOARD_ID);
      const finalListsWithActions = await loadCardActions(finalLists);
      setLists(finalListsWithActions);
      setLastUpdate(Date.now());
    } catch (err) {
      console.error('Error updating card:', err);
      setError(err instanceof Error ? err.message : 'Failed to update card');
    }
  }, [lists, logCardEdited, logDueDateChanged, logMemberAdded, logMemberRemoved]);

  const deleteCard = useCallback(async (cardId: string) => {
    try {
      // Log deletion action before removing card
      const deleteAction = logCardDeleted(cardId);

      // Add action to card before deletion (for history preservation)
      const updatedLists = lists.map(list => ({
        ...list,
        cards: list.cards.map(card => {
          if (card.id === cardId) {
            return {
              ...card,
              actions: [...(card.actions || []), deleteAction]
            };
          }
          return card;
        })
      }));
      setLists(updatedLists);

      await apiClient.deleteCard(cardId);

      // Reload lists from database
      const finalLists = await apiClient.getListsByBoard(DEFAULT_BOARD_ID);
      const finalListsWithActions = await loadCardActions(finalLists);
      setLists(finalListsWithActions);
      setLastUpdate(Date.now());
    } catch (err) {
      console.error('Error deleting card:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete card');
    }
  }, [lists, logCardDeleted]);

  // Listen for cross-tab updates
  useEffect(() => {
    const handleBoardUpdate = (event: CustomEvent) => {
      const { lists: updatedLists, timestamp } = event.detail;
      if (timestamp > lastUpdate) {
        setLists(updatedLists);
        setLastUpdate(timestamp);
      }
    };

    window.addEventListener('board-updated', handleBoardUpdate as EventListener);
    return () => window.removeEventListener('board-updated', handleBoardUpdate as EventListener);
  }, [lastUpdate]);

  // Periodic sync to catch any missed updates
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const latestLists = await apiClient.getListsByBoard(DEFAULT_BOARD_ID);
        const latestListsWithActions = await loadCardActions(latestLists);
        // Simple check to see if data has changed
        if (JSON.stringify(latestListsWithActions) !== JSON.stringify(lists)) {
          setLists(latestListsWithActions);
          setLastUpdate(Date.now());
        }
      } catch (err) {
        // Silently fail for periodic sync
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [lists]);

  return {
    lists,
    updateLists,
    updateCardPosition,
    updateListPosition,
    addCard,
    updateCard,
    deleteCard,
    lastUpdate,
    isLoading,
    error
  };
};