import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import pb from '@/lib/pocketbaseClient';

const GoogleMark = () => (
  <svg aria-hidden="true" viewBox="0 0 48 48" className="mr-2 h-5 w-5">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.6 5.9c4.4-4.1 6.9-10.2 6.9-17.6z"/>
    <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/>
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
  </svg>
);

const GoogleAuthButton = ({ onAuthenticated, label = 'Continuar con Google', termsAccepted = false, requireTerms = false }) => {
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
      await loginWithGoogle({ termsAccepted });
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
          <div className="py-1 text-center text-xs text-slate-500">o usa tu cuenta de Google</div>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full border-slate-300 bg-white font-semibold text-slate-700 hover:bg-slate-50"
            onClick={handleGoogleLogin}
            disabled={loading || (requireTerms && !termsAccepted)}
          >
            <GoogleMark />
            {loading ? 'Conectando con Google…' : label}
          </Button>
        </>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
};

export default GoogleAuthButton;
