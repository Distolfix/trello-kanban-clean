import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Image } from "lucide-react";

interface BoardSettings {
  title: string;
  logo: string;
  favicon: string;
}

interface BoardSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: BoardSettings) => void;
  currentSettings: BoardSettings;
}

export function BoardSettingsModal({
  isOpen,
  onClose,
  onSave,
  currentSettings
}: BoardSettingsModalProps) {
  const [title, setTitle] = useState(currentSettings.title);
  const [logo, setLogo] = useState(currentSettings.logo || "");
  const [favicon, setFavicon] = useState(currentSettings.favicon || "");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file type
      if (!file.type.startsWith('image/')) {
        alert('Per favore seleziona un file immagine valido');
        return;
      }

      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('Il file deve essere inferiore a 2MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setLogo(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFaviconUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file type
      if (!file.type.startsWith('image/')) {
        alert('Per favore seleziona un file immagine valido');
        return;
      }

      // Check file size (max 1MB for favicon)
      if (file.size > 1024 * 1024) {
        alert('Il favicon deve essere inferiore a 1MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setFavicon(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!title.trim()) {
      alert('Il titolo della board è obbligatorio');
      return;
    }

    onSave({
      title: title.trim(),
      logo: logo,
      favicon: favicon
    });
    onClose();
  };

  const handleCancel = () => {
    setTitle(currentSettings.title);
    setLogo(currentSettings.logo || "");
    setFavicon(currentSettings.favicon || "");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Impostazioni Board</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Board Title */}
          <div className="space-y-2">
            <Label htmlFor="board-title">Titolo Board</Label>
            <Input
              id="board-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Inserisci il titolo della board..."
              maxLength={100}
            />
          </div>

          {/* Logo Upload */}
          <div className="space-y-2">
            <Label>Logo Board</Label>
            <div className="space-y-3">
              {logo && (
                <div className="relative inline-block">
                  <img
                    src={logo}
                    alt="Logo preview"
                    className="w-20 h-20 object-contain border rounded-md"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2 w-6 h-6 p-0"
                    onClick={() => {
                      if (confirm('Sei sicuro di voler rimuovere il logo?')) {
                        setLogo("");
                      }
                    }}
                    title="Rimuovi logo"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {logo ? 'Cambia Logo' : 'Carica Logo'}
                </Button>
                {logo && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm('Sei sicuro di voler rimuovere il logo?')) {
                        setLogo("");
                      }
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Rimuovi
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">
                  PNG, JPG, SVG • Max 2MB
                </span>
              </div>

              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Favicon Upload */}
          <div className="space-y-2">
            <Label>Favicon</Label>
            <div className="space-y-3">
              {favicon && (
                <div className="relative inline-block">
                  <img
                    src={favicon}
                    alt="Favicon preview"
                    className="w-8 h-8 object-contain border rounded-md"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2 w-4 h-4 p-0"
                    onClick={() => {
                      if (confirm('Sei sicuro di voler rimuovere il favicon? Verrà ripristinato quello predefinito.')) {
                        setFavicon("");
                      }
                    }}
                    title="Rimuovi favicon (ripristina predefinito)"
                  >
                    <X className="h-2 w-2" />
                  </Button>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => faviconInputRef.current?.click()}
                >
                  <Image className="h-4 w-4 mr-2" />
                  {favicon ? 'Cambia Favicon' : 'Carica Favicon'}
                </Button>
                {favicon && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm('Sei sicuro di voler rimuovere il favicon? Verrà ripristinato quello predefinito.')) {
                        setFavicon("");
                      }
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Ripristina
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">
                  ICO, PNG • Max 1MB • 16x16 o 32x32 px
                </span>
              </div>

              <input
                ref={faviconInputRef}
                type="file"
                accept="image/*,.ico"
                onChange={handleFaviconUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={handleCancel}>
            Annulla
          </Button>
          <Button onClick={handleSave}>
            Salva Impostazioni
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}