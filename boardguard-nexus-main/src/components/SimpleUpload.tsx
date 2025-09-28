import { useCallback, useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Upload, X } from 'lucide-react';

interface SimpleUploadProps {
  cardId: string;
  onImageUploaded?: (imageUrl: string) => void;
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
}

interface UploadProgress {
  filename: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
}

export function SimpleUpload({
  cardId,
  onImageUploaded,
  className,
  children,
  disabled = false
}: SimpleUploadProps) {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('files', file);

    const response = await fetch(`/api/cards/${cardId}/attachments`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Upload failed: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Upload failed');
    }

    const uploadedUrl = result.data?.attachments?.[0]?.url || result.data?.attachments?.[0]?.filename || '';

    if (!uploadedUrl) {
      console.error('Upload response:', result);
      throw new Error('No URL returned from upload');
    }

    return uploadedUrl;
  }, [cardId]);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    if (disabled || files.length === 0) return;

    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      toast({
        title: "Nessuna immagine",
        description: "Nessun file immagine trovato",
        variant: "destructive"
      });
      return;
    }

    for (const file of imageFiles) {
      const uploadProgress: UploadProgress = {
        filename: file.name,
        progress: 0,
        status: 'uploading'
      };

      setUploads(prev => [...prev, uploadProgress]);
      const uploadIndex = uploads.length;

      try {
        // Update progress
        setUploads(prev => prev.map((upload, idx) =>
          idx === uploadIndex ? { ...upload, progress: 50 } : upload
        ));

        const imageUrl = await uploadFile(file);

        // Mark as complete
        setUploads(prev => prev.map((upload, idx) =>
          idx === uploadIndex ? {
            ...upload,
            progress: 100,
            status: 'success' as const
          } : upload
        ));

        // Notify parent component
        onImageUploaded?.(imageUrl);

        toast({
          title: "Immagine caricata",
          description: `${file.name} è stata caricata con successo`
        });

        // Remove from uploads after delay
        setTimeout(() => {
          setUploads(prev => prev.filter((_, idx) => idx !== uploadIndex));
        }, 3000);

      } catch (error) {
        console.error('Upload error:', error);

        // Mark as error
        setUploads(prev => prev.map((upload, idx) =>
          idx === uploadIndex ? {
            ...upload,
            status: 'error' as const
          } : upload
        ));

        toast({
          title: "Errore caricamento",
          description: error instanceof Error ? error.message : "Errore durante il caricamento dell'immagine",
          variant: "destructive"
        });

        // Remove from uploads after delay
        setTimeout(() => {
          setUploads(prev => prev.filter((_, idx) => idx !== uploadIndex));
        }, 5000);
      }
    }
  }, [disabled, uploads.length, uploadFile, onImageUploaded]);

  // Handle paste events
  const handlePaste = useCallback((event: ClipboardEvent) => {
    if (disabled) return;

    const items = event.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      event.preventDefault();
      processFiles(files);
    }
  }, [disabled, processFiles]);

  // Handle drag and drop
  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragActive(false);

    if (disabled) return;

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  }, [disabled, processFiles]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    // Only set to false if we're leaving the container completely
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragActive(false);
    }
  }, []);

  // Add global paste listener
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => handlePaste(e);
    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, [handlePaste]);

  const removeUpload = useCallback((index: number) => {
    setUploads(prev => prev.filter((_, idx) => idx !== index));
  }, []);

  return (
    <div
      className={cn("relative group", className)}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      {children}

      {/* Upload Progress */}
      {uploads.length > 0 && (
        <div className="absolute top-2 right-2 z-50 space-y-1">
          {uploads.map((upload, index) => (
            <div
              key={`${upload.filename}-${index}`}
              className="bg-card border rounded-lg p-2 shadow-lg min-w-[200px]"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="truncate max-w-[120px]">{upload.filename}</span>
                <button
                  onClick={() => removeUpload(index)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              <div className="mt-1">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className={cn(
                    upload.status === 'success' && "text-green-500",
                    upload.status === 'error' && "text-red-500",
                    upload.status === 'uploading' && "text-blue-500"
                  )}>
                    {upload.status === 'uploading' && 'Caricamento...'}
                    {upload.status === 'success' && 'Completato'}
                    {upload.status === 'error' && 'Errore'}
                  </span>
                  {upload.status === 'uploading' && <span>{upload.progress}%</span>}
                </div>

                {upload.status === 'uploading' && (
                  <div className="w-full bg-muted rounded-full h-1">
                    <div
                      className="bg-primary h-1 rounded-full transition-all duration-300"
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drag & Drop Overlay */}
      {isDragActive && (
        <div className="absolute inset-0 z-40 border-2 border-dashed border-primary rounded-lg flex items-center justify-center bg-primary/10 backdrop-blur-sm">
          <div className="text-center p-6">
            <Upload className="h-12 w-12 mx-auto mb-4 text-primary" />
            <div className="text-lg font-medium mb-2">
              Rilascia qui le immagini
            </div>
            <div className="text-sm text-muted-foreground">
              Supporta JPG, PNG, GIF, SVG, WebP
            </div>
          </div>
        </div>
      )}

      {/* Paste Hint */}
      {!isDragActive && !disabled && uploads.length === 0 && (
        <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
          Ctrl+V per incollare
        </div>
      )}
    </div>
  );
}