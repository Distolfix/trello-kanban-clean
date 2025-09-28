import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import type { KanbanCardData } from "./KanbanCard";

interface CardEditModalProps {
  card: KanbanCardData | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedCard: KanbanCardData) => void;
}

export function CardEditModal({ card, isOpen, onClose, onSave }: CardEditModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (card && isOpen) {
      setTitle(card.title);
      setDescription(card.description || "");
    }
  }, [card, isOpen]);

  if (!card) return null;

  const handleSave = async () => {
    if (!title.trim()) return;

    setSaving(true);
    try {
      // Database call removed for browser compatibility
      const cardData: KanbanCardData = {
        ...card,
        title: title.trim(),
        description: description.trim() || undefined
      };
      onSave(cardData);
      onClose();
    } catch (error) {
      console.error('Error updating card:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setTitle(card.title);
    setDescription(card.description || "");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifica Card</DialogTitle>
          <DialogDescription>
            Modifica il titolo e la descrizione della card
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="card-title">Titolo</Label>
            <Input
              id="card-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Inserisci il titolo della card"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="card-description">Descrizione</Label>
            <Textarea
              id="card-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Inserisci la descrizione della card (opzionale)"
              rows={4}
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={handleCancel} disabled={saving}>
            Annulla
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || saving}
          >
            {saving ? 'Salvataggio...' : 'Salva'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}