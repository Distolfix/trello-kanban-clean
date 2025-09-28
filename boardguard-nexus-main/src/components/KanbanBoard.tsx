import { useState, useRef } from "react";
import { KanbanList, type KanbanListData } from "./KanbanList";
import { Button } from "@/components/ui/button";
import { Plus, LayoutGrid } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  UniqueIdentifier,
  closestCorners,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { KanbanCard, type KanbanCardData } from "./KanbanCard";

interface FilterState {
  assignees: string[];
  labels: string[];
  priority: string[];
  dueDateFilter: 'all' | 'overdue' | 'thisWeek' | 'noDate';
}

interface KanbanBoardProps {
  lists: KanbanListData[];
  userRole?: 'default' | 'mod' | 'admin';
  isPublicView?: boolean;
  searchQuery?: string;
  filters?: FilterState;
  boardTitle?: string;
  onAddList?: () => void;
  onAddCard?: (listId: string) => void;
  onCardClick?: (cardId: string) => void;
  onCardContextMenu?: (event: React.MouseEvent, cardId: string) => void;
  onListEdit?: (listId: string) => void;
  onListDelete?: (listId: string) => void;
  onListVisibilityChange?: (listId: string, newType: 'open' | 'closed' | 'hidden') => void;
  onListContextMenu?: (event: React.MouseEvent, listId: string) => void;
  onListsUpdate?: (lists: KanbanListData[]) => void;
  onCardPositionUpdate?: (cardId: string, newListId: string, newPosition: number) => void;
  onListPositionUpdate?: (listId: string, newPosition: number) => void;
  onAttachmentUpload?: (cardId: string, files: File[]) => Promise<void>;
  onCardUpdate?: (updatedCard: KanbanCardData) => void;
}


