import { getDatabase } from './database';
import type { Board, List, Card, Setting, User, CardRow, KanbanCardData, KanbanListData, Comment } from './types';

export class DatabaseService {
  private db = getDatabase();

  // Board operations
  getBoard(id: string): Board | undefined {
    const stmt = this.db.prepare('SELECT * FROM boards WHERE id = ?');
    return stmt.get(id) as Board | undefined;
  }

  getAllBoards(): Board[] {
    const stmt = this.db.prepare('SELECT * FROM boards ORDER BY updated_at DESC');
    return stmt.all() as Board[];
  }

  createBoard(board: Omit<Board, 'created_at' | 'updated_at'>): Board {
    const stmt = this.db.prepare(`
      INSERT INTO boards (id, name)
      VALUES (?, ?)
      RETURNING *
    `);
    return stmt.get(board.id, board.name) as Board;
  }

  updateBoard(id: string, updates: Partial<Pick<Board, 'name'>>): Board | undefined {
    const stmt = this.db.prepare(`
      UPDATE boards
      SET name = COALESCE(?, name)
      WHERE id = ?
      RETURNING *
    `);
    return stmt.get(updates.name, id) as Board | undefined;
  }

  deleteBoard(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM boards WHERE id = ?');
    return stmt.run(id).changes > 0;
  }

  // List operations
  getListsByBoard(boardId: string): KanbanListData[] {
    const listsStmt = this.db.prepare(`
      SELECT * FROM lists
      WHERE board_id = ?
      ORDER BY position ASC
    `);
    const lists = listsStmt.all(boardId) as List[];

    const cardsStmt = this.db.prepare(`
      SELECT c.* FROM cards c
      JOIN lists l ON c.list_id = l.id
      WHERE l.board_id = ?
      ORDER BY c.position ASC
    `);
    const allCards = cardsStmt.all(boardId) as CardRow[];

    return lists.map(list => ({
      id: list.id,
      title: list.title,
      type: list.type,
      cardLimit: list.card_limit || undefined,
      cards: allCards
        .filter(card => card.list_id === list.id)
        .map(card => this.convertCardRowToKanbanCard(card))
    }));
  }

  createList(list: Omit<List, 'created_at' | 'updated_at'>): List {
    const stmt = this.db.prepare(`
      INSERT INTO lists (id, board_id, title, type, position, card_limit)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    return stmt.get(
      list.id,
      list.board_id,
      list.title,
      list.type,
      list.position,
      list.card_limit || null
    ) as List;
  }

  updateList(id: string, updates: Partial<Pick<List, 'title' | 'type' | 'position' | 'card_limit'>>): List | undefined {
    const stmt = this.db.prepare(`
      UPDATE lists
      SET title = COALESCE(?, title),
          type = COALESCE(?, type),
          position = COALESCE(?, position),
          card_limit = COALESCE(?, card_limit)
      WHERE id = ?
      RETURNING *
    `);
    return stmt.get(
      updates.title,
      updates.type,
      updates.position,
      updates.card_limit,
      id
    ) as List | undefined;
  }

  deleteList(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM lists WHERE id = ?');
    return stmt.run(id).changes > 0;
  }

  // Card operations
  createCard(card: Omit<Card, 'created_at' | 'updated_at'>): Card {
    const stmt = this.db.prepare(`
      INSERT INTO cards (id, list_id, title, description, position, due_date, labels, attachments, members)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    const rawCard = stmt.get(
      card.id,
      card.list_id,
      card.title,
      card.description || null,
      card.position,
      card.due_date || null,
      card.labels ? JSON.stringify(card.labels) : null,
      card.attachments ? JSON.stringify(card.attachments) : null,
      card.members ? JSON.stringify(card.members) : null
    ) as any;
    return this.parseCardData(rawCard);
  }

  updateCard(id: string, updates: Partial<Pick<Card, 'title' | 'description' | 'position' | 'due_date' | 'labels' | 'attachments' | 'members' | 'list_id'>>): Card | undefined {
    const stmt = this.db.prepare(`
      UPDATE cards
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          position = COALESCE(?, position),
          due_date = COALESCE(?, due_date),
          labels = COALESCE(?, labels),
          attachments = COALESCE(?, attachments),
          members = COALESCE(?, members),
          list_id = COALESCE(?, list_id)
      WHERE id = ?
      RETURNING *
    `);
    const rawCard = stmt.get(
      updates.title,
      updates.description,
      updates.position,
      updates.due_date,
      updates.labels ? JSON.stringify(updates.labels) : null,
      updates.attachments ? JSON.stringify(updates.attachments) : null,
      updates.members ? JSON.stringify(updates.members) : null,
      updates.list_id,
      id
    ) as any;
    return rawCard ? this.parseCardData(rawCard) : undefined;
  }

  deleteCard(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM cards WHERE id = ?');
    return stmt.run(id).changes > 0;
  }

  getCardsByListId(listId: string): Card[] {
    const stmt = this.db.prepare(`
      SELECT * FROM cards
      WHERE list_id = ?
      ORDER BY position ASC
    `);
    const rawCards = stmt.all(listId) as any[];
    return rawCards.map(card => this.parseCardData(card));
  }

  private parseCardData(rawCard: any): Card {
    return {
      ...rawCard,
      labels: rawCard.labels ? this.safeJSONParse(rawCard.labels, []) : [],
      attachments: rawCard.attachments ? this.safeJSONParse(rawCard.attachments, []) : [],
      members: rawCard.members ? this.safeJSONParse(rawCard.members, []) : []
    };
  }

  private safeJSONParse(jsonString: string, defaultValue: any): any {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Error parsing JSON:', error, 'String:', jsonString);
      return defaultValue;
    }
  }

