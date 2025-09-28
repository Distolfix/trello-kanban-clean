import { useState, useRef, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { DiscordStatus } from "@/components/ui/discord-status";
import { useStaffUsers, type StaffUser } from "@/hooks/useStaffUsers";
import { cn } from "@/lib/utils";

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  onSubmit?: () => void;
}

interface MentionSuggestion {
  user: StaffUser;
  index: number;
}

export function MentionTextarea({
  value,
  onChange,
  placeholder,
  className,
  disabled,
  onSubmit
}: MentionTextareaProps) {
  const { staffUsers } = useStaffUsers();
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(-1);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Handle @ character detection and filtering
  const handleInputChange = useCallback((newValue: string) => {
    onChange(newValue);

    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const beforeCursor = newValue.slice(0, cursorPos);
    const lastAtIndex = beforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const afterAt = beforeCursor.slice(lastAtIndex + 1);

      // Check if there's a space after @ (if so, don't show suggestions)
      if (!afterAt.includes(' ') && !afterAt.includes('\n')) {
        const query = afterAt.toLowerCase();
        setMentionQuery(query);
        setMentionStart(lastAtIndex);

        // Filter staff users based on query
        const filteredUsers = staffUsers.filter(user =>
          user.username.toLowerCase().includes(query) ||
          (user.displayName?.toLowerCase().includes(query))
        );

        const suggestions = filteredUsers.map((user, index) => ({ user, index }));
        setSuggestions(suggestions);
        setShowSuggestions(suggestions.length > 0);
        setSelectedIndex(0);
        return;
      }
    }

    setShowSuggestions(false);
    setSuggestions([]);
    setMentionQuery("");
    setMentionStart(-1);
  }, [onChange, staffUsers]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && onSubmit) {
        e.preventDefault();
        onSubmit();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          insertMention(suggestions[selectedIndex].user);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        break;
    }
  }, [showSuggestions, suggestions, selectedIndex, onSubmit]);

  // Insert mention into text
  const insertMention = useCallback((user: StaffUser) => {
    const textarea = textareaRef.current;
    if (!textarea || mentionStart === -1) return;

    const beforeMention = value.slice(0, mentionStart);
    const afterMention = value.slice(textarea.selectionStart);
    const mentionText = `@${user.username}`;

    const newValue = beforeMention + mentionText + ' ' + afterMention;
    onChange(newValue);

    setShowSuggestions(false);
    setSuggestions([]);
    setMentionQuery("");
    setMentionStart(-1);

    // Set cursor position after the mention
    setTimeout(() => {
      const newCursorPos = beforeMention.length + mentionText.length + 1;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  }, [value, mentionStart, onChange]);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !textareaRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full max-h-48 overflow-y-auto bg-popover border rounded-md shadow-lg mt-1"
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.user.id}
              className={cn(
                "flex items-center gap-3 p-3 cursor-pointer hover:bg-accent",
                index === selectedIndex && "bg-accent"
              )}
              onClick={() => insertMention(suggestion.user)}
            >
              <div className="relative">
                <Avatar className="h-6 w-6">
                  {suggestion.user.avatar && (
                    <AvatarImage
                      src={`https://cdn.discordapp.com/avatars/${suggestion.user.discordId}/${suggestion.user.avatar}.png`}
                      alt={suggestion.user.displayName || suggestion.user.username}
                    />
                  )}
                  <AvatarFallback className="text-xs">
                    {(suggestion.user.displayName || suggestion.user.username).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <DiscordStatus
                  status={suggestion.user.discordStatus || 'offline'}
                  className="absolute -bottom-0.5 -right-0.5"
                  size="sm"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">
                  {suggestion.user.displayName || suggestion.user.username}
                </div>
                {suggestion.user.displayName && suggestion.user.displayName !== suggestion.user.username && (
                  <div className="text-xs text-muted-foreground">
                    @{suggestion.user.username}
                  </div>
                )}
              </div>

              <div className="text-xs text-muted-foreground capitalize">
                {suggestion.user.role}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}