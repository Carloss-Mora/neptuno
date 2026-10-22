import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import pb from '@/lib/pocketbaseClient';

const GoogleAuthButton = ({ onAuthenticated }) => {
  const { loginWithGoogle } = useAuth();
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const loadProviders = async () => {
      try {
        const methods = await pb.collection('users').listAuthMethods({ $autoCancel: false });
        if (isMounted) {
          setAvailable(methods.oauth2?.providers?.some((provider) => provider.name === 'google') || false);
        }
      } catch (loadError) {
        console.error('Unable to load OAuth providers:', loadError);
        if (isMounted) setError('No se pudieron cargar los métodos de acceso.');
      }
    };

    loadProviders();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await loginWithGoogle();
      onAuthenticated();
    } catch (loginError) {
      setError(loginError.message || 'No se pudo iniciar sesión con Google.');
    } finally {
      setLoading(false);
    }
  };

  if (!available && !error) return null;

  return (
    <div className="space-y-2">
      {available && (
        <>
          <div className="py-1 text-center text-xs text-slate-500">o continúa con</div>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full border-slate-300 bg-white font-semibold text-slate-700 hover:bg-slate-50"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <span aria-hidden="true" className="mr-2 text-lg font-bold text-blue-600">G</span>
            {loading ? 'Conectando con Google…' : 'Continuar con Google'}
          </Button>
        </>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
};

export default GoogleAuthButton;
