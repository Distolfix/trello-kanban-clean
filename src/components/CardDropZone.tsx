import { useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Upload, Image, CheckCircle, AlertCircle } from 'lucide-react';

interface CardDropZoneProps {
  cardId: string;
  onImageUploaded?: (attachmentData: any) => void;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}

interface UploadState {
  isUploading: boolean;
  progress: number;
  filename: string;
  status: 'uploading' | 'success' | 'error';
}

export function CardDropZone({
  cardId,
  onImageUploaded,
  className,
  children,
  disabled = false
}: CardDropZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState | null>(null);

  // Compress image if needed (lightweight version)
  const compressImage = useCallback(async (file: File): Promise<File> => {
    if (!file.type.startsWith('image/') || file.size <= 2 * 1024 * 1024) {
      return file; // Return as-is if not image or small file
    }

    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate dimensions (max 1200px for cards)
        const maxSize = 1200;
        let { width, height } = img;

        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else {
            width = (width * maxSize) / height;
            height = maxSize;
          }
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
        }, file.type, 0.85); // 85% quality
      };

      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  }, []);

  // Upload file to server
  const uploadFile = useCallback(async (file: File) => {
    const processedFile = await compressImage(file);

    const formData = new FormData();
    formData.append('files', processedFile);

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

    return result.data.attachments?.[0] || result.data;
  }, [cardId, compressImage]);

  // Process dropped files
  const processFiles = useCallback(async (files: FileList | File[]) => {
    if (disabled || files.length === 0) return;

    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      toast({
        title: "Formato non supportato",
        description: "Trascina solo immagini (JPG, PNG, GIF, SVG, WebP)",
        variant: "destructive"
      });
      return;
    }

    // Process only the first image for cards
    const file = imageFiles[0];

    setUploadState({
      isUploading: true,
      progress: 0,
      filename: file.name,
      status: 'uploading'
    });

    try {
      // Simulate progress
      setUploadState(prev => prev ? { ...prev, progress: 30 } : null);

      const uploadedAttachment = await uploadFile(file);

      setUploadState(prev => prev ? { ...prev, progress: 100, status: 'success' } : null);

      // Notify parent component
      onImageUploaded?.(uploadedAttachment);

      toast({
        title: "✅ Immagine caricata",
        description: `${file.name} aggiunta alla card!`
      });

      // Clear upload state after delay
      setTimeout(() => {
        setUploadState(null);
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);

      setUploadState(prev => prev ? { ...prev, status: 'error' } : null);

      toast({
        title: "❌ Errore upload",
        description: error instanceof Error ? error.message : "Impossibile caricare l'immagine",
        variant: "destructive"
      });

      // Clear error state after delay
      setTimeout(() => {
        setUploadState(null);
      }, 3000);
    }
  }, [disabled, uploadFile, onImageUploaded]);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    // Check if dragged items contain images
    const hasImages = Array.from(e.dataTransfer.items).some(item =>
      item.type.startsWith('image/')
    );

    if (hasImages) {
      setIsDragActive(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only disable if really leaving the card
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragActive(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    // Enable drop effect
    e.dataTransfer.dropEffect = 'copy';
  }, [disabled]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragActive(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  }, [disabled, processFiles]);

  return (
    <div
      className={cn("relative group", className)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* Upload Progress Indicator */}
      {uploadState && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm rounded-lg flex items-center justify-center">
          <div className="bg-card border rounded-lg p-4 shadow-lg text-center min-w-[200px]">
            <div className="flex items-center justify-center mb-2">
              {uploadState.status === 'uploading' && (
                <Upload className="h-6 w-6 text-blue-500 animate-pulse" />
              )}
              {uploadState.status === 'success' && (
                <CheckCircle className="h-6 w-6 text-green-500" />
              )}
              {uploadState.status === 'error' && (
                <AlertCircle className="h-6 w-6 text-red-500" />
              )}
            </div>

            <div className="text-sm font-medium mb-1">
              {uploadState.status === 'uploading' && 'Caricamento...'}
              {uploadState.status === 'success' && 'Completato!'}
              {uploadState.status === 'error' && 'Errore'}
            </div>

            <div className="text-xs text-muted-foreground mb-2 truncate">
              {uploadState.filename}
            </div>

            {uploadState.status === 'uploading' && (
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadState.progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Drag Active Overlay */}
      {isDragActive && !uploadState && (
        <div className="absolute inset-0 z-40 border-2 border-dashed border-blue-500 rounded-lg bg-blue-500/10 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center p-4">
            <div className="flex items-center justify-center mb-2">
              <Image className="h-8 w-8 text-blue-500" />
              <Upload className="h-6 w-6 text-blue-500 ml-1 animate-bounce" />
            </div>
            <div className="font-medium text-blue-700">
              Rilascia qui l'immagine
            </div>
            <div className="text-xs text-blue-600 mt-1">
              Sarà aggiunta come allegato alla card
            </div>
          </div>
        </div>
      )}
    </div>
  );
}