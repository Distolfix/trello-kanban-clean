import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  Paperclip,
  CheckSquare,
  Clock,
  AlertTriangle,
  User as UserIcon,
  Edit,
  Trash2,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import type { KanbanCardData } from "./KanbanCard";
import { MemberSelector } from "./MemberSelector";
import { DueDateSelector } from "./DueDateSelector";
import { AttachmentManager } from "./AttachmentManager";
import { CardEditModal } from "./CardEditModal";
import { SimpleUpload } from "./SimpleUpload";
import { apiClient } from "@/api/client";
// Database imports removed for browser compatibility

interface CardDetailModalProps {
  card: KanbanCardData | null;
  isOpen: boolean;
  onClose: () => void;
  onCardUpdate?: (updatedCard: KanbanCardData) => void;
  onCardDelete?: (cardId: string) => void;
  userRole?: 'default' | 'mod' | 'admin';
  currentUserId?: string;
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
    default: return 'Non impostata';
  }
};

const isOverdue = (date?: Date) => {
  if (!date) return false;
  return date < new Date();
};

// Function to detect and make links clickable
const linkifyText = (text: string) => {
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
            e.stopPropagation(); // Prevent modal close when clicking link
          }}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

export function CardDetailModal({
  card,
  isOpen,
  onClose,
  onCardUpdate,
  onCardDelete,
  userRole = 'default',
  currentUserId
}: CardDetailModalProps) {
  const [members, setMembers] = useState<any[]>([]);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentCard, setCurrentCard] = useState<KanbanCardData | null>(null);

  // Removed complex comment management - now handled by SimpleTelegramComments

  useEffect(() => {
    if (card && isOpen) {

      // Simplified card loading - actions now handled by individual components
      setCurrentCard(card);

      // Initialize members from card data
      setMembers(card.members || []);
      setDueDate(card.dueDate ? new Date(card.dueDate) : null);
      setAttachments(card.attachments || []);
    }
  }, [card, isOpen]);

  if (!card || !currentCard) return null;

  const overdue = isOverdue(card.dueDate);
  const canEdit = userRole === 'admin';

  const handleCardUpdate = (updatedCard: KanbanCardData) => {
    setCurrentCard(updatedCard);
    onCardUpdate?.(updatedCard);
  };

  const handleMembersChange = (newMembers: any[]) => {
    const oldMembers = members || [];

    // Detect which members were added or removed
    const addedMembers = newMembers.filter(newMember =>
      !oldMembers.some(oldMember => oldMember.id === newMember.id)
    );
    const removedMembers = oldMembers.filter(oldMember =>
      !newMembers.some(newMember => newMember.id === oldMember.id)
    );

    setMembers(newMembers);

    // Update the card with new members
    const updatedCard = {
      ...currentCard,
      members: newMembers
    };
    setCurrentCard(updatedCard);
    onCardUpdate?.(updatedCard);


    toast({
      title: "Membri aggiornati",
      description: `Ora ${newMembers.length} membri assegnati alla card`
    });
  };


  const handleAttachmentsChange = (newAttachments: any[]) => {
    setAttachments(newAttachments);
    // Update the card with new attachments
    const updatedCard = {
      ...currentCard,
      attachments: newAttachments
    };
    setCurrentCard(updatedCard);
    onCardUpdate?.(updatedCard);
  };

  const handleCardDelete = async () => {
    try {
      onCardDelete?.(card.id);
      onClose();
    } catch (error) {
      console.error('Error deleting card:', error);
      toast({
        title: "Errore",
        description: "Errore durante l'eliminazione della card",
        variant: "destructive"
      });
    }
  };

  // Comment handling now managed by SimpleTelegramComments component

  const handleImageUploaded = async (imageUrl: string) => {
    // Refresh the card data to include the new attachment
    if (onCardUpdate) {
      // The attachment should already be added by the DropzoneUpload component
      // We just need to trigger a refresh
      const updatedCard = { ...currentCard };
      onCardUpdate(updatedCard);
    }
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <SimpleUpload
        cardId={currentCard.id}
        onImageUploaded={handleImageUploaded}
        className="w-full h-full group"
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">{linkifyText(currentCard.title)}</DialogTitle>
          <DialogDescription>
            Dettagli e gestione della scheda Kanban
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Labels */}
            {(card.labels || []).length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Etichette</h4>
                <div className="flex flex-wrap gap-2">
                  {(card.labels || []).map((label) => (
                    <Badge 
                      key={label.id}
                      className="px-3 py-1"
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
              </div>
            )}

            {/* Description */}
            <div>
              <h4 className="text-sm font-medium mb-2">Descrizione</h4>
              <div className="bg-muted/50 rounded-lg p-4 min-h-[100px]">
                {card.description ? (
                  <p className="text-sm">{linkifyText(card.description)}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Aggiungi una descrizione...
                  </p>
                )}
              </div>
            </div>


            {/* Checklist */}
            {card.checklist && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium">
                    Checklist ({card.checklist.completed}/{card.checklist.total})
                  </h4>
                  <div className="text-xs text-muted-foreground">
                    {Math.round((card.checklist.completed / card.checklist.total) * 100)}% completato
                  </div>
                </div>
                <div className="bg-muted rounded-full h-2 mb-4">
                  <div 
                    className="bg-success h-2 rounded-full transition-all"
                    style={{ 
                      width: `${(card.checklist.completed / card.checklist.total) * 100}%` 
                    }}
                  />
                </div>
                {/* Mock checklist items */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <CheckSquare className="h-4 w-4 text-success" />
                    <span className="text-sm line-through text-muted-foreground">Configurare ambiente sviluppo</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckSquare className="h-4 w-4 text-success" />
                    <span className="text-sm line-through text-muted-foreground">Creare componenti base</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 border-2 border-muted rounded-sm"></div>
                    <span className="text-sm">Implementare drag & drop</span>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            {canEdit && (
              <div>
                <h4 className="text-sm font-medium mb-3">Azioni</h4>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setIsEditModalOpen(true)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Modifica
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-destructive hover:text-destructive"
                    onClick={handleCardDelete}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Elimina
                  </Button>
                </div>
              </div>
            )}

            {/* Members */}
            <MemberSelector
              cardId={card.id}
              currentMembers={members}
              onMembersChange={handleMembersChange}
              canEdit={canEdit}
              currentUserId={currentUserId}
            />

            {/* Due Date */}
            <DueDateSelector
              cardId={card.id}
              currentDueDate={dueDate}
              onDueDateChange={(newDate) => {
                setDueDate(newDate);
                // Update the card data with new due date
                const updatedCard = {
                  ...currentCard,
                  dueDate: newDate ? newDate.getTime() : undefined
                };
                setCurrentCard(updatedCard);
                onCardUpdate?.(updatedCard);
              }}
              canEdit={canEdit}
            />

            {/* Priority */}
            {card.priority && (
              <div>
                <h4 className="text-sm font-medium mb-2">Priorità</h4>
                <div className={cn("flex items-center space-x-2", getPriorityColor(card.priority))}>
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">{getPriorityLabel(card.priority)}</span>
                </div>
              </div>
            )}

            {/* Attachments */}
            <AttachmentManager
              cardId={card.id}
              currentAttachments={attachments}
              onAttachmentsChange={handleAttachmentsChange}
              canEdit={canEdit}
              currentUserId={currentUserId}
            />
          </div>

        </div>
      </DialogContent>
      </SimpleUpload>
    </Dialog>

    {/* Edit Modal */}
    <CardEditModal
      card={currentCard}
      isOpen={isEditModalOpen}
      onClose={() => setIsEditModalOpen(false)}
      onSave={handleCardUpdate}
    />
    </>
  );
}