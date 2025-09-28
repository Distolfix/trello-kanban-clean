// Utility per gestire l'autenticazione Discord lato client
// Nota: In un ambiente di produzione, il token exchange dovrebbe essere fatto server-side

export interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email: string;
  verified: boolean;
  displayName: string;
  avatarUrl: string;
}

// Track failed attempts to prevent infinite loops
let failedAttempts = 0;
const MAX_FAILED_ATTEMPTS = 3;
const COOLDOWN_PERIOD = 60000; // 1 minute
let lastFailTime = 0;

// Track used auth codes to prevent reuse
const usedAuthCodes = new Set<string>();

// Scambia il codice Discord con i dati utente reali
export const exchangeDiscordCode = async (code: string): Promise<{ user: DiscordUser; role: 'default' | 'mod' | 'admin'; token: string }> => {
  try {
    // Check if auth code was already used
    if (usedAuthCodes.has(code)) {
      throw new Error('Authorization code has already been used. Please start the authentication process again.');
    }

    // Check if we're in cooldown period
    const now = Date.now();
    if (failedAttempts >= MAX_FAILED_ATTEMPTS && (now - lastFailTime) < COOLDOWN_PERIOD) {
      const remainingTime = Math.ceil((COOLDOWN_PERIOD - (now - lastFailTime)) / 1000);
      throw new Error(`Too many failed attempts. Please wait ${remainingTime} seconds before trying again.`);
    }

    // Reset failed attempts if cooldown period has passed
    if ((now - lastFailTime) >= COOLDOWN_PERIOD) {
      failedAttempts = 0;
    }

    // Mark auth code as used immediately to prevent reuse
    usedAuthCodes.add(code);

    // Chiama l'API backend per gestire l'autenticazione in modo sicuro
    const response = await fetch('/api/discord-auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      failedAttempts++;
      lastFailTime = now;

      let errorMessage = 'Errore di autenticazione Discord';

      try {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } catch {
        // If we can't parse the response, use status text
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }

      if (response.status === 429) {
        errorMessage = 'Too many authentication attempts. Please wait and try again later.';
      } else if (response.status === 500) {
        errorMessage = 'Discord authentication is not properly configured. Please contact an administrator.';
      }

      throw new Error(errorMessage);
    }

    // Reset failed attempts on successful authentication
    failedAttempts = 0;

    const result = await response.json();

    // Clean up used auth code after successful use (with delay to prevent immediate reuse)
    setTimeout(() => {
      usedAuthCodes.delete(code);
    }, 30000); // Remove after 30 seconds

    return {
      user: result.user,
      role: result.role,
      token: result.token
    };

  } catch (error) {
    console.error('Discord auth error:', error);
    throw error;
  }
};

// Funzione per ottenere l'URL di autorizzazione Discord
export const getDiscordAuthUrl = (): string => {
  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID || '1419343488327352361';
  const redirectUri = import.meta.env.VITE_DISCORD_REDIRECT_URI || 'https://trello.enginemc.it/auth/discord/callback';
  const scope = 'identify email guilds';
  const state = generateRandomState();

  // Salva lo state per la verifica
  localStorage.setItem('discord_auth_state', state);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scope,
    state: state
  });

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
};

// Genera uno state casuale per sicurezza CSRF
export const generateRandomState = (): string => {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
};

// Verifica lo state CSRF
export const verifyState = (receivedState: string): boolean => {
  const savedState = localStorage.getItem('discord_auth_state');

  if (!savedState || !receivedState) {
    console.warn('Missing state for verification');
    return false;
  }

  const isValid = savedState === receivedState;

  if (isValid) {
    localStorage.removeItem('discord_auth_state'); // Pulisci solo se valido
  }

  return isValid;
};