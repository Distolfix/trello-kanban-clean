import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Calendar,
  Paperclip,
  MessageCircle,
  CheckSquare,
  Clock,
  AlertTriangle,
  GripVertical
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { useState, useEffect } from "react";
import type { KanbanCardData, CardAction } from "@/db/types";
import { useStaffUsers } from "@/hooks/useStaffUsers";
import { apiClient } from "@/api/client";
import { CardDropZone } from "./CardDropZone";

// Define types directly for browser compatibility
export interface User {
  id: string;
  username: string;
  email?: string;
}

// Re-export types for compatibility
export type { KanbanCardData, CardAction };

interface KanbanCardProps {
  card: KanbanCardData;
  isDragging?: boolean;
  onClick?: (event?: React.MouseEvent) => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  userRole?: 'default' | 'mod' | 'admin';
  listType?: 'open' | 'closed' | 'hidden';
  onAttachmentUpload?: (cardId: string, files: File[]) => Promise<void>;
  onCardUpdate?: (updatedCard: KanbanCardData) => void;
}

const getPriorityColor = (priority?: string) => {
  switch (priority) {
    case 'high': return 'text-destructive';
    case 'medium': return 'text-warning';
    case 'low': return 'text-success';
    default: return 'text-muted-foreground';
  }
};

const getPriorityLabel = (priority?: string) => {
  switch (priority) {
    case 'high': return 'Alta';
    case 'medium': return 'Media';
    case 'low': return 'Bassa';
    default: return '';
  }
};

const isOverdue = (date?: Date | string | number) => {
  if (!date) return false;
  return new Date(date) < new Date();
};

