#!/usr/bin/env node

// Discord Bot reale per gestire presenza e aggiornare CachedStaff
const { Client, GatewayIntentBits, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Configurazione
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || 'your_discord_bot_token_here';
const DISCORD_GUILD_ID = '1285376886561706045';
const ADMIN_ROLE_ID = '1419342985543422154';
const MOD_ROLE_ID = '1419343018904915968';
const CACHED_STAFF_DIR = '/var/www/trello/CachedStaff';

// Crea client Discord con gli intents necessari
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences // Fondamentale per i dati di presenza!
  ]
});

// Mappa per tenere traccia dei membri staff
const staffMembers = new Map();

// Funzione per determinare il ruolo dell'utente
function getUserRole(member) {
  if (member.roles.cache.has(ADMIN_ROLE_ID)) {
    return 'admin';
  } else if (member.roles.cache.has(MOD_ROLE_ID)) {
    return 'mod';
  }
  return null; // Non è staff
}

// Funzione per aggiornare il file cache di un membro
function updateStaffCache(member) {
  const userRole = getUserRole(member);

  // Solo aggiorna se è staff
  if (!userRole) return;

  const user = member.user;
  const presence = member.presence;

  // Determina status Discord reale
  let discordStatus = 'offline';
  let isOnline = false;

  if (presence) {
    discordStatus = presence.status || 'offline';
    // Solo "online" è considerato veramente online per isOnline
    // dnd, idle sono "presenti" ma non "online" per la logica business
    isOnline = discordStatus === 'online';
  }

  const cacheData = {
    id: user.id,
    username: user.username,
    displayName: member.displayName || user.globalName || user.username,
    global_name: member.displayName || user.globalName || user.username,
    avatar: user.avatar,
    discriminator: user.discriminator || "0",
    role: userRole,
    lastSeen: isOnline ? Date.now() : Date.now() - (5 * 60 * 1000), // 5 min fa se offline
    isOnline: isOnline,
    discordStatus: discordStatus
  };

  // Salva nel file cache
  const filename = `${user.id}.json`;
  const filepath = path.join(CACHED_STAFF_DIR, filename);

  try {
    fs.writeFileSync(filepath, JSON.stringify(cacheData, null, 2));
    console.log(`✅ [${new Date().toLocaleTimeString()}] Aggiornato ${cacheData.displayName}: ${getStatusEmoji(discordStatus)} ${discordStatus}`);
  } catch (error) {
    console.error(`❌ Errore salvando cache per ${user.username}:`, error);
  }

  // Aggiorna la mappa locale
  staffMembers.set(user.id, cacheData);
}

// Emoji per stati Discord
function getStatusEmoji(status) {
  const statusEmojis = {
    'online': '🟢',
    'idle': '🟡',
    'dnd': '🔴',
    'offline': '⚫'
  };
  return statusEmojis[status] || '⚫';
}

// Funzione per aggiornare tutti i membri staff
async function updateAllStaffMembers(guild) {
  try {
    console.log(`🔄 [${new Date().toLocaleTimeString()}] Aggiornamento completo membri staff...`);

    // Fetch tutti i membri della guild
    await guild.members.fetch();

    let staffCount = 0;

    guild.members.cache.forEach(member => {
      const userRole = getUserRole(member);
      if (userRole) {
        updateStaffCache(member);
        staffCount++;
      }
    });

    console.log(`📊 [${new Date().toLocaleTimeString()}] Aggiornati ${staffCount} membri staff`);

    // Mostra stato attuale
    console.log('\n📋 Stato attuale staff:');
    staffMembers.forEach(member => {
      const emoji = getStatusEmoji(member.discordStatus);
      console.log(`   ${emoji} ${member.displayName} (@${member.username}) - ${member.discordStatus}`);
    });
    console.log('');

  } catch (error) {
    console.error('❌ Errore aggiornamento staff:', error);
  }
}

// Event: Bot pronto
client.once(Events.ClientReady, async (readyClient) => {
  console.log(`🚀 Discord Bot connesso come ${readyClient.user.tag}`);
  console.log(`📡 Connesso alla guild: ${DISCORD_GUILD_ID}`);
  console.log(`🔐 Intents abilitati: Guilds, GuildMembers, GuildPresences`);

  try {
    const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
    console.log(`✅ Guild trovata: ${guild.name}`);

    // Aggiornamento iniziale
    await updateAllStaffMembers(guild);

    // Aggiornamento periodico ogni 5 minuti
    setInterval(async () => {
      await updateAllStaffMembers(guild);
    }, 5 * 60 * 1000);

  } catch (error) {
    console.error('❌ Errore inizializzazione bot:', error);
  }
});

// Event: Cambio presenza utente (TEMPO REALE!)
client.on(Events.PresenceUpdate, (oldPresence, newPresence) => {
  const member = newPresence.member;
  if (!member) return;

  const userRole = getUserRole(member);
  if (!userRole) return; // Solo staff

  const oldStatus = oldPresence?.status || 'offline';
  const newStatus = newPresence.status || 'offline';

  if (oldStatus !== newStatus) {
    console.log(`🔄 [${new Date().toLocaleTimeString()}] ${member.displayName}: ${getStatusEmoji(oldStatus)} ${oldStatus} → ${getStatusEmoji(newStatus)} ${newStatus}`);
    updateStaffCache(member);
  }
});

// Event: Membro aggiunto/aggiornato
client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
  const oldRole = getUserRole(oldMember);
  const newRole = getUserRole(newMember);

  // Se è diventato staff o ha cambiato ruolo
  if (!oldRole && newRole) {
    console.log(`📈 [${new Date().toLocaleTimeString()}] ${newMember.displayName} è diventato ${newRole}`);
    updateStaffCache(newMember);
  } else if (oldRole && !newRole) {
    console.log(`📉 [${new Date().toLocaleTimeString()}] ${newMember.displayName} non è più staff`);
    // Rimuovi dalla cache
    const filename = `${newMember.user.id}.json`;
    const filepath = path.join(CACHED_STAFF_DIR, filename);
    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        console.log(`🗑️ Rimosso dalla cache: ${newMember.displayName}`);
      }
    } catch (error) {
      console.error(`❌ Errore rimozione cache:`, error);
    }
    staffMembers.delete(newMember.user.id);
  } else if (oldRole && newRole && oldRole !== newRole) {
    console.log(`🔄 [${new Date().toLocaleTimeString()}] ${newMember.displayName}: ${oldRole} → ${newRole}`);
    updateStaffCache(newMember);
  }
});

// Event: Errori
client.on(Events.Error, (error) => {
  console.error('❌ Errore Discord Client:', error);
});

client.on(Events.Warn, (warning) => {
  console.warn('⚠️ Warning Discord Client:', warning);
});

// Gestione chiusura graceful
process.on('SIGINT', () => {
  console.log('\n🛑 Chiusura Discord Bot...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Terminazione Discord Bot...');
  client.destroy();
  process.exit(0);
});

// Crea directory cache se non exists
if (!fs.existsSync(CACHED_STAFF_DIR)) {
  fs.mkdirSync(CACHED_STAFF_DIR, { recursive: true });
  console.log(`📁 Creata directory cache: ${CACHED_STAFF_DIR}`);
}

// Avvia il bot
console.log('🚀 Avvio Discord Bot con Gateway WebSocket...');
console.log('📡 Connessione alla Discord Gateway per dati presenza reali...');
client.login(DISCORD_BOT_TOKEN);