export function KanbanBoard({
  lists,
  userRole = 'default',
  isPublicView = false,
  searchQuery = "",
  filters = {
    assignees: [],
    labels: [],
    priority: [],
    dueDateFilter: 'all'
  },
  boardTitle = "",
  onAddList,
  onAddCard,
  onCardClick,
  onCardContextMenu,
  onListEdit,
  onListDelete,
  onListVisibilityChange,
  onListContextMenu,
  onListsUpdate,
  onCardPositionUpdate,
  onListPositionUpdate,
  onAttachmentUpload,
  onCardUpdate
}: KanbanBoardProps) {
  const [activeCard, setActiveCard] = useState<KanbanCardData | null>(null);
  const [activeList, setActiveList] = useState<KanbanListData | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  // Filter lists based on user role
  const visibleLists = lists.filter(list => {
    if (isPublicView) return list.type === 'open';

    switch (userRole) {
      case 'admin':
        return true; // Admin can see all lists
      case 'mod':
        return true; // Mod can see all lists for drag and drop functionality
      default:
        return list.type === 'open'; // Default users see only open lists
    }
  });

  // Apply search and filters
  const filteredLists = visibleLists.map(list => {
    let filteredCards = list.cards || [];

    // Apply search
    if (searchQuery) {
      filteredCards = filteredCards.filter(card =>
        card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (card.labels || []).some(label => label.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (card.assignees || []).some(assignee => assignee.name.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply filters
    if (filters.assignees.length > 0) {
      filteredCards = filteredCards.filter(card =>
        (card.assignees || []).some(assignee => filters.assignees.includes(assignee.id))
      );
    }

    if (filters.labels.length > 0) {
      filteredCards = filteredCards.filter(card =>
        (card.labels || []).some(label => filters.labels.includes(label.id))
      );
    }

    if (filters.priority.length > 0) {
      filteredCards = filteredCards.filter(card =>
        card.priority && filters.priority.includes(card.priority)
      );
    }

    // Due date filter
    if (filters.dueDateFilter !== 'all') {
      filteredCards = filteredCards.filter(card => {
        if (!card.dueDate && filters.dueDateFilter === 'noDate') return true;
        if (!card.dueDate) return false;
        
        const now = new Date();
        const cardDate = card.dueDate;
        
        switch (filters.dueDateFilter) {
          case 'overdue':
            return cardDate < now;
          case 'thisWeek':
            const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            return cardDate >= now && cardDate <= weekFromNow;
          default:
            return true;
        }
      });
    }

    return {
      ...list,
      cards: filteredCards
    };
  });

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeId = active.id as string;

    // Check if dragging a list
    if (activeId.startsWith('list-')) {
      const listId = activeId.replace('list-', '');
      const list = lists.find(l => l.id === listId);
      if (list) {
        setActiveList(list);
      }
    } else {
      // Find the card being dragged
      const card = lists.flatMap(list => list.cards).find(c => c.id === activeId);
      if (card) {
        setActiveCard(card);
      }
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Don't do anything if we're not hovering over a different item
    if (activeId === overId) return;

    // Check if user has permission to drag - only admin and mod can drag
    if (userRole !== 'admin' && userRole !== 'mod') return;

    const activeCard = lists.flatMap(list => list.cards || []).find(c => c.id === activeId);
    if (!activeCard) return;

    // Find source and destination lists
    const activeList = lists.find(list => (list.cards || []).some(card => card.id === activeId));
    // Improved logic for finding target list - support dropping on empty lists
    const overList = lists.find(list =>
      list.id === overId || // Direct list drop
      list.id === overId.replace('list-', '') || // Handle list- prefix
      (list.cards || []).some(card => card.id === overId) // Card-to-card drop
    );

    if (!activeList || !overList) return;

    // Permission checks based on user role and list types
    // Admin can move cards anywhere
    // Mod can only move cards TO private lists (closed/hidden), not to open lists
    if (userRole === 'mod' && overList.type === 'open') {
      return;
    }

    // If moving to a different list
    if (activeList.id !== overList.id) {
      const newLists = lists.map(list => {
        if (list.id === activeList.id) {
          return {
            ...list,
            cards: (list.cards || []).filter(card => card.id !== activeId)
          };
        }
        if (list.id === overList.id) {
          const overCard = (list.cards || []).find(card => card.id === overId);
          if (overCard) {
            // Insert before the target card
            const overIndex = list.cards.indexOf(overCard);
            const newCards = [...list.cards];
            newCards.splice(overIndex, 0, activeCard);
            return { ...list, cards: newCards };
          } else {
            // Add to end of list (empty list or list area drop)
            return { ...list, cards: [...list.cards, activeCard] };
          }
        }
        return list;
      });

      onListsUpdate?.(newLists);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveCard(null);
    setActiveList(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Handle list reordering
    if (activeId.startsWith('list-') && overId.startsWith('list-')) {
      // Allow both admins and mods to reorder lists
      if (userRole !== 'admin' && userRole !== 'mod') return;

      const activeListId = activeId.replace('list-', '');
      const overListId = overId.replace('list-', '');

      if (activeListId !== overListId) {
        const activeIndex = lists.findIndex(list => list.id === activeListId);
        const overIndex = lists.findIndex(list => list.id === overListId);

        if (activeIndex !== overIndex) {
          const newLists = arrayMove(lists, activeIndex, overIndex);
          onListsUpdate?.(newLists);
        }
      }
      return;
    }

    // Handle card dragging (existing logic)
    if (userRole !== 'admin' && userRole !== 'mod') {
      return;
    }

    // Find the active card and lists
    const activeList = lists.find(list => (list.cards || []).some(card => card.id === activeId));
    // Improved logic for finding target list - support dropping on empty lists
    const overList = lists.find(list =>
      list.id === overId || // Direct list drop
      list.id === overId.replace('list-', '') || // Handle list- prefix
      (list.cards || []).some(card => card.id === overId) // Card-to-card drop
    );

    if (!activeList || !overList) return;

    // Permission checks based on user role and list types
    // Admin can move cards anywhere
    // Mod can only move cards TO private lists (closed/hidden), not to open lists
    if (userRole === 'mod' && overList.type === 'open') {
      return;
    }

    // If dropping on the same list, reorder cards
    if (activeList.id === overList.id) {
      const activeIndex = activeList.cards.findIndex(card => card.id === activeId);
      const overIndex = activeList.cards.findIndex(card => card.id === overId);

      if (activeIndex !== overIndex) {
        // Use tracking system for reordering
        if (onCardPositionUpdate) {
          onCardPositionUpdate(activeId, overList.id, overIndex);
        } else {
          // Fallback to local update
          const newCards = arrayMove(activeList.cards, activeIndex, overIndex);
          const newLists = lists.map(list =>
            list.id === activeList.id ? { ...list, cards: newCards } : list
          );
          onListsUpdate?.(newLists);
        }
      }
    } else {
      // Moving between different lists
      // Check permission for mod users - they cannot move cards to open lists
      if (userRole === 'mod' && overList.type === 'open') {
        return;
      }

      const overCard = overList.cards.find(card => card.id === overId);
      // Better position calculation for cross-list drops
      let newPosition;
      if (overCard) {
        // Dropping on a specific card - insert before it
        newPosition = overList.cards.indexOf(overCard);
      } else {
        // Dropping on empty list or list area - add to end
        newPosition = overList.cards.length;
      }

      // Use tracking system for moving between lists
      if (onCardPositionUpdate) {
        onCardPositionUpdate(activeId, overList.id, newPosition);
      } else {
        // Fallback to existing logic in handleDragOver
        const newLists = lists.map(list => {
          if (list.id === activeList.id) {
            return {
              ...list,
              cards: (list.cards || []).filter(card => card.id !== activeId)
            };
          }
          if (list.id === overList.id) {
            const activeCard = activeList.cards.find(c => c.id === activeId);
            if (activeCard) {
              if (overCard) {
                const overIndex = list.cards.indexOf(overCard);
                const newCards = [...list.cards];
                newCards.splice(overIndex, 0, activeCard);
                return { ...list, cards: newCards };
              } else {
                return { ...list, cards: [...list.cards, activeCard] };
              }
            }
          }
          return list;
        });
        onListsUpdate?.(newLists);
      }
    }
  };


  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Handle horizontal scrolling with wheel
    if (!boardRef.current) return;

    // If user is scrolling horizontally (trackpad swipe) or holding shift + wheel
    if (Math.abs(e.deltaX) > 0 || e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();

      // Use deltaX for horizontal scroll, or deltaY when shift is held
      const scrollAmount = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      boardRef.current.scrollLeft += scrollAmount;
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only enable scroll drag if we're clicking on the board background
    // Not on cards, lists, or interactive elements
    const target = e.target as HTMLElement;
    const isInteractiveElement =
      target.closest('[data-kanban-card]') ||
      target.closest('[data-kanban-list]') ||
      target.closest('button') ||
      target.closest('[role="button"]') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.tagName.toLowerCase() === 'button';

    if (isInteractiveElement || !boardRef.current) return;

    // Prevent text selection during drag
    e.preventDefault();

    const startX = e.clientX;
    const startScrollLeft = boardRef.current.scrollLeft;
    let lastX = startX;
    let velocity = 0;
    let lastTime = performance.now();

    // Add cursor style for dragging
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    // Direct scroll update without requestAnimationFrame for immediate response
    const updateScroll = (clientX: number) => {
      if (!boardRef.current) return;

      const currentTime = performance.now();
      const deltaTime = currentTime - lastTime;
      const deltaX = clientX - startX;

      // Calculate velocity for momentum
      if (deltaTime > 0) {
        velocity = (clientX - lastX) / deltaTime;
      }

      const newScrollLeft = startScrollLeft - deltaX;

      // Bounds checking
      const maxScroll = boardRef.current.scrollWidth - boardRef.current.clientWidth;
      const boundedScrollLeft = Math.max(0, Math.min(newScrollLeft, maxScroll));

      // Direct scroll assignment for instant response
      boardRef.current.scrollLeft = boundedScrollLeft;

      lastX = clientX;
      lastTime = currentTime;
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Immediate scroll update
      updateScroll(e.clientX);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      // Add momentum scrolling
      if (Math.abs(velocity) > 0.1 && boardRef.current) {
        let currentVelocity = velocity * 50; // Scale velocity
        const deceleration = 0.95;

        const momentumScroll = () => {
          if (!boardRef.current || Math.abs(currentVelocity) < 0.1) return;

          const newScrollLeft = boardRef.current.scrollLeft - currentVelocity;
          const maxScroll = boardRef.current.scrollWidth - boardRef.current.clientWidth;
          const boundedScrollLeft = Math.max(0, Math.min(newScrollLeft, maxScroll));

          boardRef.current.scrollLeft = boundedScrollLeft;
          currentVelocity *= deceleration;

          requestAnimationFrame(momentumScroll);
        };

        requestAnimationFrame(momentumScroll);
      }

      // Re-enable text selection and reset cursor
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: false });
    document.addEventListener('mouseup', handleMouseUp);
  };


  const hasActiveFilters =
    filters.assignees.length > 0 ||
    filters.labels.length > 0 ||
    filters.priority.length > 0 ||
    filters.dueDateFilter !== 'all';

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-screen kanban-board bg-gradient-to-br from-background via-surface to-background">
        {/* Board Header */}
        <div className="border-b border-border bg-surface/50 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            {boardTitle && (
              <h2 className="text-2xl font-bold text-foreground">
                {boardTitle}
              </h2>
            )}
            {isPublicView && (
              <div className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
                Vista pubblica
              </div>
            )}
          </div>

          {!isPublicView && userRole === 'admin' && (
            <div className="flex items-center space-x-2">
              {/* Add List Button */}
              <Button onClick={onAddList} className="gradient-primary">
                <Plus className="h-4 w-4 mr-2" />
                Nuova Lista
              </Button>
            </div>
          )}
        </div>

      </div>

      {/* Board Content */}
      <div
        ref={boardRef}
        className="flex-1 overflow-x-auto overflow-y-hidden p-6 scrollbar-horizontal kanban-scroll-optimized instant-scroll"
        style={{ height: 'calc(100vh - 120px)' }}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      >
        <div className="flex space-x-6 pb-6 h-full">
          <SortableContext
            items={filteredLists.map(list => `list-${list.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            {filteredLists.map((list) => (
              <KanbanList
                key={list.id}
                list={list}
                userRole={userRole}
                onAddCard={onAddCard}
                onCardClick={onCardClick}
                onCardContextMenu={onCardContextMenu}
                onListEdit={onListEdit}
                onListDelete={onListDelete}
                onListVisibilityChange={onListVisibilityChange}
                onListContextMenu={onListContextMenu}
                onAttachmentUpload={onAttachmentUpload}
                onCardUpdate={onCardUpdate}
              />
            ))}
          </SortableContext>
          
          {/* Empty State or Add List */}
          {filteredLists.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <LayoutGrid className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                {isPublicView ? "Nessuna board pubblica" : "Nessuna lista disponibile"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {isPublicView 
                  ? "L'admin non ha ancora definito una board pubblica."
                  : hasActiveFilters 
                    ? "Nessun risultato trovato con i filtri attuali."
                    : "Inizia creando la tua prima lista per organizzare le attività."
                }
              </p>
              {!isPublicView && userRole === 'admin' && !hasActiveFilters && (
                <Button onClick={onAddList} className="gradient-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  Crea la prima lista
                </Button>
              )}
            </div>
          ) : (
            // Add List placeholder at the end - only admin can add lists
            !isPublicView && userRole === 'admin' && (
              <div className="w-80 flex-shrink-0">
                <Button
                  variant="ghost"
                  className="w-full h-20 border-2 border-dashed border-muted hover:border-border hover:bg-surface-hover transition-colors"
                  onClick={onAddList}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Aggiungi altra lista
                </Button>
              </div>
            )
          )}
          </div>
        </div>

        <DragOverlay>
          {activeCard ? (
            <KanbanCard
              card={activeCard}
              isDragging
              userRole={userRole}
              listType={lists.find(list => (list.cards || []).some(card => card.id === activeCard.id))?.type || 'open'}
              onAttachmentUpload={onAttachmentUpload}
              onCardUpdate={onCardUpdate}
            />
          ) : activeList ? (
            <KanbanList
              list={activeList}
              isDragging
              userRole={userRole}
              onAttachmentUpload={onAttachmentUpload}
              onCardUpdate={onCardUpdate}
            />
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}