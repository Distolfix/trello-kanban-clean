import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { dbService } from './src/db_disabled/services.js';
import { MigrationService } from './src/db_disabled/migration.js';

// Rate limiting map for Discord auth
const discordAuthLimiter = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// JWT secret key
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads', 'attachments');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create unique filename with timestamp and random string
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    cb(null, uniqueSuffix + fileExtension);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types - no restrictions
    cb(null, true);
  }
});

// Middleware for JWT authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Middleware
app.use(cors({
  origin: ['https://trello.enginemc.it', 'http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Serve static files from the current directory
app.use(express.static(__dirname));

// Serve uploaded attachments
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes

// File upload endpoints
app.post('/api/cards/:cardId/attachments', upload.array('files', 5), async (req, res) => {
  try {
    const { cardId } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    // Get current card to get existing attachments
    const card = dbService.getCard(cardId);
    if (!card) {
      return res.status(404).json({ success: false, error: 'Card not found' });
    }

    const currentAttachments = card.attachments || [];

    // Create attachment objects with metadata
    const newAttachments = files.map(file => ({
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      uploadDate: new Date().toISOString(),
      url: `/uploads/attachments/${file.filename}`
    }));

    const updatedAttachments = [...currentAttachments, ...newAttachments];

    // Update card with new attachments
    const updatedCard = dbService.updateCard(cardId, {
      attachments: updatedAttachments
    });

    if (!updatedCard) {
      return res.status(500).json({ success: false, error: 'Failed to update card' });
    }

    res.json({
      success: true,
      data: {
        attachments: newAttachments,
        totalAttachments: updatedAttachments.length
      }
    });

  } catch (error) {
    console.error('Error uploading attachments:', error);
    res.status(500).json({ success: false, error: 'Failed to upload attachments' });
  }
});

// Get attachment file
app.get('/api/attachments/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, 'uploads', 'attachments', filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving attachment:', error);
    res.status(500).json({ success: false, error: 'Failed to serve attachment' });
  }
});

// Delete attachment
app.delete('/api/cards/:cardId/attachments/:attachmentId', (req, res) => {
  try {
    const { cardId, attachmentId } = req.params;

    const card = dbService.getCard(cardId);
    if (!card) {
      return res.status(404).json({ success: false, error: 'Card not found' });
    }

    const currentAttachments = card.attachments || [];
    const attachmentToDelete = currentAttachments.find(att => att.id === attachmentId);

    if (!attachmentToDelete) {
      return res.status(404).json({ success: false, error: 'Attachment not found' });
    }

    // Delete file from filesystem
    const filePath = path.join(__dirname, 'uploads', 'attachments', attachmentToDelete.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remove from database
    const updatedAttachments = currentAttachments.filter(att => att.id !== attachmentId);
    const updatedCard = dbService.updateCard(cardId, {
      attachments: updatedAttachments
    });

    if (!updatedCard) {
      return res.status(500).json({ success: false, error: 'Failed to update card' });
    }

    res.json({ success: true, data: { remainingAttachments: updatedAttachments.length } });

  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({ success: false, error: 'Failed to delete attachment' });
  }
});

// Board operations
app.get('/api/boards/:boardId/lists', (req, res) => {
  try {
    const { boardId } = req.params;
    const lists = dbService.getListsByBoard(boardId);

    // Ensure all labels are arrays (fix for mixed data types)
    const normalizedLists = lists.map(list => ({
      ...list,
      cards: list.cards.map(card => ({
        ...card,
        labels: typeof card.labels === 'string' ?
          (card.labels ? JSON.parse(card.labels) : []) :
          (Array.isArray(card.labels) ? card.labels : [])
      }))
    }));

    res.json({ success: true, data: normalizedLists });
  } catch (error) {
    console.error('Error fetching lists:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch lists' });
  }
});

app.post('/api/boards/:boardId/lists', (req, res) => {
  try {
    const { boardId } = req.params;
    const { lists } = req.body;
    dbService.saveKanbanData(boardId, lists);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving lists:', error);
    res.status(500).json({ success: false, error: 'Failed to save lists' });
  }
});

// Card operations
app.get('/api/lists/:listId/cards', (req, res) => {
  try {
    const { listId } = req.params;
    const cards = dbService.getCardsByListId(listId);
    res.json({ success: true, data: cards });
  } catch (error) {
    console.error('Error getting cards:', error);
    res.status(500).json({ success: false, error: 'Failed to get cards' });
  }
});

app.post('/api/cards', (req, res) => {
  console.log('POST /api/cards ENDPOINT HIT!');
  try {
    const cardData = req.body;

    // Generate ID if not provided and map fields correctly
    const processedData = {
      id: cardData.id || `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      list_id: cardData.listId || cardData.list_id,
      title: cardData.title,
      description: cardData.description || null,
      position: cardData.position || 0,
      due_date: cardData.dueDate || cardData.due_date || null,
      labels: cardData.labels ? JSON.stringify(cardData.labels) : null,
      assigned_to: cardData.assignedTo || cardData.assigned_to || null
    };

    console.log('Creating card with data:', processedData);

    const card = dbService.createCard(processedData);
    res.json({ success: true, data: card });
  } catch (error) {
    console.error('Error creating card:', error);
    res.status(500).json({ success: false, error: 'Failed to create card' });
  }
});

app.put('/api/cards/:cardId', (req, res) => {
  try {
    const { cardId } = req.params;
    const updates = req.body;
    const card = dbService.updateCard(cardId, updates);
    res.json({ success: true, data: card });
  } catch (error) {
    console.error('Error updating card:', error);
    res.status(500).json({ success: false, error: 'Failed to update card' });
  }
});

app.delete('/api/cards/:cardId', (req, res) => {
  try {
    const { cardId } = req.params;
    const success = dbService.deleteCard(cardId);
    res.json({ success });
  } catch (error) {
    console.error('Error deleting card:', error);
    res.status(500).json({ success: false, error: 'Failed to delete card' });
  }
});

// List operations
app.post('/api/lists', (req, res) => {
  try {
    const listData = req.body;

    // Generate ID if not provided and map fields correctly
    const processedData = {
      id: listData.id || `list_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      board_id: listData.boardId || listData.board_id || '1',
      title: listData.title,
      type: listData.type || 'open',
      position: listData.position || 0,
      card_limit: listData.card_limit || null
    };

    console.log('Creating list with data:', processedData);

    const list = dbService.createList(processedData);
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('Error creating list:', error);
    res.status(500).json({ success: false, error: 'Failed to create list' });
  }
});

app.put('/api/lists/:listId', (req, res) => {
  try {
    const { listId } = req.params;
    const updates = req.body;
    const list = dbService.updateList(listId, updates);
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('Error updating list:', error);
    res.status(500).json({ success: false, error: 'Failed to update list' });
  }
});

app.delete('/api/lists/:listId', (req, res) => {
  try {
    const { listId } = req.params;
    const success = dbService.deleteList(listId);
    res.json({ success });
  } catch (error) {
    console.error('Error deleting list:', error);
    res.status(500).json({ success: false, error: 'Failed to delete list' });
  }
});

// Card actions operations
app.post('/api/card-actions', (req, res) => {
  try {
    const actionData = req.body;
    console.log('🎯 Creating card action:', JSON.stringify(actionData, null, 2));

    const success = dbService.createCardAction(actionData);
    console.log('🎯 Card action creation result:', success);

    if (success) {
      console.log('✅ Card action created successfully');
    } else {
      console.warn('⚠️ Card action creation returned false');
    }

    res.json({ success, data: actionData });
  } catch (error) {
    console.error('❌ Error creating card action:', error);
    res.status(500).json({ success: false, error: 'Failed to create card action' });
  }
});

app.get('/api/cards/:cardId/actions', (req, res) => {
  try {
    const { cardId } = req.params;
    const actions = dbService.getCardActions(cardId);
    res.json({ success: true, data: actions });
  } catch (error) {
    console.error('Error fetching card actions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch card actions' });
  }
});

