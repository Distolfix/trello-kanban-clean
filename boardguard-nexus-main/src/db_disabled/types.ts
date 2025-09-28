export interface Board {
  id: string;
  name: string;
  logo?: string;
  favicon?: string;
  created_at: number;
  updated_at: number;
}

export interface List {
  id: string;
  board_id: string;
  title: string;
  type: 'open' | 'closed' | 'hidden';
  position: number;
  card_limit?: number;
  created_at: number;
  updated_at: number;
}

export interface Card {
  id: string;
  list_id: string;
  title: string;
  description?: string;
  position: number;
  due_date?: number;
  labels?: string[]; // JSON array
  attachments?: string[]; // JSON array
  members?: string[]; // JSON array
  created_at: number;
  updated_at: number;
}

export interface Setting {
  key: string;
  value: string;
  updated_at: number;
}

export interface User {
  id: string;
  discord_id?: string;
  username: string;
  avatar?: string;
  role: 'default' | 'mod' | 'admin';
  created_at: number;
  updated_at: number;
}

export interface Comment {
  id: string;
  card_id: string;
  user_id: string;
  username: string;
  text: string;
  timestamp: number;
  reply_to?: string;
  created_at: number;
  updated_at: number;
}

// Raw database row types (with JSON strings)
export interface CardRow extends Omit<Card, 'labels' | 'attachments' | 'members'> {
  labels: string | null;
  attachments: string | null;
  members: string | null;
}

// Action history types
export interface CardAction {
  id: string;
  cardId: string;
  userId: string;
  username: string;
  action: 'created' | 'moved' | 'edited' | 'deleted' | 'restored' | 'member_added' | 'member_removed' | 'comment_added' | 'due_date_changed' | 'label_added' | 'label_removed' | 'attachment_added' | 'attachment_deleted' | 'attachment_downloaded' | 'member_assigned' | 'member_unassigned' | 'title_changed' | 'description_changed';
  details?: {
    from?: string; // for moves: previous list name
    to?: string; // for moves: new list name
    field?: string; // for edits: which field changed
    oldValue?: string; // for edits: previous value
    newValue?: string; // for edits: new value
    memberName?: string; // for member actions
    comment?: string; // for comments
    labelName?: string; // for label actions
    fileName?: string; // for attachment actions
    fileSize?: number; // for attachment actions (in bytes)
    fileType?: string; // for attachment actions
  };
  timestamp: number;
}

// Frontend compatible types
export interface KanbanCardData {
  id: string;
  title: string;
  description?: string;
  labels?: Array<{ id: string; name: string; color: string }> | string[];
  assignees?: Array<{ id: string; username: string; email?: string }>;
  members?: Array<{ id: string; username: string; email?: string }> | string[];
  dueDate?: Date | string | number;
  priority?: 'high' | 'medium' | 'low';
  checklist?: { completed: number; total: number };
  attachments?: number | string[];
  comments?: number;
  actions?: CardAction[]; // Action history
}

export interface KanbanListData {
  id: string;
  title: string;
  type: 'open' | 'closed' | 'hidden';
  cards: KanbanCardData[];
  cardLimit?: number;
}