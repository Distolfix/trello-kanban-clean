import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Paperclip, Upload, X, File, Download, Eye, Image, FileText, Video, Music, Clipboard } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { AttachmentViewer } from "./AttachmentViewer";

interface Attachment {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
  uploadDate: string;
  url: string;
}

interface AttachmentManagerProps {
  cardId: string;
  currentAttachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  canEdit: boolean;
  onActivityLog?: (action: any) => void; // Callback per loggare attività
  currentUserId?: string;
}

export function AttachmentManager({ cardId, currentAttachments, onAttachmentsChange, canEdit, onActivityLog, currentUserId }: AttachmentManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [isPasteReady, setIsPasteReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Function for chunked upload of large files
  const uploadFileInChunks = async (file: File): Promise<any> => {
    const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    if (file.size < 10 * 1024 * 1024) {
      // File is small, use regular upload
      return uploadSingleFile(file);
    }


    const uploadId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const chunks: Promise<any>[] = [];

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const chunkFormData = new FormData();
      chunkFormData.append('chunk', chunk);
      chunkFormData.append('chunkIndex', chunkIndex.toString());
      chunkFormData.append('totalChunks', totalChunks.toString());
      chunkFormData.append('uploadId', uploadId);
      chunkFormData.append('fileName', file.name);
      chunkFormData.append('fileSize', file.size.toString());

      chunks.push(
        fetch(`/api/cards/${cardId}/attachments/chunk`, {
          method: 'POST',
          body: chunkFormData,
        }).then(res => {
          if (!res.ok) throw new Error(`Chunk ${chunkIndex} failed`);
          return res.json();
        })
      );
    }

    // Upload chunks in parallel (max 3 at a time to avoid overwhelming)
    const results = [];
    for (let i = 0; i < chunks.length; i += 3) {
      const batch = chunks.slice(i, i + 3);
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);

      setUploadProgress((i + batch.length) / chunks.length * 100);
    }

    // Finalize the upload
    const finalizeResponse = await fetch(`/api/cards/${cardId}/attachments/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId, fileName: file.name, cardId })
    });

    if (!finalizeResponse.ok) {
      throw new Error('Failed to finalize upload');
    }

    return finalizeResponse.json();
  };

  // Function for single file upload (for small files)
  const uploadSingleFile = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('files', file);

    const response = await fetch(`/api/cards/${cardId}/attachments`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  };

  // Function to compress large images using canvas (no external dependencies)
  const compressImageIfNeeded = async (file: File): Promise<File> => {
    if (!file.type.startsWith('image/')) {
      return file; // Not an image, return as is
    }

    // Skip compression for files smaller than 5MB
    const maxSizeInMB = 5;
    if (file.size <= maxSizeInMB * 1024 * 1024) {
      return file; // Image is small enough, return as is
    }

    try {
      // Simple canvas-based compression without external dependencies
      return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
          // Calculate new dimensions (max 1920px)
          const maxWidth = 1920;
          const maxHeight = 1920;
          let { width, height } = img;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }

          canvas.width = width;
          canvas.height = height;

          // Draw and compress
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          }, file.type, 0.8); // 80% quality
        };

        img.onerror = () => resolve(file);
        img.src = URL.createObjectURL(file);
      });
    } catch (error) {
      return file;
    }
  };

  // Handle paste event for images
  const handlePaste = async (event: ClipboardEvent) => {
    if (!canEdit || uploading) return;

    const items = event.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          // Create a more descriptive filename
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const extension = file.type.split('/')[1] || 'png';
          const renamedFile = new File([file], `pasted-image-${timestamp}.${extension}`, {
            type: file.type
          });
          files.push(renamedFile);
        }
      }
    }

    if (files.length > 0) {
      event.preventDefault();
      toast({
        title: "Immagine incollata",
        description: `${files.length} immagine/i trovata/e negli appunti, caricamento in corso...`
      });
      await processFiles(files);
    }
  };

  // Setup paste event listener
  useEffect(() => {
    if (!canEdit) return;

    const handlePasteEvent = (e: ClipboardEvent) => handlePaste(e);
    document.addEventListener('paste', handlePasteEvent);

    return () => {
      document.removeEventListener('paste', handlePasteEvent);
    };
  }, [canEdit, uploading]);

  // Function to handle files from various sources (file input, paste, drag&drop)
  const processFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadingFiles([]);

    try {
      const formData = new FormData();

      // Process and compress files in parallel for speed

      const processPromises = Array.from(files).map(async (file, index) => {
        if (file.type.startsWith('image/') && file.size > 15 * 1024 * 1024) {
          toast({
            title: "Compressione immagine",
            description: `Comprimendo ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)...`,
          });
        }

        const processedFile = await compressImageIfNeeded(file);
        setUploadingFiles(prev => [...prev, processedFile.name]);
        return processedFile;
      });

      const processedFiles = await Promise.all(processPromises);

      // Check total size after compression
      const totalSize = processedFiles.reduce((sum, file) => sum + file.size, 0);
      const maxSize = 100 * 1024 * 1024; // Increased to 100MB

      if (totalSize > maxSize) {
        toast({
          title: "File troppo grandi",
          description: `I file selezionati (${(totalSize / 1024 / 1024).toFixed(1)}MB) superano il limite di 100MB`,
          variant: "destructive"
        });
        setUploading(false);
        return;
      }


      // Upload files in parallel using chunked upload for large files
      const uploadPromises = processedFiles.map(file => uploadFileInChunks(file));

      // Process uploads with a maximum of 2 parallel uploads to avoid overwhelming
      const allResults = [];
      for (let i = 0; i < uploadPromises.length; i += 2) {
        const batch = uploadPromises.slice(i, i + 2);
        const batchResults = await Promise.all(batch);
        allResults.push(...batchResults);
      }

      // Collect all new attachments
      const allNewAttachments = allResults.flatMap(result =>
        result.success ? result.data.attachments || [result.data] : []
      );


      if (allNewAttachments.length > 0) {
        const updatedAttachments = [...currentAttachments, ...allNewAttachments];
        onAttachmentsChange(updatedAttachments);

        // Log attachment activities
        allNewAttachments.forEach(attachment => {
          if (onActivityLog) {
            const action = {
              id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
              cardId: cardId,
              userId: currentUserId || 'system',
              username: currentUserId || 'Sistema',
              action: 'attachment_added',
              details: {
                fileName: attachment.originalName || attachment.filename,
                fileSize: attachment.size,
                fileType: attachment.mimetype
              },
              timestamp: Date.now()
            };
            onActivityLog(action);
          }
        });

        toast({
          title: "Upload Completato",
          description: `${allNewAttachments.length} file caricati con successo!`,
        });
      } else {
        throw new Error('Nessun file è stato caricato con successo');
      }
    } catch (error) {
      console.error('Error uploading attachments:', error);

      let errorMessage = "Impossibile caricare gli allegati. Riprova più tardi.";

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = "Upload timeout - il file potrebbe essere troppo grande. Prova con un file più piccolo.";
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = "Connessione persa durante l'upload. Verifica la connessione e riprova.";
        }
      }

      toast({
        title: "Errore Upload",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadingFiles([]);
    }
  };

  // Wrapper for file input
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    await processFiles(files);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = async (attachmentToRemove: Attachment) => {
    try {
      // Delete attachment from server
      const response = await fetch(`/api/cards/${cardId}/attachments/${attachmentToRemove.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove attachment');
      }

      const result = await response.json();
      if (result.success) {
        const updatedAttachments = currentAttachments.filter(att => att.id !== attachmentToRemove.id);
        onAttachmentsChange(updatedAttachments);

        // Log attachment deletion activity
        if (onActivityLog) {
          const action = {
            id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            cardId: cardId,
            userId: currentUserId || 'system',
            username: currentUserId || 'Sistema',
            action: 'attachment_deleted',
            details: {
              fileName: attachmentToRemove.originalName || attachmentToRemove.filename,
              fileSize: attachmentToRemove.size,
              fileType: attachmentToRemove.mimetype
            },
            timestamp: Date.now()
          };
          onActivityLog(action);
        }

        toast({
          title: "Allegato rimosso",
          description: "Allegato rimosso con successo"
        });
      } else {
        throw new Error(result.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Error removing attachment:', error);
      toast({
        title: "Errore",
        description: "Impossibile rimuovere l'allegato. Riprova più tardi.",
        variant: "destructive"
      });
    }
  };

  const downloadAttachment = (attachment: Attachment) => {
    // Create download link
    const link = document.createElement('a');
    link.href = attachment.url;
    link.download = attachment.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Log download activity
    if (onActivityLog) {
      const action = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        cardId: cardId,
        userId: currentUserId || 'system',
        username: currentUserId || 'Sistema',
        action: 'attachment_downloaded',
        details: {
          fileName: attachment.originalName || attachment.filename,
          fileSize: attachment.size,
          fileType: attachment.mimetype
        },
        timestamp: Date.now()
      };
      onActivityLog(action);
    }

    toast({
      title: "Download avviato",
      description: `Download di ${attachment.originalName} avviato`
    });
  };

  const viewAttachment = (attachment: Attachment) => {
    setSelectedAttachment(attachment);
    setViewerOpen(true);
  };

  const getFileIcon = (mimetype: string) => {
    if (mimetype.startsWith('image/')) return <Image className="h-4 w-4 text-blue-500" />;
    if (mimetype.startsWith('video/')) return <Video className="h-4 w-4 text-purple-500" />;
    if (mimetype.startsWith('audio/')) return <Music className="h-4 w-4 text-green-500" />;
    if (mimetype === 'application/pdf' || mimetype.includes('document')) return <FileText className="h-4 w-4 text-red-500" />;
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const canPreview = (mimetype: string) => {
    return mimetype.startsWith('image/') ||
           mimetype === 'application/pdf' ||
           mimetype.startsWith('text/');
  };

  if (currentAttachments.length === 0 && !canEdit) return null;

  return (
    <div>
      <h4 className="text-sm font-medium mb-2">
        Allegati {currentAttachments.length > 0 && `(${currentAttachments.length})`}
      </h4>

      {currentAttachments.length > 0 && (
        <div className="space-y-2 mb-3">
          {currentAttachments.map((attachment) => (
            <div key={attachment.id} className="bg-muted/50 rounded-lg border overflow-hidden">
              {/* Image Preview */}
              {attachment.mimetype.startsWith('image/') && (
                <div className="relative">
                  <img
                    src={attachment.url}
                    alt={attachment.originalName}
                    className="w-full h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => viewAttachment(attachment)}
                    onError={(e) => {
                      // Hide image if it fails to load
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2">
                    <div className="text-white text-xs font-medium truncate bg-black/50 px-2 py-1 rounded">
                      {attachment.originalName}
                    </div>
                  </div>
                  <div className="absolute top-2 right-2 flex space-x-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadAttachment(attachment);
                      }}
                      className="h-auto p-1 bg-black/50 hover:bg-black/70 border-0"
                      title="Download"
                    >
                      <Download className="h-3 w-3 text-white" />
                    </Button>
                    {canEdit && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAttachment(attachment);
                        }}
                        className="h-auto p-1 bg-red-500/80 hover:bg-red-600/80 border-0"
                        title="Rimuovi"
                      >
                        <X className="h-3 w-3 text-white" />
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Non-Image Attachments */}
              {!attachment.mimetype.startsWith('image/') && (
                <div className="flex items-center justify-between space-x-2 p-3">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {getFileIcon(attachment.mimetype)}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" title={attachment.originalName}>
                        {attachment.originalName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatFileSize(attachment.size)} • {new Date(attachment.uploadDate).toLocaleDateString('it-IT')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    {canPreview(attachment.mimetype) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewAttachment(attachment)}
                        className="h-auto p-1"
                        title="Visualizza"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadAttachment(attachment)}
                      className="h-auto p-1"
                      title="Download"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(attachment)}
                        className="h-auto p-1 text-destructive hover:text-destructive"
                        title="Rimuovi"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Small info bar for images */}
              {attachment.mimetype.startsWith('image/') && (
                <div className="px-3 py-2 border-t bg-muted/30">
                  <div className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.size)} • {new Date(attachment.uploadDate).toLocaleDateString('it-IT')}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="space-y-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            className="hidden"
          />

          <div className="grid grid-cols-1 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full justify-start"
            >
              <Upload className={`h-4 w-4 mr-2 ${uploading ? 'animate-spin' : ''}`} />
              {uploading ? 'Caricamento in corso...' : 'Carica file'}
            </Button>

            <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border border-dashed">
              <div className="flex items-center space-x-1 mb-1">
                <Clipboard className="h-3 w-3" />
                <span className="font-medium">Suggerimento:</span>
              </div>
              <div>Puoi anche incollare immagini direttamente con <kbd className="px-1 py-0.5 bg-muted text-xs rounded">Ctrl+V</kbd></div>
            </div>
          </div>
          {uploading && (
            <div className="mt-2 space-y-2">
              <div className="text-xs text-muted-foreground">
                Upload in corso... {uploadProgress > 0 && `${Math.round(uploadProgress)}%`}
              </div>
              {uploadProgress > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              )}
              {uploadingFiles.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  File in elaborazione: {uploadingFiles.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Attachment Viewer */}
      <AttachmentViewer
        attachment={selectedAttachment}
        isOpen={viewerOpen}
        onClose={() => {
          setViewerOpen(false);
          setSelectedAttachment(null);
        }}
      />
    </div>
  );
}