app.delete('/api/card-actions/:actionId', (req, res) => {
  try {
    const { actionId } = req.params;
    const success = dbService.deleteCardAction(actionId);
    res.json({ success });
  } catch (error) {
    console.error('Error deleting card action:', error);
    res.status(500).json({ success: false, error: 'Failed to delete card action' });
  }
});

// Comment operations
app.get('/api/cards/:cardId/comments', (req, res) => {
  try {
    const { cardId } = req.params;
    const comments = dbService.getCardComments(cardId);
    res.json({ success: true, data: comments });
  } catch (error) {
    console.error('Error fetching card comments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch card comments' });
  }
});

app.post('/api/comments', (req, res) => {
  try {
    const { cardId, userId, username, text, timestamp, replyTo } = req.body;

    if (!cardId || !userId || !username || !text) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: cardId, userId, username, text'
      });
    }

    const commentId = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const commentData = {
      id: commentId,
      cardId,
      userId,
      username,
      text,
      timestamp: timestamp || Date.now(),
      replyTo: replyTo || undefined
    };

    const comment = dbService.createComment(commentData);
    res.json({ success: true, data: comment });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ success: false, error: 'Failed to create comment' });
  }
});

app.delete('/api/comments/:commentId', (req, res) => {
  try {
    const { commentId } = req.params;
    const success = dbService.deleteComment(commentId);

    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Comment not found' });
    }
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ success: false, error: 'Failed to delete comment' });
  }
});

