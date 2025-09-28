import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// Calendar and date dependencies removed for browser compatibility
import {
  Calendar as CalendarIcon,
  Tag,
  User,
  Clock,
  Plus,
  X,
  AlertTriangle,
  CheckSquare,
  Paperclip,
  MessageCircle,
  MoreHorizontal,
  Trash2,
  Copy,
  Archive
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { KanbanCardData } from "./KanbanCard";

interface CardManagementModalProps {
  card: KanbanCardData | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedCard: KanbanCardData) => void;
  onDelete?: (cardId: string) => void;
  userRole?: 'default' | 'mod' | 'admin';
}

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'Alta Priorità', color: 'text-destructive' },
  { value: 'medium', label: 'Media Priorità', color: 'text-warning' },
  { value: 'low', label: 'Bassa Priorità', color: 'text-success' },
];

const LABEL_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
];

export function CardManagementModal({
  card,
  isOpen,
  onClose,
  onSave,
  onDelete,
  userRole = 'default'
}: CardManagementModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [labels, setLabels] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (card && isOpen) {
      setTitle(card.title);
      setDescription(card.description || "");
      setPriority(card.priority || "");
      setDueDate(card.dueDate ? new Date(card.dueDate) : undefined);
      setLabels(card.labels || []);
    }
  }, [card, isOpen]);

  if (!card) return null;

  const handleSave = async () => {
    if (!title.trim()) return;

    setSaving(true);
    try {
      const updatedCard: KanbanCardData = {
        ...card,
        title: title.trim(),
        description: description.trim() || undefined,
        priority: priority || undefined,
        dueDate,
        labels
      };

      onSave(updatedCard);
      onClose();
    } catch (error) {
      console.error('Error updating card:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    onDelete?.(card.id);
    onClose();
  };

  const addLabel = () => {
    if (!newLabelName.trim()) return;

    const newLabel = {
      id: `label-${Date.now()}`,
      name: newLabelName.trim(),
      color: newLabelColor
    };

    setLabels([...labels, newLabel]);
    setNewLabelName("");
  };

  const removeLabel = (labelId: string) => {
    setLabels(labels.filter(label => label.id !== labelId));
  };

  const canEdit = userRole === 'admin' || userRole === 'mod';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Gestione Card</DialogTitle>
            <DialogDescription>
              Gestisci le impostazioni e le proprietà di questa card.
            </DialogDescription>
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {}}>
                    <Copy className="mr-2 h-4 w-4" />
                    Duplica Card
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {}}>
                    <Archive className="mr-2 h-4 w-4" />
                    Archivia Card
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Elimina Card
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="card-title">Titolo*</Label>
              <Input
                id="card-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Inserisci il titolo della card"
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="card-description">Descrizione</Label>
              <Textarea
                id="card-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Inserisci la descrizione della card"
                rows={4}
                disabled={!canEdit}
              />
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>Priorità</Label>
            <Select value={priority} onValueChange={setPriority} disabled={!canEdit}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona priorità" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nessuna priorità</SelectItem>
                {PRIORITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center space-x-2">
                      <Clock className={cn("h-3 w-3", option.color)} />
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label>Scadenza</Label>
            <div className="flex space-x-2">
              <Input
                type="date"
                value={dueDate ? dueDate.toISOString().split('T')[0] : ''}
                onChange={(e) => setDueDate(e.target.value ? new Date(e.target.value) : undefined)}
                disabled={!canEdit}
                className="flex-1"
              />
              {dueDate && canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDueDate(undefined)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Labels */}
          <div className="space-y-3">
            <Label>Etichette</Label>

            {/* Existing Labels */}
            <div className="flex flex-wrap gap-2">
              {labels.map((label) => (
                <Badge
                  key={label.id}
                  className="text-xs px-2 py-1"
                  style={{
                    backgroundColor: label.color + '20',
                    color: label.color,
                    border: `1px solid ${label.color}40`
                  }}
                >
                  {label.name}
                  {canEdit && (
                    <button
                      onClick={() => removeLabel(label.id)}
                      className="ml-1 hover:bg-black/10 rounded"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>

            {/* Add New Label */}
            {canEdit && (
              <div className="flex space-x-2">
                <Input
                  placeholder="Nuova etichetta"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addLabel()}
                  className="flex-1"
                />
                <Select value={newLabelColor} onValueChange={setNewLabelColor}>
                  <SelectTrigger className="w-20">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: newLabelColor }}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {LABEL_COLORS.map((color) => (
                      <SelectItem key={color} value={color}>
                        <div
                          className="w-4 h-4 rounded border"
                          style={{ backgroundColor: color }}
                        />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={addLabel} size="icon" variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Card Stats */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-2 text-sm">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <span>Allegati: {card.attachments || 0}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <span>Commenti: {card.comments || 0}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
              <span>
                Checklist: {card.checklist ? `${card.checklist.completed}/${card.checklist.total}` : 'Nessuna'}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>Assegnati: {card.assignees?.length || 0}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              {canEdit ? 'Annulla' : 'Chiudi'}
            </Button>
            {canEdit && (
              <Button onClick={handleSave} disabled={!title.trim() || saving}>
                {saving ? 'Salvataggio...' : 'Salva modifiche'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}