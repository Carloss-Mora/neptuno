import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { CheckCircle2, CircleAlert, Droplets, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const { confirmEmailVerification } = useAuth();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const confirmationRef = useRef(null);

  useEffect(() => {
    let active = true;
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage('El enlace no contiene un token de verificación.');
      return () => {
        active = false;
      };
    }

    if (!confirmationRef.current || confirmationRef.current.token !== token) {
      confirmationRef.current = {
        token,
        promise: confirmEmailVerification(token),
      };
    }

    confirmationRef.current.promise
      .then(() => {
        if (active) setStatus('success');
      })
      .catch((error) => {
        if (active) {
          setStatus('error');
          setMessage(error.message);
        }
      });

    return () => {
      active = false;
    };
  }, [confirmEmailVerification, searchParams]);

  return (
    <>
      <Helmet>
        <title>Verificación de correo - Neptuno</title>
      </Helmet>
      <main className="flex min-h-screen items-center justify-center p-4 bg-dew">
        <Card className="w-full max-w-md border-teal-100 shadow-xl">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-700 text-white drop-logo">
              <Droplets className="h-8 w-8" />
            </div>
            <CardTitle>Verificación de correo</CardTitle>
            <CardDescription>Protegemos tu cuenta de Neptuno.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            {status === 'loading' && (
              <div role="status" className="flex items-center justify-center gap-2 text-slate-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                Confirmando tu correo…
              </div>
            )}
            {status === 'success' && (
              <>
                <CheckCircle2 className="mx-auto h-10 w-10 text-teal-700" />
                <p className="text-slate-700">Tu correo quedó verificado. Ya puedes iniciar sesión.</p>
                <Button asChild className="w-full bg-teal-700 hover:bg-teal-800">
                  <Link to="/login">Ir a iniciar sesión</Link>
                </Button>
              </>
            )}
            {status === 'error' && (
              <>
                <CircleAlert className="mx-auto h-10 w-10 text-amber-600" />
                <p role="alert" className="text-sm text-slate-700">{message}</p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/login">Volver a iniciar sesión</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
};

export default VerifyEmailPage;
