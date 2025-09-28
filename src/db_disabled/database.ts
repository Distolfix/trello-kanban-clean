import Database from 'better-sqlite3';
import { join } from 'path';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = join(process.cwd(), 'trello.db');
    db = new Database(dbPath);

    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = 1000000');
    db.pragma('temp_store = memory');

    // Initialize database schema
    initializeSchema();
  }

  return db;
}

function initializeSchema() {
  if (!db) return;

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS lists (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('open', 'closed', 'hidden')),
      position INTEGER NOT NULL,
      card_limit INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      position INTEGER NOT NULL,
      due_date INTEGER,
      labels TEXT, -- JSON array of labels
      attachments TEXT, -- JSON array of attachments
      members TEXT, -- JSON array of member IDs
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (list_id) REFERENCES lists (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      discord_id TEXT UNIQUE,
      username TEXT NOT NULL,
      avatar TEXT,
      role TEXT NOT NULL DEFAULT 'default' CHECK (role IN ('default', 'mod', 'admin')),
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS card_actions (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('created', 'moved', 'edited', 'title_changed', 'description_changed', 'priority_changed', 'deleted', 'restored', 'member_added', 'member_removed', 'comment_added', 'comment_edited', 'comment_deleted', 'due_date_changed', 'due_date_added', 'due_date_removed', 'label_added', 'label_removed')),
      details TEXT, -- JSON object with action details
      timestamp INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (card_id) REFERENCES cards (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      reply_to TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (card_id) REFERENCES cards (id) ON DELETE CASCADE
    );

    -- Create indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_lists_board_id ON lists (board_id);
    CREATE INDEX IF NOT EXISTS idx_lists_position ON lists (position);
    CREATE INDEX IF NOT EXISTS idx_cards_list_id ON cards (list_id);
    CREATE INDEX IF NOT EXISTS idx_cards_position ON cards (position);
    CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users (discord_id);
    CREATE INDEX IF NOT EXISTS idx_card_actions_card_id ON card_actions (card_id);
    CREATE INDEX IF NOT EXISTS idx_card_actions_timestamp ON card_actions (timestamp);
    CREATE INDEX IF NOT EXISTS idx_comments_card_id ON comments (card_id);
    CREATE INDEX IF NOT EXISTS idx_comments_timestamp ON comments (timestamp);
    CREATE INDEX IF NOT EXISTS idx_comments_reply_to ON comments (reply_to);

    -- Create trigger to update updated_at timestamp
    CREATE TRIGGER IF NOT EXISTS update_boards_timestamp
      AFTER UPDATE ON boards
      BEGIN
        UPDATE boards SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
      END;

    CREATE TRIGGER IF NOT EXISTS update_lists_timestamp
      AFTER UPDATE ON lists
      BEGIN
        UPDATE lists SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
      END;

    CREATE TRIGGER IF NOT EXISTS update_cards_timestamp
      AFTER UPDATE ON cards
      BEGIN
        UPDATE cards SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
      END;

    CREATE TRIGGER IF NOT EXISTS update_settings_timestamp
      AFTER UPDATE ON settings
      BEGIN
        UPDATE settings SET updated_at = strftime('%s', 'now') WHERE key = NEW.key;
      END;

    CREATE TRIGGER IF NOT EXISTS update_users_timestamp
      AFTER UPDATE ON users
      BEGIN
        UPDATE users SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
      END;

    CREATE TRIGGER IF NOT EXISTS update_comments_timestamp
      AFTER UPDATE ON comments
      BEGIN
        UPDATE comments SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
      END;
  `);

  // Add reply_to column to comments table if it doesn't exist (migration)
  try {
    db.exec('ALTER TABLE comments ADD COLUMN reply_to TEXT REFERENCES comments(id) ON DELETE CASCADE');
  } catch (error: any) {
    // Column already exists or other error - this is expected on subsequent runs
    if (!error.message.includes('duplicate column name')) {
      console.warn('Warning adding reply_to column:', error.message);
    }
  }

  // Insert default board if not exists
  const checkBoard = db.prepare('SELECT COUNT(*) as count FROM boards WHERE id = ?');
  const boardExists = checkBoard.get('1') as { count: number };

  if (boardExists.count === 0) {
    const insertBoard = db.prepare('INSERT INTO boards (id, name) VALUES (?, ?)');
    insertBoard.run('1', 'Main Board');
  }
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}