// Bulk operations
app.put('/api/cards/positions', (req, res) => {
  console.log('🎯 PUT /api/cards/positions ENDPOINT HIT!');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  try {
    const { cards } = req.body;
    console.log('Cards to update:', cards);

    if (!cards || !Array.isArray(cards)) {
      return res.status(400).json({ success: false, error: 'Invalid cards data' });
    }

    dbService.updateCardsPositions(cards);
    console.log('✅ Cards positions updated successfully');
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error updating card positions:', error);
    res.status(500).json({ success: false, error: 'Failed to update positions' });
  }
});

app.put('/api/lists/positions', (req, res) => {
  try {
    const { lists } = req.body;
    dbService.updateListsPositions(lists);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating list positions:', error);
    res.status(500).json({ success: false, error: 'Failed to update positions' });
  }
});

// Settings operations
app.get('/api/settings/:key', (req, res) => {
  try {
    const { key } = req.params;
    const setting = dbService.getSetting(key);
    res.json({ success: true, data: setting });
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch setting' });
  }
});

app.post('/api/settings', (req, res) => {
  try {
    const { key, value } = req.body;

    // Handle empty/null values by either deleting the setting or using a default value
    if (value === null || value === undefined || value === '') {
      // If the value is empty, either delete the setting or use a null placeholder
      if (key === 'current_user_id') {
        // For current_user_id, we can delete the setting entirely when logging out
        try {
          dbService.deleteSetting(key);
          res.json({ success: true, data: { key, value: null } });
          return;
        } catch (deleteError) {
          // If delete fails, use a placeholder value
          const setting = dbService.setSetting(key, 'none');
          res.json({ success: true, data: setting });
          return;
        }
      } else {
        // For other settings, use a placeholder value
        const setting = dbService.setSetting(key, value || 'none');
        res.json({ success: true, data: setting });
        return;
      }
    }

    const setting = dbService.setSetting(key, value);
    res.json({ success: true, data: setting });
  } catch (error) {
    console.error('Error saving setting:', error);
    res.status(500).json({ success: false, error: 'Failed to save setting' });
  }
});

