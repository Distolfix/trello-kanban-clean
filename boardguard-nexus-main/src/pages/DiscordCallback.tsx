import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDiscordAuth } from '@/hooks/useDiscordAuth';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export function DiscordCallback() {
  const navigate = useNavigate();
  const { exchangeCodeForToken } = useDiscordAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent multiple executions
    if (hasProcessed.current) {
      return;
    }

    const handleCallback = async () => {
      // Mark as processed immediately to prevent re-execution
      hasProcessed.current = true;

      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        // Clear URL parameters immediately to prevent re-processing
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);

        if (error) {
          throw new Error(`Discord OAuth error: ${error}`);
        }

        if (!code || !state) {
          throw new Error('Parametri di callback mancanti');
        }

        setStatus('processing');

        // Scambia il codice per i dati utente
        const result = await exchangeCodeForToken(code, state);

        setStatus('success');

        toast({
          title: "Login Discord completato!",
          description: `Benvenuto, ${result.user.username}! Ruolo: ${result.role}`,
        });

        // Comunica i dati al parent window se siamo in un popup
        if (window.opener) {
          window.opener.postMessage({
            type: 'DISCORD_AUTH_SUCCESS',
            user: result.user,
            role: result.role,
            token: result.token
          }, window.location.origin);
          window.close();
        } else {
          // Altrimenti reindirizza alla home page
          setTimeout(() => navigate('/'), 2000);
        }

      } catch (error) {
        console.error('Discord callback error:', error);
        setStatus('error');

        const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';

        toast({
          title: "Errore di autenticazione",
          description: errorMessage,
          variant: "destructive",
        });

        if (window.opener) {
          window.opener.postMessage({
            type: 'DISCORD_AUTH_ERROR',
            error: errorMessage
          }, window.location.origin);
          window.close();
        } else {
          // Navigate immediately to prevent re-processing
          navigate('/');
        }
      }
    };

    handleCallback();
  }, []); // Remove dependencies to prevent re-execution

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4 p-8">
        {status === 'processing' && (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            <h2 className="text-xl font-semibold">Completamento autenticazione Discord...</h2>
            <p className="text-muted-foreground">Attendere prego, stiamo elaborando i tuoi dati.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-green-600">Autenticazione completata!</h2>
            <p className="text-muted-foreground">Sarai reindirizzato tra poco...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-red-600">Errore di autenticazione</h2>
            <p className="text-muted-foreground">Sarai reindirizzato alla home page...</p>
          </>
        )}
      </div>
    </div>
  );
}