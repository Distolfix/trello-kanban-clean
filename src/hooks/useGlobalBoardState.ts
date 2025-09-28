import { useState, useEffect, useCallback } from 'react';
import type { KanbanListData } from '@/components/KanbanList';

const STORAGE_KEY = 'trello_board_state';
const LAST_UPDATE_KEY = 'trello_board_last_update';

// Simula un backend - in produzione questo sarebbe sostituito da chiamate API
const loadBoardFromStorage = (): KanbanListData[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Converte le date string di nuovo in oggetti Date
      return parsed.map((list: any) => ({
        ...list,
        cards: list.cards.map((card: any) => ({
          ...card,
          dueDate: card.dueDate ? new Date(card.dueDate) : undefined,
        })),
      }));
    }
  } catch (error) {
    console.error('Error loading board from storage:', error);
  }
  return [];
};

const saveBoardToStorage = (lists: KanbanListData[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
    localStorage.setItem(LAST_UPDATE_KEY, Date.now().toString());

    // Trigger storage event for other tabs
    window.dispatchEvent(new StorageEvent('storage', {
      key: STORAGE_KEY,
      newValue: JSON.stringify(lists),
    }));
  } catch (error) {
    console.error('Error saving board to storage:', error);
  }
};

export const useGlobalBoardState = (initialLists: KanbanListData[]) => {
  const [lists, setLists] = useState<KanbanListData[]>(() => {
    const stored = loadBoardFromStorage();
    return stored.length > 0 ? stored : initialLists;
  });

  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  const updateLists = useCallback((newLists: KanbanListData[]) => {
    setLists(newLists);
    saveBoardToStorage(newLists);
    setLastUpdate(Date.now());
  }, []);

  // Listen for storage events (changes from other tabs)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const newLists = JSON.parse(e.newValue);
          // Converte le date string di nuovo in oggetti Date
          const processedLists = newLists.map((list: any) => ({
            ...list,
            cards: list.cards.map((card: any) => ({
              ...card,
              dueDate: card.dueDate ? new Date(card.dueDate) : undefined,
            })),
          }));
          setLists(processedLists);
          setLastUpdate(Date.now());
        } catch (error) {
          console.error('Error parsing stored board data:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Polling per simulare aggiornamenti dal server (in produzione sostituire con WebSocket)
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const storedLastUpdate = localStorage.getItem(LAST_UPDATE_KEY);
        if (storedLastUpdate && parseInt(storedLastUpdate) > lastUpdate) {
          const stored = loadBoardFromStorage();
          if (stored.length > 0) {
            setLists(stored);
            setLastUpdate(parseInt(storedLastUpdate));
          }
        }
      } catch (error) {
        console.error('Error during polling update:', error);
      }
    }, 2000); // Controlla ogni 2 secondi

    return () => clearInterval(interval);
  }, [lastUpdate]);

  // Salva lo stato iniziale se non esiste
  useEffect(() => {
    const stored = loadBoardFromStorage();
    if (stored.length === 0 && initialLists.length > 0) {
      saveBoardToStorage(initialLists);
    }
  }, [initialLists]);

  return {
    lists,
    updateLists,
    lastUpdate,
  };
};