app.get('/api/settings', (req, res) => {
  try {
    const settings = dbService.getAllSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching all settings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

// User operations
app.get('/api/users/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const user = dbService.getUser(userId);
    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

app.get('/api/users/discord/:discordId', (req, res) => {
  try {
    const { discordId } = req.params;
    const user = dbService.getUserByDiscordId(discordId);
    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error fetching Discord user:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

// Get all Discord members with mod/admin roles
app.get('/api/discord/staff-members', async (req, res) => {
  try {
    if (!process.env.DISCORD_BOT_TOKEN || !process.env.VITE_DISCORD_GUILD_ID) {
      return res.status(500).json({
        success: false,
        error: 'Discord bot configuration missing'
      });
    }

    // Try to get all members from the guild with presence data
    const membersResponse = await fetch(
      `https://discord.com/api/guilds/${process.env.VITE_DISCORD_GUILD_ID}/members?limit=1000`,
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      }
    );

    // Also get the guild to access presence data
    let presences = {};
    try {
      const guildResponse = await fetch(
        `https://discord.com/api/guilds/${process.env.VITE_DISCORD_GUILD_ID}?with_counts=true`,
        {
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          },
        }
      );

      if (guildResponse.ok) {
        const guildData = await guildResponse.json();
        if (guildData.presences) {
          // Convert presences array to object for quick lookup
          presences = guildData.presences.reduce((acc, presence) => {
            acc[presence.user.id] = presence.status;
            return acc;
          }, {});
        }
      }
    } catch (error) {
      console.warn('Could not fetch guild presence data:', error);
    }

    if (membersResponse.ok) {
      const members = await membersResponse.json();
      const modRoleId = '1419343018904915968';  // trello mod role ID
      const adminRoleId = '1419342985543422154'; // trello admin role ID

      // Filter members with mod or admin roles
      const staffMembers = members
        .filter(member => {
          const roles = member.roles || [];
          return roles.includes(modRoleId) || roles.includes(adminRoleId);
        })
        .map(member => {
          const user = member.user;
          const roles = member.roles || [];
          const userRole = roles.includes(adminRoleId) ? 'admin' : 'mod';

          // Use Discord presence status if available, otherwise fallback to database activity
          const discordStatus = presences[user.id];
          let isOnline = false;
          let lastSeen = Date.now() - (24 * 60 * 60 * 1000); // Default to 24 hours ago

          if (discordStatus) {
            // Discord presence available - use real Discord status
            isOnline = discordStatus === 'online' || discordStatus === 'idle' || discordStatus === 'dnd';
            lastSeen = isOnline ? Date.now() : Date.now() - (30 * 60 * 1000); // 30 minutes ago if offline
          } else {
            // Fallback to recent activity on the site
            const dbUser = dbService.getUserByDiscordId(user.id);
            lastSeen = dbUser?.updated_at ? new Date(dbUser.updated_at).getTime() : Date.now() - (24 * 60 * 60 * 1000);

            // Consider online if active in the last minute on the site
            const ONLINE_THRESHOLD = 1 * 60 * 1000; // 1 minute
            isOnline = (Date.now() - lastSeen) < ONLINE_THRESHOLD;

            // Update the display time to be more user-friendly
            if (!isOnline && dbUser?.updated_at) {
              lastSeen = new Date(dbUser.updated_at).getTime();
            }
          }

          return {
            id: user.id,
            username: user.username,
            displayName: user.global_name || user.username,
            avatar: user.avatar,
            role: userRole,
            discordId: user.id,
            lastSeen: lastSeen,
            isOnline: isOnline,
            discordStatus: discordStatus || 'unknown',
            avatarUrl: user.avatar
              ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
              : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator || '0') % 5}.png`
          };
        });

      console.log(`Returning ${staffMembers.length} staff members from Discord API`);
      res.json({ success: true, data: staffMembers });
    } else {
      console.warn('Discord API failed, falling back to cached users');
      // Fallback to cached staff members from database
      const cachedStaffMembers = dbService.getAllUsers().filter(user => user.discord_id);

      // Transform to match expected format
      const staffMembers = cachedStaffMembers.map(member => ({
        id: member.discord_id,
        username: member.username || 'Unknown',
        displayName: member.display_name || member.username || 'Unknown',
        avatar: member.avatar,
        role: 'mod', // Default role, will be updated when users interact
        discordId: member.discord_id,
        lastSeen: Date.now() - (10 * 60 * 1000), // 10 minutes ago
        isOnline: false,
        avatarUrl: member.avatar
          ? `https://cdn.discordapp.com/avatars/${member.discord_id}/${member.avatar}.png`
          : `https://cdn.discordapp.com/embed/avatars/0.png`
      }));

      console.log(`Returning ${staffMembers.length} cached staff members`);
      res.json({ success: true, data: staffMembers });
    }
  } catch (error) {
    console.error('Error fetching Discord staff members:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch staff members'
    });
  }
});

// Update user's last activity timestamp (heartbeat)
app.post('/api/users/heartbeat', (req, res) => {
  try {
    const { discordId } = req.body;

    if (!discordId) {
      return res.status(400).json({ success: false, error: 'Discord ID required' });
    }

    const user = dbService.getUserByDiscordId(discordId);
    if (user) {
      // Update the user's updated_at timestamp to mark as online
      dbService.updateUser(user.id, { updated_at: new Date().toISOString() });
      res.json({ success: true, message: 'User marked online' });
    } else {
      res.status(404).json({ success: false, error: 'User not found' });
    }
  } catch (error) {
    console.error('Error updating user activity:', error);
    res.status(500).json({ success: false, error: 'Failed to update activity' });
  }
});

// Mark user as offline (when browser closes)
app.post('/api/users/offline', (req, res) => {
  try {
    const { discordId } = req.body;

    if (!discordId) {
      return res.status(400).json({ success: false, error: 'Discord ID required' });
    }

    const user = dbService.getUserByDiscordId(discordId);
    if (user) {
      // Set updated_at to past time to mark as offline
      const pastTime = new Date(Date.now() - (10 * 60 * 1000)); // 10 minutes ago
      dbService.updateUser(user.id, { updated_at: pastTime.toISOString() });
      res.json({ success: true, message: 'User marked offline' });
    } else {
      res.status(404).json({ success: false, error: 'User not found' });
    }
  } catch (error) {
    console.error('Error marking user offline:', error);
    res.status(500).json({ success: false, error: 'Failed to mark user offline' });
  }
});

app.post('/api/users', (req, res) => {
  try {
    const userData = req.body;
    const user = dbService.createUser(userData);
    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

app.put('/api/users/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    const user = dbService.updateUser(userId, updates);
    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

// Migration endpoint
app.post('/api/migrate', async (req, res) => {
  try {
    const migrationSuccess = MigrationService.markMigrationCompleted();
    res.json({ success: migrationSuccess });
  } catch (error) {
    console.error('Migration failed:', error);
    res.status(500).json({ success: false, error: 'Migration failed' });
  }
});

app.get('/api/migration/status', (req, res) => {
  try {
    const status = MigrationService.getMigrationStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('Error checking migration status:', error);
    res.status(500).json({ success: false, error: 'Failed to check migration status' });
  }
});

// Rate limiting helper function
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const clientLimits = discordAuthLimiter.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };

  if (now > clientLimits.resetTime) {
    clientLimits.count = 1;
    clientLimits.resetTime = now + RATE_LIMIT_WINDOW;
  } else {
    clientLimits.count++;
  }

  discordAuthLimiter.set(ip, clientLimits);
  return clientLimits.count > MAX_REQUESTS_PER_WINDOW;
}

// Discord OAuth endpoint
app.post('/api/discord-auth', async (req, res) => {
  try {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

    // Check rate limiting
    if (isRateLimited(clientIP)) {
      console.log(`Rate limit exceeded for IP: ${clientIP}`);
      return res.status(429).json({
        success: false,
        error: 'Too many authentication attempts. Please try again later.'
      });
    }

    const { code } = req.body;
    console.log('Discord auth request received:', { code: code ? 'present' : 'missing', ip: clientIP });

    if (!code) {
      return res.status(400).json({ success: false, error: 'Authorization code is required' });
    }

    // Check for required environment variables
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    if (!clientSecret || clientSecret === 'your_discord_client_secret_here') {
      console.error('Discord client secret not configured properly');
      return res.status(500).json({
        success: false,
        error: 'Discord authentication not configured. Please contact administrator.'
      });
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.VITE_DISCORD_CLIENT_ID || '1419343488327352361',
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.VITE_DISCORD_REDIRECT_URI || 'https://trello.enginemc.it/auth/discord/callback',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Discord token exchange failed:', errorText);
      throw new Error(`Failed to exchange code for token: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();

    // Get user information
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user data');
    }

    const userData = await userResponse.json();

    // Get user guild information to determine role
    let userRole = 'default';
    try {
      const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      if (guildsResponse.ok) {
        const guilds = await guildsResponse.json();
        const targetGuild = guilds.find(guild => guild.id === process.env.VITE_DISCORD_GUILD_ID);

        if (targetGuild) {
          // Get member information for role checking
          const memberResponse = await fetch(`https://discord.com/api/guilds/${process.env.VITE_DISCORD_GUILD_ID}/members/${userData.id}`, {
            headers: {
              Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            },
          });

          if (memberResponse.ok) {
            const memberData = await memberResponse.json();
            const roles = memberData.roles || [];

            if (roles.includes(process.env.VITE_DISCORD_ADMIN_ROLE_ID)) {
              userRole = 'admin';
            } else if (roles.includes(process.env.VITE_DISCORD_MOD_ROLE_ID)) {
              userRole = 'mod';
            }
          }
        }
      }
    } catch (roleError) {
      console.warn('Could not determine user role:', roleError);
    }

    // Format user data
    const user = {
      id: userData.id,
      username: userData.username,
      discriminator: userData.discriminator || '0000',
      avatar: userData.avatar,
      email: userData.email,
      verified: userData.verified,
      displayName: userData.global_name || userData.username,
      avatarUrl: userData.avatar
        ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(userData.discriminator) % 5}.png`
    };

    // Save user to database
    try {
      const existingUser = dbService.getUserByDiscordId(userData.id);

      // Extract avatar hash from Discord avatar URL
      const avatarHash = user.avatarUrl ? user.avatarUrl.split('/').pop()?.split('.')[0] : null;

      console.log('DEBUG: Saving user data to database:', {
        username: user.username,
        display_name: user.displayName,
        avatar: avatarHash,
        avatarUrl: user.avatarUrl
      });

      if (existingUser) {
        dbService.updateUser(existingUser.id, {
          username: user.username,
          display_name: user.displayName,
          email: user.email,
          avatar: avatarHash,
          role: userRole
        });
      } else {
        dbService.createUser({
          discord_id: userData.id,
          username: user.username,
          display_name: user.displayName,
          email: user.email,
          avatar: avatarHash,
          role: userRole
        });
      }
    } catch (dbError) {
      console.warn('Could not save user to database:', dbError);
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: userData.id,
        username: user.username,
        role: userRole,
        iat: Math.floor(Date.now() / 1000)
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Discord user data being sent:', {
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      username: user.username
    });

    res.json({
      success: true,
      user: user,
      role: userRole,
      token: token
    });

  } catch (error) {
    console.error('Discord auth error:', error);
    res.status(500).json({
      success: false,
      error: 'Discord authentication failed'
    });
  }
});

// Verify JWT token and get current user
app.get('/api/auth/me', authenticateToken, (req, res) => {
  try {
    const user = req.user;

    // Get full user data from database to include Discord info
    const dbUser = dbService.getUserByDiscordId(user.userId);
    console.log('DEBUG /api/auth/me - user.userId:', user.userId);
    console.log('DEBUG /api/auth/me - dbUser found:', !!dbUser);
    if (dbUser) {
      console.log('DEBUG /api/auth/me - dbUser data:', {
        username: dbUser.username,
        display_name: dbUser.display_name,
        avatar: dbUser.avatar
      });
    }

    const userData = {
      id: user.userId,
      username: dbUser?.username || user.username,
      displayName: dbUser?.display_name || dbUser?.username || user.username,
      role: user.role,
      avatarUrl: dbUser?.avatar ? `https://cdn.discordapp.com/avatars/${user.userId}/${dbUser.avatar}.png` : undefined
    };

    console.log('DEBUG /api/auth/me - returning userData:', userData);

    res.json({
      success: true,
      user: userData
    });
  } catch (error) {
    console.error('Error in /api/auth/me:', error);
    res.status(500).json({ success: false, error: 'Failed to get user info' });
  }
});

