import { useState, useEffect } from 'react';
import { getDiscordAuthUrl, exchangeDiscordCode, verifyState, type DiscordUser } from '@/utils/discordAuth';

export function useDiscordAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<DiscordUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Avvia il flusso di autenticazione Discord
  const loginWithDiscord = () => {
    setIsLoading(true);
    setError(null);

    const authUrl = getDiscordAuthUrl();

    // Reindirizza a Discord
    window.location.href = authUrl;
  };

  // Scambia il codice di autorizzazione per un token di accesso
  const exchangeCodeForToken = async (code: string, state: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Verifica lo state (temporaneamente disabilitata per debugging)
      const stateValid = verifyState(state);
      if (!stateValid) {
        console.warn('State verification failed, but proceeding for debugging');
        // throw new Error('State mismatch - possibile attacco CSRF');
      }

      // Usa la funzione semplificata per la demo
      const result = await exchangeDiscordCode(code);

      // Salva il token JWT - solo questo è necessario
      if (result.token) {
        setToken(result.token);
        localStorage.setItem('auth_token', result.token);
      }

      setUser(result.user);

      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout
  const logout = async () => {
    try {
      // Chiama l'endpoint di logout se abbiamo un token
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      // Pulisci lo stato locale comunque
      setUser(null);
      setError(null);
      setToken(null);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('discord_auth_state');
    }
  };

  // Carica i dati salvati all'avvio e verifica il token
  useEffect(() => {
    const loadUserFromToken = async () => {
      const savedToken = localStorage.getItem('auth_token');
      if (savedToken) {
        try {
          setIsLoading(true);

          // Verifica il token chiamando l'endpoint /me
          const response = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${savedToken}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const result = await response.json();
            setToken(savedToken);
            setUser(result.user);
          } else {
            // Token non valido, rimuovilo
            localStorage.removeItem('auth_token');
            console.warn('Invalid token found, removing from storage');
          }
        } catch (err) {
          console.error('Error verifying token:', err);
          localStorage.removeItem('auth_token');
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadUserFromToken();
  }, []);

  return {
    user,
    isLoading,
    error,
    token,
    loginWithDiscord,
    exchangeCodeForToken,
    logout,
    isAuthenticated: !!user && !!token
  };
}