  // Batch update for drag and drop
  updateCardsPositions(cards: Array<{ id: string; list_id?: string; position: number }>): void {
    const stmt = this.db.prepare(`
      UPDATE cards
      SET position = ?, list_id = COALESCE(?, list_id)
      WHERE id = ?
    `);

    const transaction = this.db.transaction((cards: typeof cards) => {
      for (const card of cards) {
        const result = stmt.run(card.position, card.list_id, card.id);
      }
    });

    transaction(cards);
  }

  updateListsPositions(lists: Array<{ id: string; position: number }>): void {
    const stmt = this.db.prepare('UPDATE lists SET position = ? WHERE id = ?');

    const transaction = this.db.transaction((lists: typeof lists) => {
      for (const list of lists) {
        stmt.run(list.position, list.id);
      }
    });

    transaction(lists);
  }

  // Settings operations
  getSetting(key: string): Setting | undefined {
    const stmt = this.db.prepare('SELECT * FROM settings WHERE key = ?');
    return stmt.get(key) as Setting | undefined;
  }

  setSetting(key: string, value: string): Setting {
    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT (key) DO UPDATE SET
        value = excluded.value,
        updated_at = strftime('%s', 'now')
      RETURNING *
    `);
    return stmt.get(key, value) as Setting;
  }

  deleteSetting(key: string): boolean {
    const stmt = this.db.prepare('DELETE FROM settings WHERE key = ?');
    const result = stmt.run(key);
    return result.changes > 0;
  }

  getAllSettings(): Record<string, string> {
    const stmt = this.db.prepare('SELECT key, value FROM settings');
    const settings = stmt.all() as Array<{ key: string; value: string }>;
    return Object.fromEntries(settings.map(s => [s.key, s.value]));
  }

  // User operations
  getUser(id: string): User | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as User | undefined;
  }

  getUserByDiscordId(discordId: string): User | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE discord_id = ?');
    return stmt.get(discordId) as User | undefined;
  }

  createUser(user: Omit<User, 'created_at' | 'updated_at'>): User {
    const stmt = this.db.prepare(`
      INSERT INTO users (id, discord_id, username, avatar, role)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `);
    return stmt.get(
      user.id,
      user.discord_id || null,
      user.username,
      user.avatar || null,
      user.role
    ) as User;
  }

  updateUser(id: string, updates: Partial<Pick<User, 'username' | 'avatar' | 'role' | 'discord_id'>>): User | undefined {
    const stmt = this.db.prepare(`
      UPDATE users
      SET username = COALESCE(?, username),
          avatar = COALESCE(?, avatar),
          role = COALESCE(?, role),
          discord_id = COALESCE(?, discord_id)
      WHERE id = ?
      RETURNING *
    `);
    return stmt.get(
      updates.username,
      updates.avatar,
      updates.role,
      updates.discord_id,
      id
    ) as User | undefined;
  }

  getAllUsers(): User[] {
    const stmt = this.db.prepare('SELECT * FROM users ORDER BY username ASC');
    return stmt.all() as User[];
  }

  getStaffUsers(): User[] {
    const stmt = this.db.prepare('SELECT * FROM users WHERE role IN ("mod", "admin") ORDER BY username ASC');
    return stmt.all() as User[];
  }

  deleteUser(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM users WHERE id = ?');
    return stmt.run(id).changes > 0;
  }

  // Card member operations
  addMemberToCard(cardId: string, userId: string): boolean {
    const card = this.getCard(cardId);
    if (!card) return false;

    const user = this.getUser(userId);
    if (!user || (user.role !== 'mod' && user.role !== 'admin')) return false;

    const currentMembers = card.members || [];
    if (currentMembers.includes(userId)) return false;

    const updatedMembers = [...currentMembers, userId];
    const result = this.updateCard(cardId, { members: updatedMembers });
    return !!result;
  }

  removeMemberFromCard(cardId: string, userId: string): boolean {
    const card = this.getCard(cardId);
    if (!card) return false;

    const currentMembers = card.members || [];
    if (!currentMembers.includes(userId)) return false;

    const updatedMembers = currentMembers.filter(id => id !== userId);
    const result = this.updateCard(cardId, { members: updatedMembers });
    return !!result;
  }

  // Migration helper
  saveKanbanData(boardId: string, lists: KanbanListData[]): void {
    const transaction = this.db.transaction(() => {
      // Delete existing data for this board
      this.db.prepare('DELETE FROM cards WHERE list_id IN (SELECT id FROM lists WHERE board_id = ?)').run(boardId);
      this.db.prepare('DELETE FROM lists WHERE board_id = ?').run(boardId);

      // Insert lists and cards
      lists.forEach((list, listIndex) => {
        this.createList({
          id: list.id,
          board_id: boardId,
          title: list.title,
          type: list.type,
          position: listIndex,
          card_limit: list.cardLimit
        });

        list.cards.forEach((card, cardIndex) => {
          this.createCard({
            id: card.id,
            list_id: list.id,
            title: card.title,
            description: card.description,
            position: cardIndex,
            due_date: card.dueDate ? Math.floor(new Date(card.dueDate).getTime() / 1000) : undefined,
            labels: card.labels,
            attachments: card.attachments,
            members: card.members
          });
        });
      });
    });

    transaction();
  }

  // Get card members with full user details
  getCardMembers(cardId: string): User[] {
    const card = this.getCard(cardId);
    if (!card || !card.members) return [];

    const memberIds = card.members;
    return memberIds
      .map(id => this.getUser(id))
      .filter((user): user is User => user !== undefined);
  }

  // Card actions operations
  createCardAction(actionData: {
    id: string;
    cardId: string;
    userId: string;
    username: string;
    action: string;
    details?: object;
    timestamp: number;
  }): boolean {
    const stmt = this.db.prepare(`
      INSERT INTO card_actions (id, card_id, user_id, username, action, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      actionData.id,
      actionData.cardId,
      actionData.userId,
      actionData.username,
      actionData.action,
      actionData.details ? JSON.stringify(actionData.details) : null,
      actionData.timestamp
    );

    return result.changes > 0;
  }