// Function to detect and make links clickable
const linkifyText = (text: string) => {
  // Updated regex to match more URL patterns
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/g;

  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      let href = part;
      // Add protocol if missing
      if (!part.startsWith('http')) {
        href = part.startsWith('www.') ? `https://${part}` : `https://${part}`;
      }

      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
          onClick={(e) => {
            e.stopPropagation(); // Prevent card click when clicking link
          }}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

export function KanbanCard({
  card,
  isDragging,
  onClick,
  onContextMenu,
  userRole = 'default',
  listType = 'open',
  onAttachmentUpload,
  onCardUpdate
}: KanbanCardProps) {
  const [assignees, setAssignees] = useState<User[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [localAttachments, setLocalAttachments] = useState(card.attachments || []);
  const { staffUsers } = useStaffUsers();

  // Sync local attachments with card attachments
  useEffect(() => {
    setLocalAttachments(card.attachments || []);
  }, [card.attachments]);

  // Handle image upload from CardDropZone
  const handleImageUploaded = async (attachmentData: any) => {
    try {
      // Update local attachments immediately for instant feedback
      const newAttachment = {
        id: attachmentData.id,
        filename: attachmentData.filename,
        originalName: attachmentData.originalName,
        size: attachmentData.size,
        mimetype: attachmentData.mimetype,
        uploadDate: attachmentData.uploadDate,
        url: attachmentData.url
      };

      const updatedAttachments = [...localAttachments, newAttachment];
      setLocalAttachments(updatedAttachments);

      // Update the parent card data
      const updatedCard = {
        ...card,
        attachments: updatedAttachments
      };

      onCardUpdate?.(updatedCard);
    } catch (error) {
      console.error('Error handling image upload:', error);
    }
  };

  // Function to get comment count for this card from API
  const getCommentCount = async () => {
    try {
      const comments = await apiClient.getCardComments(card.id);
      return comments?.length || 0;
    } catch (error) {
      console.error('Error getting comment count:', error);
      return 0;
    }
  };

  useEffect(() => {
    if (card.members && card.members.length > 0) {
      const users = card.members
        .filter((user): user is User => user !== undefined);
      setAssignees(users);
    } else {
      setAssignees([]);
    }
  }, [card.members]);

  // Update comment count
  useEffect(() => {
    const updateCommentCount = async () => {
      const count = await getCommentCount();
      setCommentCount(count);
    };

    // Initial count
    updateCommentCount();

    // Listen for custom comment events for real-time updates
    const handleCommentsUpdated = (e: CustomEvent) => {
      if (e.detail.cardId === card.id) {
        setCommentCount(e.detail.count);
      }
    };

    window.addEventListener('commentsUpdated', handleCommentsUpdated as EventListener);

    // Polling for updates every 10 seconds
    const interval = setInterval(updateCommentCount, 10000);

    return () => {
      window.removeEventListener('commentsUpdated', handleCommentsUpdated as EventListener);
      clearInterval(interval);
    };
  }, [card.id]);


  // Check if card dragging should be disabled
  // Mod users cannot drag cards from open (public) lists
  const isDragDisabled = userRole === 'default' ||
    (userRole === 'mod' && listType === 'open');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: card.id,
    disabled: isDragDisabled,
    data: {
      type: 'card',
      card: card,
    },
  });

  const overdue = isOverdue(card.dueDate);
  const showDragHandle = (userRole === 'admin') ||
    (userRole === 'mod' && listType !== 'open');

  // Check if user can upload (admin can always, mod can't upload to open lists)
  const canUpload = userRole === 'admin' || (userRole === 'mod' && listType !== 'open');

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleClick = (e: React.MouseEvent) => {
    // Prevent click if we're dragging or if the drag handle was clicked
    if (isSortableDragging || e.defaultPrevented) return;

    onClick?.(e);
  };

  return (
    <CardDropZone
      cardId={card.id}
      onImageUploaded={handleImageUploaded}
      disabled={!canUpload}
      className="w-full h-full"
    >
      <div
        ref={setNodeRef}
        style={style}
        data-kanban-card
        className={cn(
          "kanban-card p-4 cursor-pointer group relative w-full h-full",
          (isDragging || isSortableDragging) && "opacity-50 rotate-2 shadow-xl"
        )}
        onClick={handleClick}
        onContextMenu={onContextMenu}
        {...attributes}
      >
      {/* Drag Handle - Only for staff */}
      {showDragHandle && (
        <div
          className="drag-handle absolute top-2 right-2 opacity-0 group-hover:opacity-60 transition-opacity cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </div>
      )}


      {/* Labels */}
      {card.labels && card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {(card.labels || []).map((label, index) => (
            <Badge
              key={label.id || `label-${index}`}
              className="text-xs px-2 py-0.5"
              style={{
                backgroundColor: label.color + '20',
                color: label.color,
                border: `1px solid ${label.color}40`
              }}
            >
              {label.name}
            </Badge>
          ))}
        </div>
      )}

      {/* Title */}
      <h4 className="font-medium text-card-foreground mb-2 line-clamp-3">
        {linkifyText(card.title)}
      </h4>

      {/* Description */}
      {card.description && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {linkifyText(card.description)}
        </p>
      )}

      {/* Image Attachments Preview */}
      {localAttachments && localAttachments.some(att => att.mimetype?.startsWith('image/')) && (
        <div className="mb-3">
          <div className="grid grid-cols-2 gap-1 rounded-md overflow-hidden">
            {localAttachments
              .filter(att => att.mimetype?.startsWith('image/'))
              .slice(0, 4)
              .map((attachment, index) => (
                <div key={attachment.id} className="relative aspect-square bg-muted">
                  <img
                    src={attachment.url}
                    alt={attachment.originalName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  {/* Show count overlay on last image if there are more */}
                  {index === 3 && localAttachments.filter(att => att.mimetype?.startsWith('image/')).length > 4 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white text-xs font-medium">
                        +{localAttachments.filter(att => att.mimetype?.startsWith('image/')).length - 4}
                      </span>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Due Date */}
      {card.dueDate && (
        <div className={cn(
          "flex items-center space-x-1 mb-3 text-xs",
          overdue ? "text-destructive" : "text-muted-foreground"
        )}>
          {overdue ? (
            <AlertTriangle className="h-3 w-3" />
          ) : (
            <Calendar className="h-3 w-3" />
          )}
          <span>
            {new Date(card.dueDate).toLocaleDateString('it-IT', {
              day: 'numeric',
              month: 'short'
            })}
          </span>
          {overdue && <span className="font-medium">In ritardo</span>}
        </div>
      )}

      {/* Checklist Progress */}
      {card.checklist && (
        <div className="flex items-center space-x-2 mb-3">
          <CheckSquare className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {card.checklist.completed}/{card.checklist.total}
          </span>
          <div className="flex-1 bg-muted rounded-full h-1.5">
            <div 
              className="bg-success h-1.5 rounded-full transition-all"
              style={{ 
                width: `${(card.checklist.completed / card.checklist.total) * 100}%` 
              }}
            />
          </div>
        </div>
      )}

      {/* Bottom Section */}
      <div className="flex items-center justify-between">
        {/* Attachments & Comments */}
        <div className="flex items-center space-x-3">
          {localAttachments && localAttachments.length > 0 && (
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <Paperclip className="h-3 w-3" />
              <span>{localAttachments.length}</span>
            </div>
          )}
          
          {commentCount > 0 && (
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <MessageCircle className="h-3 w-3" />
              <span>{commentCount}</span>
            </div>
          )}

          {card.priority && (
            <div className={cn("flex items-center space-x-1 text-xs", getPriorityColor(card.priority))}>
              <Clock className="h-3 w-3" />
              <span className="capitalize">{getPriorityLabel(card.priority)}</span>
            </div>
          )}
        </div>

        {/* Assignees */}
        {assignees && assignees.length > 0 && (
          <div className="flex -space-x-2">
            {assignees.slice(0, 3).map((assignee) => {
              // Find the corresponding staff user to get display info
              const staffUser = staffUsers.find(su => su.id === assignee.id || su.discordId === assignee.id);
              const displayName = staffUser?.displayName || assignee.username;
              const avatarUrl = staffUser?.avatar
                ? `https://cdn.discordapp.com/avatars/${staffUser.discordId}/${staffUser.avatar}.png`
                : null;

              return (
                <Avatar key={assignee.id} className="h-6 w-6 border-2 border-card" title={displayName}>
                  {avatarUrl && (
                    <AvatarImage
                      src={avatarUrl}
                      alt={displayName}
                    />
                  )}
                  <AvatarFallback className="text-xs">
                    {displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              );
            })}
            {assignees.length > 3 && (
              <div className="h-6 w-6 rounded-full bg-muted border-2 border-card flex items-center justify-center">
                <span className="text-xs text-muted-foreground">
                  +{assignees.length - 3}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </CardDropZone>
  );
}