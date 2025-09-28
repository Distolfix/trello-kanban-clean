import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download, ExternalLink } from "lucide-react";

interface Attachment {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
  uploadDate: string;
  url: string;
}

interface AttachmentViewerProps {
  attachment: Attachment | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AttachmentViewer({ attachment, isOpen, onClose }: AttachmentViewerProps) {
  if (!attachment) return null;

  const downloadAttachment = () => {
    const link = document.createElement('a');
    link.href = attachment.url;
    link.download = attachment.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openInNewTab = () => {
    window.open(attachment.url, '_blank');
  };

  const renderPreview = () => {
    if (attachment.mimetype.startsWith('image/')) {
      return (
        <div className="flex justify-center items-center max-h-96 overflow-hidden bg-black/5 rounded-lg">
          <img
            src={attachment.url}
            alt={attachment.originalName}
            className="max-w-full max-h-96 object-contain"
          />
        </div>
      );
    }

    if (attachment.mimetype === 'application/pdf') {
      return (
        <div className="h-96 w-full">
          <iframe
            src={attachment.url}
            className="w-full h-full border-0 rounded-lg"
            title={attachment.originalName}
          />
        </div>
      );
    }

    if (attachment.mimetype.startsWith('text/')) {
      return (
        <div className="h-96 w-full">
          <iframe
            src={attachment.url}
            className="w-full h-full border-0 rounded-lg bg-white"
            title={attachment.originalName}
          />
        </div>
      );
    }

    if (attachment.mimetype.startsWith('video/')) {
      return (
        <div className="flex justify-center items-center">
          <video
            controls
            className="max-w-full max-h-96"
            src={attachment.url}
          />
        </div>
      );
    }

    if (attachment.mimetype.startsWith('audio/')) {
      return (
        <div className="flex justify-center items-center p-8">
          <audio
            controls
            className="w-full max-w-md"
            src={attachment.url}
          />
        </div>
      );
    }

    // Fallback for non-previewable files
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="text-4xl mb-4">📄</div>
        <p className="text-muted-foreground mb-4">
          Anteprima non disponibile per questo tipo di file
        </p>
        <Button onClick={downloadAttachment} className="mb-2">
          <Download className="h-4 w-4 mr-2" />
          Scarica file
        </Button>
        <Button variant="outline" onClick={openInNewTab}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Apri in nuova scheda
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold truncate">
              {attachment.originalName}
            </DialogTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadAttachment}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={openInNewTab}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Apri
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {attachment.mimetype} • {(attachment.size / 1024).toFixed(1)} KB • {new Date(attachment.uploadDate).toLocaleDateString('it-IT')}
          </div>
        </DialogHeader>

        <div className="mt-4 overflow-auto">
          {renderPreview()}
        </div>
      </DialogContent>
    </Dialog>
  );
}