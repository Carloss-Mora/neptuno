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
import { Droplets, Mail, Lock, User, AlertCircle, CheckCircle2 } from 'lucide-react';

const SignupPage = () => {
  const { signup, resendVerification, verifyEmailCode } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
  });
  const [error, setError] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [otpId, setOtpId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verificationError, setVerificationError] = useState(false);
  const [loading, setLoading] = useState(false);
  const cooldown = useCooldown();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const validateForm = () => {
    if (!formData.name || !formData.email || !formData.password || !formData.passwordConfirm) {
      setError('Por favor, completa todos los campos');
      return false;
    }

    if (formData.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return false;
    }

    if (formData.password !== formData.passwordConfirm) {
      setError('Las contraseñas no coinciden');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Por favor, introduce un correo electrónico válido');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const result = await signup(
        formData.email,
        formData.password,
        formData.passwordConfirm,
        formData.name,
      );
      if (result.requiresVerification) {
        setVerificationEmail(result.email);
        setOtpId(result.otpId || '');
        setVerificationError(!result.emailSent);
        setVerificationMessage(result.emailSent
          ? result.verificationMessage
          : `La cuenta se creó, pero no se pudo enviar el código. ${result.verificationMessage || result.verificationErrorMessage || 'Revisa la configuración del correo e inténtalo de nuevo.'}`);
        cooldown.start(60);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Error al crear la cuenta. Por favor, inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    setVerificationMessage('');
    setVerificationError(false);
    setOtpId('');
    setVerificationCode('');
    try {
      const result = await resendVerification(verificationEmail);
      setOtpId(result.delivered ? result.otpId || '' : '');
      setVerificationCode('');
      setVerificationError(!result.delivered);
      setVerificationMessage(result.message);
      cooldown.start(60);
    } catch (resendError) {
      setVerificationError(true);
      setVerificationMessage(resendError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (event) => {
    event.preventDefault();
    setLoading(true);
    setVerificationMessage('');
    setVerificationError(false);
    try {
      await verifyEmailCode(otpId, verificationCode);
      navigate('/dashboard');
    } catch (verificationError) {
      setVerificationError(true);
      setVerificationMessage(verificationError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Registro - Neptuno</title>
        <meta name="description" content="Crea tu cuenta de Neptuno para comenzar a monitorear tu sistema de riego" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-teal-100">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Droplets className="w-9 h-9 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
              Crear Cuenta
            </CardTitle>
            <CardDescription className="text-base text-gray-600">
              Comienza a monitorear tu sistema de riego hoy
            </CardDescription>
          </CardHeader>
          <CardContent>
            {verificationEmail ? (
              <form onSubmit={handleVerifyCode} className="space-y-5 text-center">
                {verificationError
                  ? <AlertCircle className="mx-auto h-12 w-12 text-amber-600" />
                  : <CheckCircle2 className="mx-auto h-12 w-12 text-teal-700" />}
                <div>
                  <h2 className="font-semibold text-slate-900">Verifica tu correo</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Cuenta creada para <strong>{verificationEmail}</strong>. Introduce el código para activarla.
                  </p>
                </div>
                <p
                  role={verificationError ? 'alert' : 'status'}
                  className={`text-sm ${verificationError ? 'text-red-700' : 'text-slate-700'}`}
                >
                  {verificationMessage}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="verification-code">Código de seis dígitos</Label>
                  <InputOTP
                    id="verification-code"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={verificationCode}
                    onChange={(value) => setVerificationCode(value.replace(/\D/g, '').slice(0, 6))}
                    aria-label="Código de verificación de seis dígitos"
                    aria-describedby="verification-code-help"
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
                  <p id="verification-code-help" className="text-xs text-slate-500">
                    Puedes escribir o pegar los seis dígitos que recibiste por correo.
                  </p>
                </div>
                <Button type="submit" className="w-full bg-teal-700 hover:bg-teal-800" disabled={loading || !otpId || verificationCode.length !== 6}>
                  {loading ? 'Verificando…' : 'Verificar correo'}
                </Button>
                <Button type="button" variant="outline" onClick={handleResendVerification} disabled={loading || cooldown.remaining > 0}>
                  {loading ? 'Enviando…' : cooldown.remaining > 0 ? `Enviar otro código (${cooldown.remaining} s)` : 'Enviar otro código'}
                </Button>
                <p className="text-sm text-gray-600">
                  <Link to="/login" className="font-semibold text-teal-700 hover:underline">
                    Volver a iniciar sesión
                  </Link>
                </p>
              </form>
            ) : (
            <form noValidate onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-700 font-medium">Nombre Completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input id="name" name="name" type="text" placeholder="Juan Pérez" value={formData.name} onChange={handleChange} className="pl-10 h-11 border-gray-300 focus:border-teal-500 focus:ring-teal-500 text-gray-900" required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 font-medium">Correo Electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input id="email" name="email" type="email" placeholder="tu@correo.com" value={formData.email} onChange={handleChange} className="pl-10 h-11 border-gray-300 focus:border-teal-500 focus:ring-teal-500 text-gray-900" required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700 font-medium">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} aria-describedby="password-requirements" placeholder="••••••••" value={formData.password} onChange={handleChange} className="pl-10 h-11 border-gray-300 focus:border-teal-500 focus:ring-teal-500 text-gray-900" required />
                </div>
                <p id="password-requirements" className="text-xs text-gray-500">
                  Mínimo 8 caracteres. No necesitas incluir mayúsculas, números ni símbolos; sí puedes usarlos para crear una clave más segura. Distingue mayúsculas y minúsculas.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="passwordConfirm" className="text-gray-700 font-medium">Confirmar Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input id="passwordConfirm" name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} placeholder="••••••••" value={formData.passwordConfirm} onChange={handleChange} className="pl-10 h-11 border-gray-300 focus:border-teal-500 focus:ring-teal-500 text-gray-900" required />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                disabled={loading}
              >
                {loading ? 'Creando cuenta...' : 'Crear cuenta'}
              </Button>

              <GoogleAuthButton onAuthenticated={() => navigate('/dashboard')} />

              <div className="text-center pt-2">
                <p className="text-sm text-gray-600">
                  ¿Ya tienes una cuenta?{' '}
                  <Link to="/login" className="text-teal-600 hover:text-teal-700 font-semibold hover:underline">
                    Iniciar Sesión
                  </Link>
                </p>
              </div>
            </form>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default SignupPage;