import { ReactNode, useEffect, useState } from "react";
import {
  Edit,
  Copy,
  Trash2,
  Archive,
  Eye,
  EyeOff,
  Lock,
  Users,
  Calendar,
  Tag,
  User,
  Clock,
  Download,
  ArrowUpDown,
  Hash
} from "lucide-react";

interface ContextMenuItem {
  id: string;
  label: string;
  icon: ReactNode;
  action: () => void;
  disabled?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  visible: boolean;
}

export function ContextMenu({ x, y, items, onClose, visible }: ContextMenuProps) {
  useEffect(() => {
    if (visible) {
      const handleClick = () => onClose();
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };

      document.addEventListener('click', handleClick);
      document.addEventListener('keydown', handleEscape);

      return () => {
        document.removeEventListener('click', handleClick);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-50" 
        onClick={onClose}
      />
      <div
        className="fixed z-50 bg-surface border border-border rounded-lg shadow-lg py-1 min-w-[200px]"
        style={{
          left: x,
          top: y,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((item) => (
          <div key={item.id}>
            {item.separator && <div className="h-px bg-border my-1" />}
            <button
              className={`
                w-full flex items-center space-x-2 px-3 py-2 text-sm text-left
                hover:bg-surface-hover transition-colors
                ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              onClick={() => {
                if (!item.disabled) {
                  item.action();
                  onClose();
                }
              }}
              disabled={item.disabled}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

// Hook for managing context menus
export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
    visible: boolean;
  }>({
    x: 0,
    y: 0,
    items: [],
    visible: false,
  });

  const showContextMenu = (
    event: React.MouseEvent,
    items: ContextMenuItem[]
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const { pageX, pageY } = event;
    setContextMenu({
      x: pageX,
      y: pageY,
      items,
      visible: true,
    });
  };

  const hideContextMenu = () => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  return {
    contextMenu,
    showContextMenu,
    hideContextMenu,
  };
}

// Predefined context menu items generators
export const getCardContextMenuItems = (
  cardId: string,
  userRole: 'default' | 'mod' | 'admin',
  onEdit: (id: string) => void,
  onDelete: (id: string) => void,
  onCopy: (id: string) => void,
  onArchive: (id: string) => void,
  onAssign: (id: string) => void,
  onSetDueDate: (id: string) => void,
  onAddLabel: (id: string) => void
): ContextMenuItem[] => {
  const canEdit = userRole === 'admin' || userRole === 'mod';

  // Per utenti default, solo visualizzazione (come guest)
  if (userRole === 'default') {
    return []; // Nessuna azione disponibile, solo visualizzazione
  }

  return [
    {
      id: 'edit',
      label: 'Modifica card',
      icon: <Edit className="h-4 w-4" />,
      action: () => onEdit(cardId),
      disabled: !canEdit,
    },
    {
      id: 'copy',
      label: 'Copia card',
      icon: <Copy className="h-4 w-4" />,
      action: () => onCopy(cardId),
    },
    {
      id: 'separator1',
      label: '',
      icon: null,
      action: () => {},
      separator: true,
    },
    {
      id: 'assign',
      label: 'Assegna membro',
      icon: <User className="h-4 w-4" />,
      action: () => onAssign(cardId),
      disabled: !canEdit,
    },
    {
      id: 'duedate',
      label: 'Imposta scadenza',
      icon: <Calendar className="h-4 w-4" />,
      action: () => onSetDueDate(cardId),
      disabled: !canEdit,
    },
    {
      id: 'label',
      label: 'Aggiungi etichetta',
      icon: <Tag className="h-4 w-4" />,
      action: () => onAddLabel(cardId),
      disabled: !canEdit,
    },
    {
      id: 'separator2',
      label: '',
      icon: null,
      action: () => {},
      separator: true,
    },
    {
      id: 'archive',
      label: 'Archivia',
      icon: <Archive className="h-4 w-4" />,
      action: () => onArchive(cardId),
      disabled: !canEdit,
    },
    {
      id: 'delete',
      label: 'Elimina',
      icon: <Trash2 className="h-4 w-4" />,
      action: () => onDelete(cardId),
      disabled: !canEdit,
    },
  ];
};

export const getListContextMenuItems = (
  listId: string,
  listType: 'open' | 'closed' | 'hidden',
  userRole: 'default' | 'mod' | 'admin',
  onEdit: (id: string) => void,
  onCopy: (id: string) => void,
  onArchive: (id: string) => void,
  onChangeVisibility: (id: string, type: 'open' | 'closed' | 'hidden') => void,
  onDelete?: (id: string) => void,
  onExport?: (id: string) => void,
  onSort?: (id: string) => void,
  onSetLimit?: (id: string) => void
): ContextMenuItem[] => {
  // Admin può fare tutto, mod può fare tutto tranne modificare visibilità
  const canEdit = userRole === 'admin' || userRole === 'mod';
  const canChangeVisibility = userRole === 'admin';

  // Per utenti default, solo visualizzazione (come guest)
  if (userRole === 'default') {
    return []; // Nessuna azione disponibile, solo visualizzazione
  }

  const items: ContextMenuItem[] = [
    {
      id: 'edit',
      label: 'Modifica lista',
      icon: <Edit className="h-4 w-4" />,
      action: () => onEdit(listId),
      disabled: !canEdit,
    },
    {
      id: 'copy',
      label: 'Copia lista',
      icon: <Copy className="h-4 w-4" />,
      action: () => onCopy(listId),
    }
  ];

  if (canChangeVisibility) {
    items.push(
      {
        id: 'separator1',
        label: '',
        icon: null,
        action: () => {},
        separator: true,
      },
      {
        id: 'visibility-open',
        label: 'Rendi aperta',
        icon: <Eye className="h-4 w-4" />,
        action: () => onChangeVisibility(listId, 'open'),
        disabled: listType === 'open',
      },
      {
        id: 'visibility-closed',
        label: 'Rendi staff-only',
        icon: <Lock className="h-4 w-4" />,
        action: () => onChangeVisibility(listId, 'closed'),
        disabled: listType === 'closed',
      },
      {
        id: 'visibility-hidden',
        label: 'Rendi nascosta',
        icon: <EyeOff className="h-4 w-4" />,
        action: () => onChangeVisibility(listId, 'hidden'),
        disabled: listType === 'hidden',
      }
    );
  }

  items.push(
    {
      id: 'separator2',
      label: '',
      icon: null,
      action: () => {},
      separator: true,
    }
  );

  // Add export option for all users
  if (onExport) {
    items.push({
      id: 'export',
      label: 'Esporta lista',
      icon: <Download className="h-4 w-4" />,
      action: () => onExport(listId),
    });
  }

  // Add sort and limit options for admins
  if (canEdit) {
    if (onSort) {
      items.push({
        id: 'sort',
        label: 'Ordina card per...',
        icon: <ArrowUpDown className="h-4 w-4" />,
        action: () => onSort(listId),
      });
    }

    if (onSetLimit) {
      items.push({
        id: 'setlimit',
        label: 'Imposta limite card',
        icon: <Hash className="h-4 w-4" />,
        action: () => onSetLimit(listId),
      });
    }
  }

  // Add delete and archive options for admins
  if (canEdit) {
    items.push(
      {
        id: 'archive',
        label: 'Archivia lista',
        icon: <Archive className="h-4 w-4" />,
        action: () => onArchive(listId),
      }
    );

    if (onDelete) {
      items.push({
        id: 'delete',
        label: 'Elimina lista',
        icon: <Trash2 className="h-4 w-4" />,
        action: () => onDelete(listId),
      });
    }
  }

  return items;
};