import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DiscordStatus } from "@/components/ui/discord-status";
import {
  History,
  ArrowRight,
  Edit3,
  Trash2,
  RotateCcw,
  UserPlus,
  UserMinus,
  MessageCircle,
  Calendar,
  Tag,
  Plus,
  Paperclip,
  FileText,
  Download
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import type { CardAction } from "./KanbanCard";
import { useStaffUsers } from "@/hooks/useStaffUsers";
import { useMemo } from "react";

interface CardHistoryProps {
  actions?: CardAction[];
  className?: string;
}

const getActionIcon = (action: CardAction['action']) => {
  switch (action) {
    case 'created': return <Plus className="h-3 w-3" />;
    case 'moved': return <ArrowRight className="h-3 w-3" />;
    case 'edited': return <Edit3 className="h-3 w-3" />;
    case 'title_changed': return <Edit3 className="h-3 w-3" />;
    case 'description_changed': return <Edit3 className="h-3 w-3" />;
    case 'priority_changed': return <Tag className="h-3 w-3" />;
    case 'deleted': return <Trash2 className="h-3 w-3" />;
    case 'restored': return <RotateCcw className="h-3 w-3" />;
    case 'member_added': return <UserPlus className="h-3 w-3" />;
    case 'member_removed': return <UserMinus className="h-3 w-3" />;
    case 'comment_added': return <MessageCircle className="h-3 w-3" />;
    case 'comment_edited': return <MessageCircle className="h-3 w-3" />;
    case 'comment_deleted': return <MessageCircle className="h-3 w-3" />;
    case 'due_date_changed': return <Calendar className="h-3 w-3" />;
    case 'due_date_added': return <Calendar className="h-3 w-3" />;
    case 'due_date_removed': return <Calendar className="h-3 w-3" />;
    case 'label_added':
    case 'label_removed': return <Tag className="h-3 w-3" />;
    case 'attachment_added': return <Paperclip className="h-3 w-3" />;
    case 'attachment_deleted': return <Trash2 className="h-3 w-3" />;
    case 'attachment_downloaded': return <Download className="h-3 w-3" />;
    case 'member_assigned': return <UserPlus className="h-3 w-3" />;
    case 'member_unassigned': return <UserMinus className="h-3 w-3" />;
    default: return <History className="h-3 w-3" />;
  }
};

const getActionColor = (action: CardAction['action']) => {
  switch (action) {
    case 'created': return 'text-success';
    case 'moved': return 'text-blue-500';
    case 'edited': return 'text-warning';
    case 'title_changed': return 'text-warning';
    case 'description_changed': return 'text-yellow-600';
    case 'priority_changed': return 'text-orange-600';
    case 'deleted': return 'text-destructive';
    case 'restored': return 'text-success';
    case 'member_added': return 'text-green-600';
    case 'member_removed': return 'text-orange-500';
    case 'comment_added': return 'text-blue-600';
    case 'comment_edited': return 'text-blue-500';
    case 'comment_deleted': return 'text-red-600';
    case 'due_date_changed': return 'text-purple-500';
    case 'due_date_added': return 'text-purple-600';
    case 'due_date_removed': return 'text-purple-400';
    case 'label_added': return 'text-emerald-500';
    case 'label_removed': return 'text-red-500';
    case 'attachment_added': return 'text-blue-600';
    case 'attachment_deleted': return 'text-red-500';
    case 'attachment_downloaded': return 'text-indigo-500';
    case 'member_assigned': return 'text-green-600';
    case 'member_unassigned': return 'text-orange-500';
    default: return 'text-muted-foreground';
  }
};

const formatActionMessage = (action: CardAction, displayName: string) => {
  const { action: actionType, details } = action;

  switch (actionType) {
    case 'created':
      return `ha creato questa card`;
    case 'moved':
      return `ha spostato la card da "${details?.from}" a "${details?.to}"`;
    case 'edited':
      if (details?.field === 'title') {
        return `ha cambiato il titolo da "${details.oldValue}" a "${details.newValue}"`;
      } else if (details?.field === 'description') {
        if (details.oldValue && details.newValue) {
          return `ha modificato la descrizione`;
        } else if (details.newValue) {
          return `ha aggiunto la descrizione`;
        } else {
          return `ha rimosso la descrizione`;
        }
      }
      return `ha modificato ${details?.field || 'la card'}`;
    case 'title_changed':
      return `ha cambiato il titolo da "${details?.oldValue}" a "${details?.newValue}"`;
    case 'description_changed':
      return `ha ${details?.oldValue ? 'modificato' : 'aggiunto'} la descrizione`;
    case 'priority_changed':
      const oldPriority = details?.oldValue ? getPriorityLabel(details.oldValue) : 'Non impostata';
      const newPriority = details?.newValue ? getPriorityLabel(details.newValue) : 'Non impostata';
      return `ha cambiato la priorità da "${oldPriority}" a "${newPriority}"`;
    case 'deleted':
      return `ha eliminato questa card`;
    case 'restored':
      return `ha ripristinato questa card`;
    case 'member_added':
      return `ha assegnato ${details?.memberName || 'un membro'} alla card`;
    case 'member_removed':
      return `ha rimosso ${details?.memberName || 'un membro'} dalla card`;
    case 'comment_added':
      return `ha aggiunto un commento: "${details?.comment}"`;
    case 'comment_edited':
      return `ha modificato un commento`;
    case 'comment_deleted':
      return `ha eliminato un commento`;
    case 'due_date_changed':
      if (details?.newValue) {
        return `ha impostato la scadenza al ${new Date(details.newValue).toLocaleDateString('it-IT')}`;
      } else {
        return `ha rimosso la scadenza`;
      }
    case 'due_date_added':
      return `ha impostato la scadenza al ${new Date(details?.newValue).toLocaleDateString('it-IT')}`;
    case 'due_date_removed':
      return `ha rimosso la scadenza`;
    case 'label_added':
      return `ha aggiunto l'etichetta "${details?.labelName}"`;
    case 'label_removed':
      return `ha rimosso l'etichetta "${details?.labelName}"`;
    case 'attachment_added':
      return `ha caricato l'allegato "${details?.fileName}"${details?.fileSize ? ` (${(details.fileSize / 1024 / 1024).toFixed(1)}MB)` : ''}`;
    case 'attachment_deleted':
      return `ha eliminato l'allegato "${details?.fileName}"`;
    case 'attachment_downloaded':
      return `ha scaricato l'allegato "${details?.fileName}"`;
    case 'member_assigned':
      return `ha assegnato ${details?.memberName || 'un membro'} alla card`;
    case 'member_unassigned':
      return `ha rimosso l'assegnazione di ${details?.memberName || 'un membro'} dalla card`;
    default:
      return `ha eseguito un'azione`;
  }
};

const getPriorityLabel = (priority: string) => {
  switch (priority) {
    case 'high': return 'Alta';
    case 'medium': return 'Media';
    case 'low': return 'Bassa';
    default: return 'Non impostata';
  }
};

export function CardHistory({ actions = [], className }: CardHistoryProps) {
  const { staffUsers } = useStaffUsers();

  // Filter and enrich actions with staff data directly
  const enrichedActions = useMemo(() => {
    if (!actions || actions.length === 0) {
      return [];
    }

    // Show ALL important card activities EXCEPT comments
    const realActions = actions.filter(action => {
      // Exclude ONLY comment-related activities
      if (action.action === 'comment_added' ||
          action.action === 'comment_edited' ||
          action.action === 'comment_deleted') {
        return false;
      }

      // Keep ALL other real actions (title changes, member changes, etc.)
      return action.username &&
        action.timestamp > 0;
    });

    // Enrich with staff data - improved matching logic
    return realActions.map(action => {
      // Find staff user by username or userId - improved matching logic
      const staffUser = staffUsers.find(user => {
        // Match by exact username
        if (user.username === action.username) return true;

        // Match by user ID (direct match)
        if (user.id === action.userId) return true;

        // Match by Discord ID (direct match)
        if (user.discordId === action.userId) return true;

        // Handle prefixed Discord IDs
        if (typeof action.userId === 'string') {
          if (user.discordId === action.userId.replace('discord_', '')) return true;
          if (user.id === action.userId.replace('discord_', '')) return true;
        }

        return false;
      });

      let displayName = action.username || 'Unknown User';
      let avatarUrl: string | null = null;

      if (staffUser) {
        displayName = staffUser.displayName || staffUser.username;
        if (staffUser.avatar && staffUser.discordId) {
          avatarUrl = `https://cdn.discordapp.com/avatars/${staffUser.discordId}/${staffUser.avatar}.png`;
        }
      }

      const enrichedAction = {
        ...action,
        displayName,
        avatarUrl,
        discordStatus: staffUser?.discordStatus || 'offline'
      };

      // Enhanced debug log for non-comment actions
      if (action.action !== 'comment_added') {
          action: action.action,
          originalUsername: action.username,
          originalUserId: action.userId,
          displayName: enrichedAction.displayName,
          staffUserFound: !!staffUser,
          staffUser: staffUser ? {
            id: staffUser.id,
            username: staffUser.username,
            discordId: staffUser.discordId,
            displayName: staffUser.displayName
          } : null,
          discordStatus: enrichedAction.discordStatus
        });
      }

      return enrichedAction;
    });
  }, [actions, staffUsers]);

  if (enrichedActions.length === 0) {
    // Show empty state instead of hiding completely
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <History className="h-4 w-4" />
          <h4 className="font-medium">Storico Attività</h4>
          <Badge variant="secondary" className="ml-auto">0</Badge>
        </div>
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          <History className="h-6 w-6 mr-2" />
          <span className="text-sm">Nessuna attività ancora.</span>
        </div>
      </div>
    );
  }

  // Sort actions by timestamp (newest first)
  const sortedActions = [...enrichedActions].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <History className="h-4 w-4" />
        <h4 className="font-medium">Storico Attività</h4>
        <Badge variant="secondary" className="ml-auto">
          {enrichedActions.length}
        </Badge>
      </div>

      <ScrollArea className="h-64">
        <div className="space-y-2 pr-3">
          {sortedActions.map((action) => {

            return (
              <div key={action.id} className="flex gap-2 p-2 bg-muted/20 rounded-md hover:bg-muted/40 transition-colors">
                <div className={`mt-0.5 ${getActionColor(action.action)}`}>
                  {getActionIcon(action.action)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative">
                        <Avatar className="h-4 w-4">
                          {action.avatarUrl && (
                            <AvatarImage
                              src={action.avatarUrl}
                              alt={action.displayName}
                            />
                          )}
                          <AvatarFallback className="text-[10px]">
                            {action.displayName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <DiscordStatus
                          status={action.discordStatus || 'offline'}
                          className="absolute -bottom-0.5 -right-0.5"
                          size="sm"
                        />
                      </div>
                      <span className="font-medium text-xs truncate">
                        {action.displayName}
                      </span>
                    </div>

                    <time className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(action.timestamp), {
                        addSuffix: true,
                        locale: it
                      })}
                    </time>
                  </div>

                  <p className="text-xs text-foreground mt-0.5 leading-relaxed ml-6">
                    {formatActionMessage(action, action.displayName)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}