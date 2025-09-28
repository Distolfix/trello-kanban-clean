import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KanbanCard, type KanbanCardData } from "./KanbanCard";
import {
  MoreHorizontal,
  Plus,
  Eye,
  EyeOff,
  Lock,
  GripVertical,
  Users,
  Shield,
  Crown
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

export type ListType = 'open' | 'closed' | 'hidden';

export interface KanbanListData {
  id: string;
  title: string;
  type: ListType;
  cards: KanbanCardData[];
  cardLimit?: number;
}

interface KanbanListProps {
  list: KanbanListData;
  userRole?: 'default' | 'mod' | 'admin';
  isDragging?: boolean;
  onAddCard?: (listId: string) => void;
  onCardClick?: (cardId: string) => void;
  onCardContextMenu?: (event: React.MouseEvent, cardId: string) => void;
  onListEdit?: (listId: string) => void;
  onListDelete?: (listId: string) => void;
  onListVisibilityChange?: (listId: string, newType: 'open' | 'closed' | 'hidden') => void;
  onListContextMenu?: (event: React.MouseEvent, listId: string) => void;
  onAttachmentUpload?: (cardId: string, files: File[]) => Promise<void>;
  onCardUpdate?: (updatedCard: KanbanCardData) => void;
}

const getListTypeIcon = (type: ListType) => {
  switch (type) {
    case 'open': return <Eye className="h-3 w-3" />;
    case 'closed': return <Lock className="h-3 w-3" />;
    case 'hidden': return <EyeOff className="h-3 w-3" />;
  }
};

const getListTypeBadge = (type: ListType) => {
  switch (type) {
    case 'open': return 'list-badge-open';
    case 'closed': return 'list-badge-closed';
    case 'hidden': return 'list-badge-hidden';
  }
};

const getListTypeLabel = (type: ListType) => {
  switch (type) {
    case 'open': return 'Aperta';
    case 'closed': return 'Staff Only';
    case 'hidden': return 'Solo Admin';
  }
};

const getVisibilityInfo = (type: ListType) => {
  switch (type) {
    case 'open': 
      return { 
        icon: <Users className="h-4 w-4" />, 
        text: "Visibile a tutti gli utenti",
        color: "text-success"
      };
    case 'closed': 
      return { 
        icon: <Shield className="h-4 w-4" />, 
        text: "Visibile a Moderatori e Admin",
        color: "text-warning"
      };
    case 'hidden': 
      return { 
        icon: <Crown className="h-4 w-4" />, 
        text: "Visibile solo agli Admin",
        color: "text-destructive"
      };
  }
};

export function KanbanList({
  list,
  userRole = 'default',
  isDragging,
  onAddCard,
  onCardClick,
  onCardContextMenu,
  onListEdit,
  onListDelete,
  onListVisibilityChange,
  onListContextMenu,
  onAttachmentUpload,
  onCardUpdate
}: KanbanListProps) {
  const { setNodeRef } = useDroppable({
    id: list.id,
    data: {
      type: 'list',
      list: list,
      accepts: ['card'], // This list accepts card drops
    },
  });

  // Make lists sortable for admins
  const {
    attributes: listAttributes,
    listeners: listListeners,
    setNodeRef: setListNodeRef,
    transform: listTransform,
    transition: listTransition,
    isDragging: isListDragging,
  } = useSortable({
    id: `list-${list.id}`,
    disabled: userRole !== 'admin' && userRole !== 'mod', // Allow both admins and mods
    data: {
      type: 'list',
      list: list,
    },
  });

  const listStyle = {
    transform: CSS.Transform.toString(listTransform),
    transition: listTransition,
  };

  const visibilityInfo = getVisibilityInfo(list.type);
  const canEdit = (
    (list.type === 'open' && (userRole === 'admin' || userRole === 'mod')) ||
    (list.type === 'closed' && (userRole === 'admin' || userRole === 'mod')) ||
    (list.type === 'hidden' && userRole === 'admin')
  );

  const showDragHandle = userRole === 'admin' || userRole === 'mod';
  const showTypeBadge = userRole !== 'default' || list.type !== 'open';

  const cardIds = (list.cards || []).map(card => card.id);

  return (
    <div
      ref={setListNodeRef}
      data-kanban-list
      className={cn(
        "kanban-list w-80 flex-shrink-0 p-4 flex flex-col bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 shadow-sm",
        (isDragging || isListDragging) && "opacity-50 rotate-1 scale-105"
      )}
      style={{
        ...listStyle,
        // Adaptive height based on content
        height: 'fit-content',
        minHeight: list.cards.length === 0 ? '250px' : 'auto',
        maxHeight: 'calc(100vh - 160px)',
        display: 'flex',
        flexDirection: 'column'
      }}
      onContextMenu={(e) => onListContextMenu?.(e, list.id)}
      {...listAttributes}
    >
      {/* List Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3 flex-1">
          {/* Drag Handle - Only for admins */}
          {showDragHandle && (
            <div
              className="drag-handle cursor-grab active:cursor-grabbing"
              {...listListeners}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4" />
            </div>
          )}
          
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="font-semibold text-card-foreground">{list.title}</h3>
            </div>
            
            {userRole !== 'default' && (
              <div className={cn("flex items-center space-x-1 text-xs", visibilityInfo.color)}>
                {visibilityInfo.icon}
                <span>{visibilityInfo.text}</span>
              </div>
            )}
          </div>
        </div>

        {/* List Actions */}
        <div className="flex items-center space-x-1">
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {list.cards.length}
            {list.cardLimit && ` / ${list.cardLimit}`}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={cn(
          "space-y-3 mb-4",
          list.cards.length > 6 ? "overflow-y-auto scrollbar-vertical" : "overflow-visible",
          list.cards.length === 0 ? "flex-1" : "flex-grow"
        )}
        style={{
          // Adaptive height based on number of cards
          minHeight: list.cards.length === 0 ? '120px' : 'auto',
          maxHeight: list.cards.length > 6 ? 'calc(100vh - 320px)' : 'none'
        }}
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {(list.cards || []).map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              userRole={userRole}
              listType={list.type}
              onClick={() => onCardClick?.(card.id)}
              onContextMenu={(e) => onCardContextMenu?.(e, card.id)}
              onAttachmentUpload={onAttachmentUpload}
              onCardUpdate={onCardUpdate}
            />
          ))}

          {/* Empty state drop zone hint */}
          {list.cards.length === 0 && (userRole === 'admin' || userRole === 'mod') && (
            <div className="flex items-center justify-center h-full text-muted-foreground border-2 border-dashed border-muted rounded-lg">
              <span className="text-sm">Trascina qui le card</span>
            </div>
          )}
        </SortableContext>
      </div>

      {/* Add Card Button - Solo per admin e mod */}
      {(userRole === 'admin' || userRole === 'mod') && (
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-surface-hover"
          onClick={() => onAddCard?.(list.id)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Aggiungi una card
        </Button>
      )}
    </div>
  );
}