  getCardActions(cardId: string): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM card_actions
      WHERE card_id = ?
      ORDER BY timestamp DESC
    `);

    const actions = stmt.all(cardId) as any[];

    // Parse JSON details with error handling
    return actions.map(action => {
      let details;
      try {
        details = action.details ? JSON.parse(action.details) : undefined;
      } catch (error) {
        console.warn(`Failed to parse JSON for action ${action.id}:`, action.details, error);
        details = { error: 'Invalid JSON', raw: action.details };
      }
      return {
        ...action,
        details
      };
    });
  }

  deleteCardAction(actionId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM card_actions WHERE id = ?');
    return stmt.run(actionId).changes > 0;
  }

  // Get a single card by ID
  getCard(id: string): Card | undefined {
    const stmt = this.db.prepare('SELECT * FROM cards WHERE id = ?');
    const rawCard = stmt.get(id) as any;
    return rawCard ? this.parseCardData(rawCard) : undefined;
  }

  // Helper to convert CardRow to KanbanCardData
  private convertCardRowToKanbanCard = (cardRow: CardRow): KanbanCardData => {
    // Parse JSON fields properly
    const labels = cardRow.labels ?
      (typeof cardRow.labels === 'string' ? this.safeJSONParse(cardRow.labels, []) : cardRow.labels) :
      [];
    const attachments = cardRow.attachments ?
      (typeof cardRow.attachments === 'string' ? this.safeJSONParse(cardRow.attachments, []) : cardRow.attachments) :
      [];
    const members = cardRow.members ?
      (typeof cardRow.members === 'string' ? this.safeJSONParse(cardRow.members, []) : cardRow.members) :
      [];

    return {
      id: cardRow.id,
      title: cardRow.title,
      description: cardRow.description || undefined,
      labels: labels,
      dueDate: cardRow.due_date ? new Date(cardRow.due_date * 1000) : undefined,
      attachments: attachments,
      members: members
    };
  }

  // Comment operations
  getCardComments(cardId: string): Comment[] {
    const stmt = this.db.prepare(`
      SELECT * FROM comments
      WHERE card_id = ?
      ORDER BY timestamp ASC
    `);
    return stmt.all(cardId) as Comment[];
  }

  createComment(commentData: {
    id: string;
    cardId: string;
    userId: string;
    username: string;
    text: string;
    timestamp: number;
    replyTo?: string;
  }): Comment {
    const stmt = this.db.prepare(`
      INSERT INTO comments (id, card_id, user_id, username, text, timestamp, reply_to)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);

    return stmt.get(
      commentData.id,
      commentData.cardId,
      commentData.userId,
      commentData.username,
      commentData.text,
      commentData.timestamp,
      commentData.replyTo || null
    ) as Comment;
  }

  deleteComment(commentId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM comments WHERE id = ?');
    return stmt.run(commentId).changes > 0;
  }

  getComment(commentId: string): Comment | undefined {
    const stmt = this.db.prepare('SELECT * FROM comments WHERE id = ?');
    return stmt.get(commentId) as Comment | undefined;
  }
}

// Export singleton instance
export const dbService = new DatabaseService();