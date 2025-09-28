import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { KanbanBoard } from "@/components/KanbanBoard";
import { CardDetailModal } from "@/components/CardDetailModal";
import { LoginModal } from "@/components/LoginModal";
import { ContextMenu, useContextMenu, getCardContextMenuItems, getListContextMenuItems } from "@/components/ContextMenu";
import { ConfirmModal, PromptModal, AlertModal } from "@/components/ui/custom-modal";
import { MemberSelector } from "@/components/MemberSelector";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStaffUsers } from "@/hooks/useStaffUsers";
import { useDiscordAuth } from "@/hooks/useDiscordAuth";
import { useDatabaseBoardState } from "@/hooks/useDatabaseBoardState";
import { toast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/useNotifications";
import { useCardActions } from "@/hooks/useCardActions";
import { apiClient } from "@/api/client";
import type { KanbanListData, KanbanCardData } from "@/db/types";

interface FilterState {
  assignees: string[];
  labels: string[];
  priority: string[];
  dueDateFilter: 'all' | 'overdue' | 'thisWeek' | 'noDate';
}


// Mock data for demonstration
const mockLists: KanbanListData[] = [
  {
    id: "1",
    title: "Da Fare",
    type: "open",
    cards: [
      {
        id: "1",
        title: "Implementare autenticazione Discord",
        description: "Configurare OAuth2 per il login tramite Discord",
        labels: ["Feature", "Priorità Alta"],
        dueDate: new Date(2024, 11, 25)
      },
      {
        id: "2",
        title: "Design sistema di ruoli",
        description: "Creare interfacce per gestione permessi admin/mod/user",
        labels: ["Design"]
      }
    ]
  },
  {
    id: "2",
    title: "In Corso",
    type: "open", 
    cards: [
      {
        id: "3",
        title: "Sviluppo componenti kanban",
        description: "Creare tutti i componenti per la board kanban con drag & drop",
        labels: ["Feature", "In Corso"]
      }
    ]
  },
  {
    id: "3",
    title: "Staff Planning",
    type: "closed",
    cards: [
      {
        id: "4",
        title: "Roadmap Q1 2025",
        description: "Pianificazione features per il primo trimestre",
        labels: ["Planning"],
        dueDate: new Date(2024, 11, 31)
      }
    ]
  },
  {
    id: "4",
    title: "Admin Only",
    type: "hidden",
    cards: [
      {
        id: "5",
        title: "Configurazione server production",
        description: "Setup infrastruttura e deploy automatico",
        labels: ["Infrastructure", "Confidenziale"]
      }
    ]
  },
  {
    id: "5",
    title: "Completato",
    type: "open",
    cards: [
      {
        id: "6",
        title: "Setup progetto base",
        description: "Configurazione iniziale con React, TypeScript e Tailwind",
        labels: ["Setup"]
      }
    ]
  }
];

const Index = () => {
  // isLoggedIn ora viene da useDiscordAuth come isAuthenticated
  const [user, setUser] = useState<{
    name: string;
    role: 'default' | 'mod' | 'admin';
    displayName?: string;
    avatarUrl?: string;
  } | null>(null);
  const {
    lists,
    updateLists,
    updateCardPosition,
    updateListPosition,
    lastUpdate,
    isLoading,
    error,
    addCard,
    deleteCard
  } = useDatabaseBoardState(mockLists);
  const [lastLocalUpdate, setLastLocalUpdate] = useState<number>(0);
  const [selectedCard, setSelectedCard] = useState<KanbanCardData | null>(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [assignModalCard, setAssignModalCard] = useState<KanbanCardData | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Card creation modal state
  const [isCreateCardModalOpen, setIsCreateCardModalOpen] = useState(false);
  const [createCardListId, setCreateCardListId] = useState<string>("");
  const [newCardTitle, setNewCardTitle] = useState("");
  const [hasShownWelcome, setHasShownWelcome] = useState(false);
  const [modal, setModal] = useState<{
    type: 'confirm' | 'prompt' | 'alert' | null;
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm?: () => void;
    onPromptConfirm?: (value: string) => void;
    variant?: 'default' | 'destructive' | 'warning' | 'success';
    initialValue?: string;
  }>({ type: null, isOpen: false, title: '', description: '' });
  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu();
  const { user: discordUser, isAuthenticated, logout: discordLogout, isLoading: authLoading } = useDiscordAuth();
  const { addStaffUser, updateUserActivity } = useStaffUsers();
  const { addNotification } = useNotifications();
  const { logCardEdited } = useCardActions();

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filters, setFilters] = useState<FilterState>({
    assignees: [],
    labels: [],
    priority: [],
    dueDateFilter: 'all'
  });

  // Board settings state with localStorage persistence
  const [boardTitle, setBoardTitle] = useState<string>(() => {
    const savedTitle = localStorage.getItem('kanban-board-title');
    return savedTitle || "La Mia Board";
  });


  const handleLoginClick = () => {
    setIsLoginModalOpen(true);
  };

  const handleLogin = (userData: { name: string; role: 'default' | 'mod' | 'admin' }) => {
    setUser(userData);

    // Add to staff users cache if user is mod or admin
    if (userData.role === 'mod' || userData.role === 'admin') {
      addStaffUser({
        id: `local_${userData.name}`,
        username: userData.name,
        displayName: userData.name,
        avatar: undefined,
        role: userData.role,
        discordId: `local_${userData.name}`,
        lastSeen: Date.now(),
        isOnline: true
      });
    }
  };

  const handleDiscordLogin = () => {
    // La funzione viene gestita automaticamente dal hook useDiscordAuth
  };

  const handleLogout = () => {
    setUser(null);
    setHasShownWelcome(false); // Reset welcome flag

    // Se l'utente è loggato tramite Discord, fai logout anche da Discord
    if (discordUser) {
      discordLogout();
    }

    toast({
      title: "Logout effettuato",
      description: "Sei stato disconnesso con successo.",
    });
  };

  // Effetto per sincronizzare l'autenticazione Discord
  useEffect(() => {
    if (discordUser && !authLoading) {
      const userData = {
        name: discordUser.displayName || discordUser.username,
        role: discordUser.role || 'default',
        displayName: discordUser.displayName || discordUser.username,
        avatarUrl: discordUser.avatarUrl
      };
      setUser(userData);
      setIsLoginModalOpen(false);

      // Add to staff users cache if user is mod or admin
      const userRole = discordUser.role || 'default';
      if (userRole === 'mod' || userRole === 'admin') {
        addStaffUser({
          id: discordUser.id,
          username: discordUser.username,
          displayName: discordUser.displayName,
          avatar: discordUser.avatar,
          role: userRole,
          discordId: discordUser.id,
          lastSeen: Date.now(),
          isOnline: true
        });
      }

      // Only show welcome toast once per session
      if (!hasShownWelcome) {
        toast({
          title: "Login Discord completato!",
          description: `Benvenuto, ${discordUser.displayName || discordUser.username}!`,
        });
        setHasShownWelcome(true);
      }
    } else if (!discordUser && !authLoading) {
      setUser(null);
    }
  }, [discordUser, authLoading, addStaffUser]);

  // Update user activity - online when on site, offline when browser closed
  useEffect(() => {
    if (!isAuthenticated || !discordUser?.id) return;

    // Set online immediately when user authenticates
    apiClient.updateUserActivity(discordUser.id).catch(error =>
      console.warn('Failed to set user online:', error)
    );

    // Send heartbeat every 30 seconds to stay online
    const heartbeat = setInterval(async () => {
      try {
        await apiClient.updateUserActivity(discordUser.id);
      } catch (error) {
        console.warn('Heartbeat failed:', error);
      }
    }, 30 * 1000); // Every 30 seconds

    // Set offline when page is about to close/navigate away
    const handleBeforeUnload = async () => {
      try {
        // Use sendBeacon for reliable offline signal
        const data = JSON.stringify({ discordId: discordUser.id, offline: true });
        navigator.sendBeacon('/api/users/offline', data);
      } catch (error) {
        console.warn('Failed to set user offline:', error);
      }
    };

    // Set offline when tab becomes hidden (user switches tab/minimizes)
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        try {
          await apiClient.updateUserActivity(discordUser.id);
        } catch (error) {
          console.warn('Failed to update activity on hide:', error);
        }
      } else {
        // Tab becomes visible again - send heartbeat
        try {
          await apiClient.updateUserActivity(discordUser.id);
        } catch (error) {
          console.warn('Failed to update activity on show:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, discordUser?.id]);

  // Notifica aggiornamenti in tempo reale
  useEffect(() => {
    if (lastUpdate > lastLocalUpdate) {
      toast({
        title: "📝 Board aggiornata",
        description: "La board è stata aggiornata da un altro utente",
      });
      setLastLocalUpdate(lastUpdate);
    }
  }, [lastUpdate, lastLocalUpdate]);

  // Aggiorna timestamp locale quando l'utente fa modifiche
  const handleLocalUpdate = (newLists: typeof lists) => {
    setLastLocalUpdate(Date.now());
    updateLists(newLists);

    // Update user activity
    if (discordUser?.id) {
      updateUserActivity(discordUser.id);
    } else if (user?.name) {
      updateUserActivity(`local_${user.name}`);
    }
  };

  // Listener per messaggi dal popup Discord
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'DISCORD_AUTH_SUCCESS') {
        // Salva il token JWT nel localStorage
        if (event.data.token) {
          localStorage.setItem('auth_token', event.data.token);
        }

        // Setta temporaneamente i dati utente fino a quando il hook non si aggiorna
        setUser({
          name: event.data.user.username,
          role: event.data.role,
          displayName: event.data.user.displayName,
          avatarUrl: event.data.user.avatarUrl
        });
        setIsLoginModalOpen(false);

        // Ricarica la pagina per far leggere il nuovo token dal hook
        window.location.reload();

        toast({
          title: "Login Discord completato!",
          description: `Benvenuto, ${event.data.user.displayName || event.data.user.username}!`,
        });
      } else if (event.data.type === 'DISCORD_AUTH_ERROR') {
        toast({
          title: "Errore di autenticazione",
          description: event.data.error,
          variant: "destructive",
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleCardClick = (cardId: string) => {
    const card = lists.flatMap(l => l.cards).find(c => c.id === cardId);
    if (card) {
      setSelectedCard(card);
      setIsCardModalOpen(true);
    }
  };

  const handleCardContextMenu = (event: React.MouseEvent, cardId: string) => {
    const userRole = user?.role || 'default';
    const items = getCardContextMenuItems(
      cardId,
      userRole,
      (id) => handleCardEdit(id),
      (id) => handleCardDelete(id),
      (id) => handleCardCopy(id),
      (id) => handleCardArchive(id),
      (id) => handleCardAssign(id),
      (id) => handleCardSetDueDate(id),
      (id) => handleCardAddLabel(id)
    );
    showContextMenu(event, items);
  };

  const handleListContextMenu = (event: React.MouseEvent, listId: string) => {
    const list = lists.find(l => l.id === listId);
    if (!list) return;

    const userRole = user?.role || 'default';
    const items = getListContextMenuItems(
      listId,
      list.type,
      userRole,
      (id) => handleListEdit(id),
      (id) => handleListCopy(id),
      (id) => handleListArchive(id),
      (id, type) => handleListVisibilityChange(id, type),
      (id) => handleListDelete(id),
      (id) => handleListExport(id),
      (id) => handleListSort(id),
      (id) => handleListSetLimit(id)
    );
    showContextMenu(event, items);
  };

  // Add new list
  const handleAddList = () => {
    const newList: KanbanListData = {
      id: Date.now().toString(),
      title: "Nuova Lista",
      type: "open",
      cards: []
    };
    handleLocalUpdate([...lists, newList]);
    toast({
      title: "Lista creata",
      description: "Nuova lista aggiunta alla board"
    });
  };

  // Add new card to list - now opens a dialog to input title
  const handleAddCard = (listId: string) => {
    setCreateCardListId(listId);
    setNewCardTitle("");
    setIsCreateCardModalOpen(true);
  };

  // Handle actual card creation after title input
  const handleCreateCard = () => {
    if (!newCardTitle.trim()) {
      toast({
        title: "Errore",
        description: "Il titolo della card è obbligatorio",
        variant: "destructive"
      });
      return;
    }

    const newCard = {
      title: newCardTitle.trim(),
      description: "", // No default description
      labels: [] as string[]
    };

    const cardId = addCard(createCardListId, newCard);
    if (cardId) {
      toast({
        title: "Card creata",
        description: `Card "${newCardTitle}" aggiunta alla lista`
      });

      // Close modal and reset state
      setIsCreateCardModalOpen(false);
      setNewCardTitle("");
      setCreateCardListId("");
    }
  };

  // List operations
  const handleListEdit = (listId: string) => {
    const list = lists.find(l => l.id === listId);
    if (!list) return;

    setModal({
      type: 'prompt',
      isOpen: true,
      title: 'Rinomina Lista',
      description: 'Inserisci il nuovo nome per la lista:',
      initialValue: list.title,
      onPromptConfirm: (newTitle) => {
        handleLocalUpdate(lists.map(l =>
          l.id === listId
            ? { ...l, title: newTitle }
            : l
        ));
        toast({
          title: "Lista rinominata",
          description: `Lista rinominata in "${newTitle}"`
        });
      }
    });
  };

  const handleListCopy = (listId: string) => {
    const list = lists.find(l => l.id === listId);
    if (!list) return;

    const newList: KanbanListData = {
      ...list,
      id: Date.now().toString(),
      title: `${list.title} (Copia)`,
      cards: list.cards.map(card => ({
        ...card,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }))
    };

    handleLocalUpdate([...lists, newList]);
    toast({
      title: "Lista copiata",
      description: `Lista "${list.title}" copiata con successo`
    });
  };

  const handleListArchive = (listId: string) => {
    const list = lists.find(l => l.id === listId);
    if (!list) return;

    setModal({
      type: 'confirm',
      isOpen: true,
      title: 'Archivia Lista',
      description: `Sei sicuro di voler archiviare la lista "${list.title}"? Questa azione non può essere annullata.`,
      variant: 'warning',
      onConfirm: () => {
        handleLocalUpdate(lists.filter(l => l.id !== listId));
        toast({
          title: "Lista archiviata",
          description: `Lista "${list.title}" archiviata con successo`
        });
      }
    });
  };

  const handleListVisibilityChange = (listId: string, newType: 'open' | 'closed' | 'hidden') => {
    const list = lists.find(l => l.id === listId);
    if (!list) return;

    const typeLabels = {
      open: 'aperta',
      closed: 'staff-only',
      hidden: 'nascosta'
    };

    handleLocalUpdate(lists.map(l =>
      l.id === listId
        ? { ...l, type: newType }
        : l
    ));
    toast({
      title: "Visibilità cambiata",
      description: `Lista "${list.title}" ora è ${typeLabels[newType]}`
    });
  };

  const handleListDelete = (listId: string) => {
    const list = lists.find(l => l.id === listId);
    if (!list) return;

    setModal({
      type: 'confirm',
      isOpen: true,
      title: 'Elimina Lista',
      description: `Sei sicuro di voler eliminare definitivamente la lista "${list.title}"? Tutte le card verranno perse e questa azione non può essere annullata.`,
      variant: 'destructive',
      onConfirm: () => {
        handleLocalUpdate(lists.filter(l => l.id !== listId));
        toast({
          title: "Lista eliminata",
          description: `Lista "${list.title}" eliminata definitivamente`
        });
      }
    });
  };

  const handleListExport = (listId: string) => {
    const list = lists.find(l => l.id === listId);
    if (!list) return;

    // Create export data
    const exportData = {
      title: list.title,
      type: list.type,
      cards: list.cards.map(card => ({
        title: card.title,
        description: card.description || '',
        labels: card.labels || [],
        dueDate: card.dueDate ? card.dueDate.toISOString() : null,
        attachments: card.attachments || [],
        members: card.members || []
      })),
      exportedAt: new Date().toISOString(),
      exportedBy: user?.name || 'Anonimo'
    };

    // Create and download JSON file
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${list.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Lista esportata",
      description: `Lista "${list.title}" esportata come file JSON`
    });
  };

  const handleListSort = (listId: string) => {
    const list = lists.find(l => l.id === listId);
    if (!list) return;

    setModal({
      type: 'prompt',
      isOpen: true,
      title: 'Ordina Card',
      description: 'Scegli il metodo di ordinamento:\n1 - Alfabetico per titolo (A-Z)\n2 - Alfabetico inverso (Z-A)\n3 - Per data di scadenza\n4 - Per priorità\n\nInserisci il numero (1-4):',
      initialValue: '1',
      onPromptConfirm: (value) => {
        const sortOption = parseInt(value);
        let sortedCards = [...list.cards];

        switch (sortOption) {
          case 1:
            // Alfabetico A-Z
            sortedCards.sort((a, b) => a.title.localeCompare(b.title));
            break;
          case 2:
            // Alfabetico Z-A
            sortedCards.sort((a, b) => b.title.localeCompare(a.title));
            break;
          case 3:
            // Per data di scadenza (prima le card con scadenza, poi senza)
            sortedCards.sort((a, b) => {
              if (!a.dueDate && !b.dueDate) return 0;
              if (!a.dueDate) return 1;
              if (!b.dueDate) return -1;
              return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            });
            break;
          case 4:
            // Per priorità (alta, media, bassa, nessuna)
            const priorityOrder = { high: 1, medium: 2, low: 3 };
            sortedCards.sort((a, b) => {
              const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 4;
              const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 4;
              return aPriority - bPriority;
            });
            break;
          default:
            toast({
              title: "Opzione non valida",
              description: "Seleziona un numero da 1 a 4",
              variant: "destructive"
            });
            return;
        }

        handleLocalUpdate(lists.map(l =>
          l.id === listId
            ? { ...l, cards: sortedCards }
            : l
        ));

        const sortMethods = {
          1: 'alfabeticamente (A-Z)',
          2: 'alfabeticamente (Z-A)',
          3: 'per data di scadenza',
          4: 'per priorità'
        };

        toast({
          title: "Card ordinate",
          description: `Card nella lista "${list.title}" ordinate ${sortMethods[sortOption as keyof typeof sortMethods]}`
        });
      }
    });
  };

  const handleListSetLimit = (listId: string) => {
    const list = lists.find(l => l.id === listId);
    if (!list) return;

    setModal({
      type: 'prompt',
      isOpen: true,
      title: 'Imposta Limite Card',
      description: 'Inserisci il numero massimo di card per questa lista (0 = nessun limite):',
      initialValue: (list.cardLimit || 0).toString(),
      onPromptConfirm: (value) => {
        const limit = parseInt(value);
        if (isNaN(limit) || limit < 0) {
          toast({
            title: "Errore",
            description: "Inserisci un numero valido",
            variant: "destructive"
          });
          return;
        }

        handleLocalUpdate(lists.map(l =>
          l.id === listId
            ? { ...l, cardLimit: limit === 0 ? undefined : limit }
            : l
        ));
        toast({
          title: "Limite impostato",
          description: `Limite card per "${list.title}": ${limit === 0 ? 'nessun limite' : limit}`
        });
      }
    });
  };

  // Card operations
  const handleCardEdit = (cardId: string) => {
    handleCardClick(cardId); // Opens the detail modal for editing
  };

  const handleCardDelete = (cardId: string) => {
    const card = lists.flatMap(l => l.cards).find(c => c.id === cardId);
    if (!card) return;

    setModal({
      type: 'confirm',
      isOpen: true,
      title: 'Elimina Card',
      description: `Sei sicuro di voler eliminare la card "${card.title}"? Questa azione non può essere annullata.`,
      variant: 'destructive',
      onConfirm: async () => {
        try {
          // Delete from database if available
          if (deleteCard) {
            await deleteCard(cardId);
          } else {
            // Fallback to local update for mock data
            handleLocalUpdate(lists.map(list => ({
              ...list,
              cards: list.cards.filter(c => c.id !== cardId)
            })));
          }

          toast({
            title: "Card eliminata",
            description: `Card "${card.title}" eliminata con successo`
          });
        } catch (error) {
          console.error('Error deleting card:', error);
          toast({
            title: "Errore",
            description: "Impossibile eliminare la card. Riprova più tardi.",
            variant: "destructive"
          });
        }
      }
    });
  };

  const handleCardCopy = (cardId: string) => {
    const card = lists.flatMap(l => l.cards).find(c => c.id === cardId);
    const sourceList = lists.find(l => l.cards.some(c => c.id === cardId));
    if (!card || !sourceList) return;

    const newCard = {
      ...card,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: `${card.title} (Copia)`
    };

    handleLocalUpdate(lists.map(list =>
      list.id === sourceList.id
        ? { ...list, cards: [...list.cards, newCard] }
        : list
    ));

    toast({
      title: "Card copiata",
      description: `Card "${card.title}" copiata con successo`
    });
  };

  const handleCardArchive = (cardId: string) => {
    const card = lists.flatMap(l => l.cards).find(c => c.id === cardId);
    if (!card) return;

    setModal({
      type: 'confirm',
      isOpen: true,
      title: 'Archivia Card',
      description: `Sei sicuro di voler archiviare la card "${card.title}"?`,
      variant: 'warning',
      onConfirm: () => {
        handleLocalUpdate(lists.map(list => ({
          ...list,
          cards: list.cards.filter(c => c.id !== cardId)
        })));
        toast({
          title: "Card archiviata",
          description: `Card "${card.title}" archiviata con successo`
        });
      }
    });
  };

  const handleCardAssign = (cardId: string) => {
    const card = lists.flatMap(l => l.cards).find(c => c.id === cardId);
    if (!card) return;

    setAssignModalCard(card);
    setIsAssignModalOpen(true);
  };

  const handleCardSetDueDate = (cardId: string) => {
    toast({
      title: "Funzionalità in sviluppo",
      description: "Impostazione scadenza tramite context menu in arrivo!"
    });
  };

  const handleCardAddLabel = (cardId: string) => {
    toast({
      title: "Funzionalità in sviluppo",
      description: "Aggiunta etichette tramite context menu in arrivo!"
    });
  };

  const closeModal = () => {
    setModal({ type: null, isOpen: false, title: '', description: '' });
  };


  return (
    <div className="min-h-screen bg-background">
      <Header
        isLoggedIn={isAuthenticated}
        user={discordUser ? {
          name: discordUser.displayName || discordUser.username,
          role: discordUser.role || 'default',
          displayName: discordUser.displayName || discordUser.username,
          avatarUrl: discordUser.avatarUrl
        } : user}
        onLogin={handleLoginClick}
        onLogout={handleLogout}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filters={filters}
        onFiltersChange={setFilters}
      />
      
      <main className="h-[calc(100vh-4rem)]">
        <KanbanBoard
          lists={lists}
          userRole={user?.role || 'default'}
          isPublicView={!isAuthenticated || (user?.role === 'default')}
          searchQuery={searchQuery}
          filters={filters}
          boardTitle={boardTitle}
          onAddList={handleAddList}
          onAddCard={handleAddCard}
          onCardClick={handleCardClick}
          onCardContextMenu={handleCardContextMenu}
          onListEdit={handleListEdit}
          onListDelete={handleListDelete}
          onListVisibilityChange={handleListVisibilityChange}
          onListContextMenu={handleListContextMenu}
          onListsUpdate={handleLocalUpdate}
          onCardPositionUpdate={updateCardPosition}
          onListPositionUpdate={updateListPosition}
        />
      </main>

      <CardDetailModal
        card={selectedCard}
        isOpen={isCardModalOpen}
        onClose={() => {
          setIsCardModalOpen(false);
          setSelectedCard(null);
        }}
        onCardUpdate={(updatedCard) => {
          // Check what changed and log actions
          if (selectedCard && selectedCard.id === updatedCard.id) {
            // Check if title changed
            if (selectedCard.title !== updatedCard.title) {
              const action = logCardEdited(updatedCard.id, 'title', selectedCard.title, updatedCard.title);
              if (action) {
                // Send action to server
                apiClient.createCardAction(action).catch((error) => {
                  console.error('Failed to log title change:', error);
                });
              }
            }

            // Check if description changed
            if ((selectedCard.description || '') !== (updatedCard.description || '')) {
              const action = logCardEdited(updatedCard.id, 'description', selectedCard.description || '', updatedCard.description || '');
              if (action) {
                // Send action to server
                apiClient.createCardAction(action).catch((error) => {
                  console.error('Failed to log description change:', error);
                });
              }
            }
          }

          // Update card in lists
          const updatedLists = lists.map(list => ({
            ...list,
            cards: list.cards.map(card =>
              card.id === updatedCard.id ? updatedCard : card
            )
          }));
          updateLists(updatedLists);
          setSelectedCard(updatedCard);
        }}
        onCardDelete={handleCardDelete}
        userRole={user?.role || 'default'}
        currentUserId={user?.name || discordUser?.id}
      />

      {/* Create Card Modal */}
      <Dialog open={isCreateCardModalOpen} onOpenChange={setIsCreateCardModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crea Nuova Card</DialogTitle>
            <DialogDescription>
              Inserisci il titolo per la nuova card
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Input
                placeholder="Titolo della card..."
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCreateCard();
                  }
                  if (e.key === 'Escape') {
                    setIsCreateCardModalOpen(false);
                    setNewCardTitle("");
                  }
                }}
                autoFocus
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Premi Invio per creare o Esc per annullare
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateCardModalOpen(false);
                  setNewCardTitle("");
                }}
              >
                Annulla
              </Button>
              <Button
                onClick={handleCreateCard}
                disabled={!newCardTitle.trim()}
              >
                Crea Card
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLogin={handleLogin}
        onDiscordLogin={handleDiscordLogin}
      />

      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        items={contextMenu.items}
        visible={contextMenu.visible}
        onClose={hideContextMenu}
      />

      {/* Custom Modals */}
      {modal.type === 'confirm' && (
        <ConfirmModal
          isOpen={modal.isOpen}
          onClose={closeModal}
          onConfirm={modal.onConfirm!}
          title={modal.title}
          description={modal.description}
          variant={modal.variant}
        />
      )}

      {modal.type === 'prompt' && (
        <PromptModal
          isOpen={modal.isOpen}
          onClose={closeModal}
          onConfirm={modal.onPromptConfirm!}
          title={modal.title}
          description={modal.description}
          initialValue={modal.initialValue}
        />
      )}

      {modal.type === 'alert' && (
        <AlertModal
          isOpen={modal.isOpen}
          onClose={closeModal}
          title={modal.title}
          description={modal.description}
          variant={modal.variant}
        />
      )}

      {/* Member Assignment Modal */}
      {assignModalCard && (
        <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Assegna Membro</DialogTitle>
              <DialogDescription>
                Assegna un membro alla card "{assignModalCard.title}"
              </DialogDescription>
            </DialogHeader>
            <MemberSelector
              cardId={assignModalCard.id}
              currentMembers={assignModalCard.members || []}
              onMembersChange={(newMembers) => {
                // Update the card with new members
                const updatedLists = lists.map(list => ({
                  ...list,
                  cards: list.cards.map(card =>
                    card.id === assignModalCard.id
                      ? { ...card, members: newMembers }
                      : card
                  )
                }));
                updateLists(updatedLists);

                // Show notification for assigned member
                const addedMember = newMembers.find(m =>
                  !assignModalCard.members?.some(existing => existing.id === m.id)
                );
                if (addedMember) {
                  // Toast for current user
                  toast({
                    title: "Membro assegnato",
                    description: `${addedMember.username} è stato assegnato alla card "${assignModalCard.title}"`
                  });

                  // Notification for the assigned member (if it's not the current user)
                  const currentUserId = user?.name || discordUser?.id;
                  if (addedMember.id !== currentUserId && addedMember.discord_id !== currentUserId) {
                    addNotification({
                      title: "Sei stato assegnato a una card",
                      description: `Sei stato assegnato alla card "${assignModalCard.title}"`,
                      variant: "success"
                    });
                  }
                }

                setIsAssignModalOpen(false);
              }}
              canEdit={true}
              currentUserId={user?.name || discordUser?.id}
            />
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
};


export default Index;
