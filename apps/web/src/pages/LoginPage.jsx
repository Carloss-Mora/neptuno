
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCooldown } from '@/hooks/useCooldown';
import GoogleAuthButton from '@/components/GoogleAuthButton';
import { Droplets, Mail, Lock, AlertCircle } from 'lucide-react';

const LoginPage = () => {
  const { login, resendVerification, verifyEmailCode } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [otpId, setOtpId] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeFailed, setCodeFailed] = useState(false);
  const cooldown = useCooldown();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
    setVerificationMessage('');
    setOtpId('');
    setVerificationCode('');
    setCodeFailed(false);
  };

  const handleResendVerification = async () => {
    setError('');
    setVerificationMessage('');
    setOtpId('');
    setVerificationCode('');
    if (!formData.email) {
      setError('Escribe tu correo para solicitar un código de verificación.');
      return;
    }

    setLoading(true);
    try {
      const result = await resendVerification(formData.email);
      setCodeFailed(!result.delivered);
      setOtpId(result.delivered ? result.otpId || '' : '');
      setVerificationCode('');
      setVerificationMessage(result.message);
      cooldown.start(60);
    } catch (resendError) {
      setCodeFailed(true);
      setError(resendError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verifyEmailCode(otpId, verificationCode);
      navigate('/dashboard');
    } catch (verificationError) {
      setError(verificationError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.email || !formData.password) {
      setError('Por favor, completa todos los campos');
      setLoading(false);
      return;
    }

    try {
      await login(formData.email, formData.password);
      navigate('/dashboard');
    } catch (err) {
      if (err.requiresVerification) {
        setCodeFailed(true);
        setVerificationMessage(err.message);
      } else {
        setError(err.message || 'Error al iniciar sesión. Verifica tus credenciales.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Iniciar Sesión - Neptuno</title>
        <meta name="description" content="Inicia sesión en tu cuenta de Neptuno para acceder a tu panel de monitoreo de riego" />
      </Helmet>

      <div className="min-h-screen flex items-center justify-center p-4 bg-dew">
        <Card className="w-full max-w-md shadow-2xl border-teal-100">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg bg-teal-700 drop-logo">
                <Droplets className="w-9 h-9 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-teal-800">
              Bienvenido de nuevo
            </CardTitle>
            <CardDescription className="text-base text-gray-600">
              Inicia sesión para acceder a tu panel de riego
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form noValidate onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
              {verificationMessage && (
                <p
                  role={otpId && !codeFailed ? 'status' : 'alert'}
                  className={`rounded-lg border p-3 text-sm ${
                    otpId && !codeFailed
                      ? 'border-teal-200 bg-teal-50 text-teal-800'
                      : 'border-red-200 bg-red-50 text-red-800'
                  }`}
                >
                  {verificationMessage}
                </p>
              )}
              {otpId && (
                <div className="space-y-3">
                  <Label htmlFor="login-verification-code">Código de verificación</Label>
                  <InputOTP
                    id="login-verification-code"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={verificationCode}
                    onChange={(value) => setVerificationCode(value.replace(/\D/g, '').slice(0, 6))}
                    aria-label="Código de verificación de seis dígitos"
                    className="justify-center"
                  >
                    <InputOTPGroup className="gap-2">
                      {Array.from({ length: 6 }, (_, index) => (
                        <InputOTPSlot
                          key={index}
                          index={index}
                          className="h-12 w-11 rounded-lg border border-slate-300 text-lg font-semibold first:border last:border focus-within:border-teal-600"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                  <Button type="button" className="w-full bg-teal-700 hover:bg-teal-800" onClick={handleVerifyCode} disabled={loading || verificationCode.length !== 6}>
                    {loading ? 'Verificando…' : 'Verificar código'}
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 font-medium">Correo Electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="tu@correo.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="pl-10 h-11 border-gray-300 focus:border-teal-500 focus:ring-teal-500 text-gray-900"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700 font-medium">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    minLength={8}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    className="pl-10 h-11 border-gray-300 focus:border-teal-500 focus:ring-teal-500 text-gray-900"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500">
                  La contraseña distingue mayúsculas y minúsculas y debe tener al menos 8 caracteres.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-white font-semibold shadow-lg hover:shadow-xl transition-all bg-teal-700 hover:bg-teal-800"
                disabled={loading}
              >
                {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>

              <Button type="button" variant="link" className="w-full text-teal-700" onClick={handleResendVerification} disabled={loading || cooldown.remaining > 0}>
                {cooldown.remaining > 0 ? `Enviarme un código (${cooldown.remaining} s)` : 'Enviarme un código'}
              </Button>
              <GoogleAuthButton onAuthenticated={() => navigate('/dashboard')} />

              <div className="text-center pt-2">
                <p className="text-sm text-gray-600">
                  ¿No tienes una cuenta?{' '}
                  <Link to="/signup" className="text-teal-600 hover:text-teal-700 font-semibold hover:underline">
                    Regístrate
                  </Link>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default LoginPage;
