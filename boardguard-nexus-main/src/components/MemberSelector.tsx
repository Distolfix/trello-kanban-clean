import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Shield, Crown, Circle } from "lucide-react";
import { DiscordStatus } from "@/components/ui/discord-status";
import { useStaffUsers, type StaffUser } from "@/hooks/useStaffUsers";
import { useCardActions } from "@/hooks/useCardActions";
import { useLocalCardActions } from "@/hooks/useLocalCardActions";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/api/client";

import type { User } from "@/db/types";

interface MemberSelectorProps {
  cardId: string;
  currentMembers: User[];
  onMembersChange: (members: User[]) => void;
  canEdit: boolean;
  currentUserId?: string;
  onMemberAction?: (action: any) => void; // Callback to notify parent of member actions
}

export function MemberSelector({ cardId, currentMembers, onMembersChange, canEdit, currentUserId, onMemberAction }: MemberSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { staffUsers, isLoading, error, getAvailableStaffUsers } = useStaffUsers();
  const { logMemberAdded, logMemberRemoved } = useCardActions();
  const { addAction: addLocalAction } = useLocalCardActions(cardId);

  // Convert StaffUser to User format for compatibility
  const convertStaffUserToUser = (staffUser: StaffUser): User => ({
    id: staffUser.id,
    username: staffUser.username,
    role: staffUser.role,
    created_at: Date.now(),
    updated_at: staffUser.lastSeen,
    discord_id: staffUser.discordId
  });

  const addMember = async (staffUser: StaffUser) => {
    try {
      // Check if user is already a member
      if (currentMembers.some(member =>
        member.id === staffUser.id ||
        member.discord_id === staffUser.discordId
      )) {
        return;
      }

      const user = convertStaffUserToUser(staffUser);
      const memberName = staffUser.displayName || staffUser.username;

      // Log the member addition action
      const memberAction = logMemberAdded(cardId, memberName);
      if (memberAction) {
        // Save to local cache immediately
        addLocalAction(memberAction);

        // Notify parent component about the action
        onMemberAction?.(memberAction);

        // Save to database in background
        apiClient.createCardAction(memberAction)
          .catch(error => console.warn('Failed to save member action to database:', error));
      }

      onMembersChange([...currentMembers, user]);
      setIsOpen(false);

      toast({
        title: "Membro aggiunto",
        description: `${memberName} è stato assegnato alla card`
      });
    } catch (error) {
      console.error('Error adding member:', error);
      toast({
        title: "Errore",
        description: "Errore durante l'aggiunta del membro",
        variant: "destructive"
      });
    }
  };

  const removeMember = async (userId: string) => {
    try {
      // Find the member being removed to get their name
      const memberToRemove = currentMembers.find(m => m.id === userId);
      const staffUser = staffUsers.find(su => su.id === userId || su.discordId === memberToRemove?.discord_id);
      const memberName = staffUser?.displayName || memberToRemove?.username || 'Utente sconosciuto';

      // Log the member removal action
      const memberAction = logMemberRemoved(cardId, memberName);
      if (memberAction) {
        // Save to local cache immediately
        addLocalAction(memberAction);

        // Notify parent component about the action
        onMemberAction?.(memberAction);

        // Save to database in background
        apiClient.createCardAction(memberAction)
          .catch(error => console.warn('Failed to save member action to database:', error));
      }

      onMembersChange(currentMembers.filter(m => m.id !== userId));

      toast({
        title: "Membro rimosso",
        description: `${memberName} è stato rimosso dalla card`
      });
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: "Errore",
        description: "Errore durante la rimozione del membro",
        variant: "destructive"
      });
    }
  };

  const availableUsers = getAvailableStaffUsers(currentUserId).filter(
    staffUser => !currentMembers.some(member =>
      member.id === staffUser.id ||
      member.discord_id === staffUser.discordId
    )
  );

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Crown className="h-3 w-3" />;
      case 'mod': return <Shield className="h-3 w-3" />;
      default: return null;
    }
  };

  const getRoleBadge = (role: string) => {
    const variants = {
      admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
      mod: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
    };

    const labels = { admin: "Admin", mod: "Mod" };

    return (
      <Badge className={`${variants[role as keyof typeof variants]} text-xs px-1 py-0`}>
        {getRoleIcon(role)}
        <span className="ml-1">{labels[role as keyof typeof labels]}</span>
      </Badge>
    );
  };

  return (
    <div>
      <h4 className="text-sm font-medium mb-3">Assegnatari</h4>
      <div className="space-y-2">
        {currentMembers.map((member) => {
          // Find the corresponding staff user to get display info
          const staffUser = staffUsers.find(su => su.id === member.id || su.discordId === member.discord_id);
          const displayName = staffUser?.displayName || member.username;
          const avatarUrl = staffUser?.avatar
            ? `https://cdn.discordapp.com/avatars/${staffUser.discordId}/${staffUser.avatar}.png`
            : null;

          return (
            <div key={member.id} className="flex items-center justify-between space-x-2">
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Avatar className="h-6 w-6">
                    {avatarUrl && (
                      <AvatarImage
                        src={avatarUrl}
                        alt={displayName}
                      />
                    )}
                    <AvatarFallback className="text-xs">
                      {displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {staffUser?.isOnline && (
                    <Circle className="absolute -bottom-0.5 -right-0.5 h-2 w-2 fill-green-500 text-green-500" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{displayName}</span>
                  {displayName !== member.username && (
                    <span className="text-xs text-muted-foreground">@{member.username}</span>
                  )}
                </div>
                {member.role === 'admin' && getRoleBadge(member.role)}
                {member.role === 'mod' && getRoleBadge(member.role)}
              </div>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMember(member.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          );
        })}

        {canEdit && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
              >
                <Plus className="h-4 w-4 mr-2" />
                Aggiungi membro
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Aggiungi membro staff</DialogTitle>
                <DialogDescription>
                  Seleziona un membro dello staff da aggiungere a questa card.
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-60">
                {isLoading ? (
                  <div className="p-4 text-center">Caricamento utenti staff...</div>
                ) : error ? (
                  <div className="p-4 text-center text-destructive text-sm">
                    Errore nel caricamento: {error}
                  </div>
                ) : availableUsers.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Nessun membro staff disponibile
                  </div>
                ) : (
                  <div className="space-y-2 p-2">
                    {availableUsers.map((staffUser) => (
                      <div
                        key={staffUser.id}
                        className="flex items-center justify-between p-2 hover:bg-muted rounded-lg cursor-pointer transition-colors group"
                        onClick={() => addMember(staffUser)}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <Avatar className="h-8 w-8">
                              {staffUser.avatar && (
                                <AvatarImage
                                  src={`https://cdn.discordapp.com/avatars/${staffUser.discordId}/${staffUser.avatar}.png`}
                                  alt={staffUser.displayName || staffUser.username}
                                />
                              )}
                              <AvatarFallback className="text-xs">
                                {(staffUser.displayName || staffUser.username).charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {staffUser.isOnline && (
                              <Circle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-green-500 text-green-500" />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium">
                                {staffUser.displayName || staffUser.username}
                              </span>
                              {getRoleBadge(staffUser.role)}
                            </div>
                            {staffUser.displayName && staffUser.displayName !== staffUser.username && (
                              <span className="text-xs text-muted-foreground">@{staffUser.username}</span>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}