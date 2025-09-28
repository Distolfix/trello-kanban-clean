const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configurazione Discord
const DISCORD_CLIENT_ID = 'your_discord_client_id_here';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || 'your_discord_bot_token_here';
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:8082/auth/discord/callback';
const DISCORD_GUILD_ID = '1285376886561706045';
const ADMIN_ROLE_ID = '1419342985543422154';
const MOD_ROLE_ID = '1419343018904915968';

// Middleware
app.use(cors({
  origin: ['https://trello.enginemc.it', 'http://localhost:8081', 'http://localhost:8082'],
  credentials: true
}));
app.use(express.json());

// Importa node-fetch in modo compatibile
let fetch;
(async () => {
  const { default: nodeFetch } = await import('node-fetch');
  fetch = nodeFetch;
})();

// Endpoint per l'autenticazione Discord
app.post('/api/discord-auth', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    console.log('Processing Discord auth for code:', code.substring(0, 10) + '...');

    // 1. Scambia il codice per un access token
    const tokenParams = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: DISCORD_REDIRECT_URI,
    });

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams,
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange error:', error);
      return res.status(400).json({ error: 'Failed to exchange code for token' });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    console.log('Got access token, fetching user data...');

    // 2. Ottieni i dati dell'utente
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      console.error('User fetch error:', await userResponse.text());
      return res.status(400).json({ error: 'Failed to fetch user data' });
    }

    const userData = await userResponse.json();
    console.log('Got user data for:', userData.username);

    // 3. Ottieni i ruoli dell'utente nel server specifico
    let userRole = 'default';
    let guildMember = null;

    try {
      const memberResponse = await fetch(
        `https://discord.com/api/guilds/${DISCORD_GUILD_ID}/members/${userData.id}`,
        {
          headers: {
            Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          },
        }
      );

      if (memberResponse.ok) {
        guildMember = await memberResponse.json();
        console.log('Guild member roles:', guildMember.roles);

        // Controlla i ruoli dell'utente
        if (guildMember.roles.includes(ADMIN_ROLE_ID)) {
          userRole = 'admin';
          console.log('User has admin role');
        } else if (guildMember.roles.includes(MOD_ROLE_ID)) {
          userRole = 'mod';
          console.log('User has mod role');
        }
      } else {
        console.log('User not found in guild or bot lacks permissions');
      }
    } catch (error) {
      console.error('Failed to fetch guild member:', error);
    }

    // 4. Costruisci la risposta
    const result = {
      user: {
        id: userData.id,
        username: userData.username,
        discriminator: userData.discriminator,
        avatar: userData.avatar,
        email: userData.email,
        verified: userData.verified,
        displayName: guildMember?.nick || userData.global_name || userData.username,
        avatarUrl: userData.avatar
          ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png?size=256`
          : `https://cdn.discordapp.com/embed/avatars/${parseInt(userData.discriminator) % 5}.png`
      },
      role: userRole,
      token: accessToken
    };

    console.log('Auth successful for:', result.user.displayName, 'Role:', userRole);
    res.json(result);

  } catch (error) {
    console.error('Discord auth error:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Discord Auth Server running on port ${PORT}`);
  console.log(`DISCORD_CLIENT_ID: ${DISCORD_CLIENT_ID}`);
  console.log(`DISCORD_GUILD_ID: ${DISCORD_GUILD_ID}`);
  console.log(`ADMIN_ROLE_ID: ${ADMIN_ROLE_ID}`);
  console.log(`MOD_ROLE_ID: ${MOD_ROLE_ID}`);
});