// Logout endpoint (client should delete token)
app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// Settings endpoints
app.get('/api/settings/:settingName', (req, res) => {
  try {
    const { settingName } = req.params;

    // Return null for settings that don't exist - this matches the expected behavior
    if (settingName === 'current_user_id') {
      // This should return the current user ID from authentication
      // For now, we'll return null since users should authenticate via Discord
      res.json({ success: true, data: null });
    } else {
      res.json({ success: true, data: null });
    }
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch setting' });
  }
});

// CachedStaff endpoints
app.get('/api/cached-staff', (req, res) => {
  try {
    const cachedStaffDir = '/var/www/trello/CachedStaff';

    if (!fs.existsSync(cachedStaffDir)) {
      console.log('CachedStaff directory does not exist, falling back to Discord API');
      return res.status(404).json({
        success: false,
        error: 'CachedStaff not available'
      });
    }

    const files = fs.readdirSync(cachedStaffDir).filter(file => file.endsWith('.json'));
    const staffMembers = [];

    for (const file of files) {
      try {
        const filePath = path.join(cachedStaffDir, file);
        const userData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // Format user data to match expected structure
        const staffMember = {
          id: userData.id,
          username: userData.username,
          displayName: userData.displayName || userData.global_name || userData.username,
          avatar: userData.avatar,
          role: userData.role || 'mod',
          discordId: userData.id,
          lastSeen: userData.lastSeen || Date.now() - (10 * 60 * 1000),
          isOnline: userData.isOnline || false,
          discordStatus: userData.discordStatus || 'offline',
          avatarUrl: userData.avatar
            ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
            : `https://cdn.discordapp.com/embed/avatars/${parseInt(userData.discriminator || '0') % 5}.png`
        };

        staffMembers.push(staffMember);
      } catch (fileError) {
        console.warn(`Error reading cached staff file ${file}:`, fileError);
      }
    }

    console.log(`✅ Returning ${staffMembers.length} cached staff members`);
    res.json({ success: true, data: staffMembers });
  } catch (error) {
    console.error('Error reading cached staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read cached staff data'
    });
  }
});

app.post('/api/cached-staff/refresh', (req, res) => {
  try {
    // This endpoint would trigger the Discord bot to refresh cached data
    // For now, we'll just return success since the bot will handle the actual refresh
    console.log('🔄 CachedStaff refresh requested');
    res.json({
      success: true,
      message: 'Cache refresh triggered. Bot will update CachedStaff directory within 1 minute.'
    });
  } catch (error) {
    console.error('Error triggering cache refresh:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger cache refresh'
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

// Serve React app for all other routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Database: SQLite with better-sqlite3`);
  console.log(`🔄 API available at http://localhost:${PORT}/api`);

  // Initialize database and migration service
  try {
    console.log('🔧 Initializing database...');
    // The database is initialized when we import dbService
    MigrationService.initialize();
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
  }
});