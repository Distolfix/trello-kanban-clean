// API endpoint per gestire l'autenticazione Discord
// Questo deve essere ospitato su un server backend sicuro

const DISCORD_CLIENT_ID = 'your_discord_client_id_here';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || 'your_client_secret_here';
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || 'your_discord_bot_token_here';
const DISCORD_REDIRECT_URI = 'https://trello.enginemc.it/auth/discord/callback';
const DISCORD_GUILD_ID = '1285376886561706045';
const ADMIN_ROLE_ID = '1419342985543422154';
const MOD_ROLE_ID = '1419343018904915968';

export default async function handler(req, res) {
  // Abilita CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://trello.enginemc.it');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, state } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    // 1. Scambia il codice per un access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange error:', error);
      return res.status(400).json({ error: 'Failed to exchange code for token' });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 2. Ottieni i dati dell'utente
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      return res.status(400).json({ error: 'Failed to fetch user data' });
    }

    const userData = await userResponse.json();

    // 3. Ottieni i ruoli dell'utente nel server specifico usando il bot token
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

        // Controlla i ruoli dell'utente
        if (guildMember.roles.includes(ADMIN_ROLE_ID)) {
          userRole = 'admin';
        } else if (guildMember.roles.includes(MOD_ROLE_ID)) {
          userRole = 'mod';
        }
      }
    } catch (error) {
      console.error('Failed to fetch guild member:', error);
      // Non bloccare il login se non riusciamo a ottenere i ruoli
    }

    // 4. Costruisci la risposta con i dati completi dell'utente
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
      token: accessToken,
      guildMember: guildMember ? {
        nick: guildMember.nick,
        roles: guildMember.roles,
        joinedAt: guildMember.joined_at
      } : null
    };

    res.status(200).json(result);

  } catch (error) {
    console.error('Discord auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}