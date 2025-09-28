import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, Trash2, Loader2, Reply } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { useStaffUsers } from "@/hooks/useStaffUsers";
import { cn } from "@/lib/utils";
import { apiClient } from "@/api/client";
import { toast } from "@/hooks/use-toast";

export interface Comment {
  id: string;
  cardId: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
  replyTo?: string; // ID of parent comment if this is a reply
}

interface CardCommentsProps {
  cardId: string;
  currentUserId?: string;
  currentUsername?: string;
  userRole?: 'default' | 'mod' | 'admin';
  className?: string;
}

export function CardComments({
  cardId,
  currentUserId,
  currentUsername,
  userRole = 'default',
  className
}: CardCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const { staffUsers } = useStaffUsers();

  // Load comments from database (initial load)
  const loadComments = async (showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      setError(null);
      const commentsData = await apiClient.getCardComments(cardId);
      const sortedComments = (commentsData || []).sort((a: Comment, b: Comment) => a.timestamp - b.timestamp);
      setComments(sortedComments);

      // Trigger event for card count updates
      window.dispatchEvent(new CustomEvent('commentsUpdated', {
        detail: { cardId, count: sortedComments.length }
      }));
    } catch (error) {
      console.error('Error loading comments:', error);
      if (showLoading) {
        setError('Errore nel caricamento dei commenti');
        toast({
          title: "Errore",
          description: "Impossibile caricare i commenti",
          variant: "destructive",
        });
      }
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  // Background refresh without showing loading
  const refreshComments = async () => {
    await loadComments(false);
  };

  // Load comments on mount and set up polling
  useEffect(() => {
    loadComments();

    // Poll for new comments every 8 seconds in background
    const pollInterval = setInterval(refreshComments, 8000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [cardId]);

  // Add new comment
  const handleAddComment = async () => {
    if (!newComment.trim() || !currentUserId || !currentUsername) return;

    setIsSubmitting(true);

    try {
      const commentData = {
        cardId,
        userId: currentUserId,
        username: currentUsername,
        text: newComment.trim(),
        timestamp: Date.now()
      };

      await apiClient.createCardComment(commentData);
      setNewComment("");

      // Reload comments to get the latest data (immediate, no loading)
      await refreshComments();

      toast({
        title: "Successo",
        description: "Commento aggiunto con successo",
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Errore",
        description: "Impossibile aggiungere il commento",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add reply to comment
  const handleAddReply = async (parentCommentId: string) => {
    if (!replyText.trim() || !currentUserId || !currentUsername) return;

    setIsSubmitting(true);

    try {
      const replyData = {
        cardId,
        userId: currentUserId,
        username: currentUsername,
        text: replyText.trim(),
        timestamp: Date.now(),
        replyTo: parentCommentId
      };

      await apiClient.createCardComment(replyData);
      setReplyText("");
      setReplyingTo(null);

      // Reload comments to get the latest data (immediate, no loading)
      await refreshComments();

      toast({
        title: "Successo",
        description: "Risposta aggiunta con successo",
      });
    } catch (error) {
      console.error('Error adding reply:', error);
      toast({
        title: "Errore",
        description: "Impossibile aggiungere la risposta",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId: string) => {
    try {
      await apiClient.deleteCardComment(commentId);

      // Reload comments to get the latest data (immediate, no loading)
      await refreshComments();

      toast({
        title: "Successo",
        description: "Commento eliminato con successo",
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il commento",
        variant: "destructive",
      });
    }
  };

  // Get user display info
  const getUserDisplayInfo = (comment: Comment) => {
    const staffUser = staffUsers.find(user =>
      user.id === comment.userId ||
      user.username === comment.username ||
      user.discordId === comment.userId
    );

    return {
      displayName: staffUser?.displayName || comment.username,
      avatarUrl: staffUser?.avatarUrl ||
        (staffUser?.avatar && staffUser?.discordId
          ? `https://cdn.discordapp.com/avatars/${staffUser.discordId}/${staffUser.avatar}.png`
          : null),
      role: staffUser?.role || 'default',
      isOnline: staffUser?.isOnline || false,
      discordStatus: staffUser?.discordStatus || 'offline'
    };
  };

  // Check if user can delete comment
  const canDeleteComment = (comment: Comment) => {
    return (
      comment.userId === currentUserId ||
      comment.username === currentUsername ||
      userRole === 'admin'
    );
  };

  // Organize comments into threads
  const organizeComments = () => {
    const parentComments = comments.filter(comment => !comment.replyTo);
    const replies = comments.filter(comment => comment.replyTo);

    return parentComments.map(parent => ({
      ...parent,
      replies: replies.filter(reply => reply.replyTo === parent.id)
    }));
  };

  const commentThreads = organizeComments();

  // Get parent comment for reply context
  const getParentComment = (commentId: string) => {
    return comments.find(comment => comment.id === commentId);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4" />
        <h4 className="font-medium">Commenti</h4>
        <Badge variant="secondary" className="text-xs">
          {comments.length}
        </Badge>
      </div>

      {/* Comments List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">Caricamento commenti...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center p-8 text-destructive">
            <span className="text-sm">{error}</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-2"
              onClick={loadComments}
            >
              Riprova
            </Button>
          </div>
        ) : commentThreads.length > 0 ? (
          <ScrollArea className="max-h-80 min-h-40 overflow-y-auto">
            <div className="space-y-3 pr-4">
              {commentThreads.map((thread) => {
                const userInfo = getUserDisplayInfo(thread);
                return (
                  <div key={thread.id} className="space-y-2">
                    {/* Parent Comment */}
                    <div className="group flex gap-3 p-4 bg-gradient-to-r from-background to-muted/20 rounded-lg border border-border/50 hover:border-border transition-colors">
                      <div className="relative">
                        <Avatar className="h-10 w-10 flex-shrink-0 ring-2 ring-background">
                          {userInfo.avatarUrl ? (
                            <AvatarImage
                              src={userInfo.avatarUrl}
                              alt={userInfo.displayName}
                              className="object-cover"
                            />
                          ) : null}
                          <AvatarFallback className={`text-sm font-semibold ${
                            userInfo.role === 'admin' ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
                            userInfo.role === 'mod' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
                            'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                          }`}>
                            {userInfo.displayName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {userInfo.isOnline && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">
                              {userInfo.displayName}
                            </span>
                            {userInfo.role !== 'default' && (
                              <Badge variant="outline" className={`text-xs px-2 py-0.5 ${
                                userInfo.role === 'admin' ? 'border-red-200 text-red-600 dark:border-red-800 dark:text-red-400' :
                                'border-blue-200 text-blue-600 dark:border-blue-800 dark:text-blue-400'
                              }`}>
                                {userInfo.role.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <time className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(thread.timestamp), {
                                addSuffix: true,
                                locale: it
                              })}
                            </time>
                            {userRole !== 'default' && currentUserId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => setReplyingTo(thread.id)}
                              >
                                <Reply className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            )}
                            {canDeleteComment(thread) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleDeleteComment(thread.id)}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-foreground leading-relaxed p-3 bg-muted/10 rounded-md border-l-2 border-primary/20">
                          {thread.text}
                        </div>
                      </div>
                    </div>

                    {/* Reply Form */}
                    {replyingTo === thread.id && userRole !== 'default' && currentUserId && (
                      <div className="ml-11 space-y-2 p-3 bg-muted/20 rounded border border-border/20">
                        {/* Reference to original message */}
                        <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded border-l-2 border-blue-400">
                          <Reply className="h-3 w-3 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs text-blue-700 dark:text-blue-400 font-medium">
                              Rispondendo a {userInfo.displayName}:
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              "{thread.text.length > 40 ? thread.text.substring(0, 40) + '...' : thread.text}"
                            </div>
                          </div>
                        </div>
                        <Textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Scrivi una risposta..."
                          className="min-h-[60px] resize-none text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                              e.preventDefault();
                              handleAddReply(thread.id);
                            }
                          }}
                        />
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-muted-foreground">
                            Ctrl+Enter per inviare
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setReplyingTo(null);
                                setReplyText("");
                              }}
                            >
                              Annulla
                            </Button>
                            <Button
                              onClick={() => handleAddReply(thread.id)}
                              disabled={!replyText.trim() || isSubmitting}
                              size="sm"
                            >
                              <Send className="h-3 w-3 mr-1" />
                              {isSubmitting ? 'Invio...' : 'Rispondi'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Replies */}
                    {thread.replies && thread.replies.length > 0 && (
                      <div className="ml-8 space-y-2 border-l-2 border-blue-200 dark:border-blue-800 pl-3">
                        {thread.replies.map((reply) => {
                          const replyUserInfo = getUserDisplayInfo(reply);
                          return (
                            <div key={reply.id} className="space-y-1">
                              {/* Reply reference */}
                              <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                                <Reply className="h-3 w-3" />
                                <span>In risposta a {userInfo.displayName}</span>
                              </div>
                              {/* Reply content */}
                              <div className="group flex gap-2 p-2 bg-blue-50/50 dark:bg-blue-950/10 rounded border border-blue-200/30 hover:border-blue-300/50 transition-colors">
                              <div className="relative">
                                <Avatar className="h-8 w-8 flex-shrink-0 ring-1 ring-background">
                                  {replyUserInfo.avatarUrl ? (
                                    <AvatarImage
                                      src={replyUserInfo.avatarUrl}
                                      alt={replyUserInfo.displayName}
                                      className="object-cover"
                                    />
                                  ) : null}
                                  <AvatarFallback className={`text-xs font-medium ${
                                    replyUserInfo.role === 'admin' ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
                                    replyUserInfo.role === 'mod' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
                                    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                                  }`}>
                                    {replyUserInfo.displayName.slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                {replyUserInfo.isOnline && (
                                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border border-background rounded-full"></div>
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="font-semibold text-xs text-primary">
                                    {replyUserInfo.displayName}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <time className="text-xs text-muted-foreground">
                                      {formatDistanceToNow(new Date(reply.timestamp), {
                                        addSuffix: true,
                                        locale: it
                                      })}
                                    </time>
                                    {canDeleteComment(reply) && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => handleDeleteComment(reply.id)}
                                      >
                                        <Trash2 className="h-2.5 w-2.5 text-destructive" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                <div className="text-xs text-foreground leading-relaxed">
                                  {reply.text}
                                </div>
                              </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex items-center justify-center p-4 text-muted-foreground">
            <MessageCircle className="h-4 w-4 mr-2" />
            <span className="text-sm">Nessun commento ancora</span>
          </div>
        )}
      </div>

      {/* Add Comment */}
      {userRole !== 'default' && currentUserId && (
        <div className="border-t pt-3">
          <div className="space-y-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Scrivi un commento..."
              className="min-h-[60px] resize-none text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleAddComment();
                }
              }}
            />
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Ctrl+Enter per inviare
              </div>
              <Button
                onClick={handleAddComment}
                disabled={!newComment.trim() || isSubmitting}
                size="sm"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Send className="h-3 w-3 mr-1" />
                )}
                {isSubmitting ? 'Invio...' : 'Commenta'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}