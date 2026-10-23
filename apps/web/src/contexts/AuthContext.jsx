
import React, { createContext, useContext, useState, useEffect } from 'react';
import pb from '@/lib/pocketbaseClient';

export const AuthContext = createContext(null);

const extractErrorMessage = (error, fallback = 'Ha ocurrido un error inesperado.', emailHint = '') => {
  const payload = error?.response?.data ?? error?.data ?? {};
  const values = [];

  const addValue = (value) => {
    if (typeof value === 'string' && value.trim()) values.push(value.trim());
    if (Array.isArray(value)) value.forEach(addValue);
    if (value && typeof value === 'object') {
      Object.values(value).forEach(addValue);
    }
  };

  const emailCandidate = typeof emailHint === 'string' && emailHint.trim()
    ? emailHint.trim()
    : values.find((value) => /\S+@\S+\.\S+/.test(value)) || '';

  addValue(payload);
  addValue(error?.message);

  const normalized = values.join(' ').toLowerCase();
  if (
    /not verified|unverified|verification required|must be verified/.test(normalized)
    || /request does not satisfy the collection requirements to authenticate|request doesn't satisfy the collection requirements to authenticate/.test(normalized)
  ) {
    return 'Esta cuenta todavía no ha verificado su correo. Solicita un código de seis dígitos para confirmarlo. No es un error de formato de contraseña.';
  }
  const isDuplicateEmailError = (
    /validation_not_unique|already.*exists|already.*registered|duplicate.*email|email.*already.*used|value must be unique/i.test(normalized)
    || payload?.email?.code === 'validation_not_unique'
    || payload?.email?.message?.toLowerCase()?.includes('unique')
    || payload?.code === 'validation_not_unique'
  );

  if (isDuplicateEmailError) {
    return emailCandidate
      ? `El correo ${emailCandidate} ya tiene una cuenta asociada.`
      : 'Este correo ya tiene una cuenta asociada.';
  }

  if (/already|registered|exists|duplicate|email.*used|email.*registered/.test(normalized)) {
    return emailCandidate
      ? `El correo ${emailCandidate} ya tiene una cuenta asociada.`
      : 'Este correo ya tiene una cuenta asociada.';
  }

  if ((/error al procesar su solicitud|problem processing|failed to process request|request failed|generic.*error/i).test(normalized) && emailCandidate) {
    return `El correo ${emailCandidate} ya tiene una cuenta asociada.`;
  }

  if (/invalid.*login|invalid.*credentials|auth.*failed|failed to authenticate|incorrect.*password|incorrect.*credentials|invalid.*email|email.*password/.test(normalized)) {
    return 'No se pudo iniciar sesión. Revisa el correo y la contraseña (mínimo 8 caracteres; distingue mayúsculas y minúsculas). Si la cuenta es nueva, verifica tu correo o solicita un código.';
  }

  if (/email.*valid|invalid.*email|email.*format|must be a valid email/.test(normalized)) {
    return 'Por favor, introduce un correo electrónico válido.';
  }

  if (/password.*length|password.*at least|password.*short|min.*8/.test(normalized)) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }

  if (/confirm.*password|password.*match|passwords.*match/.test(normalized)) {
    return 'Las contraseñas no coinciden.';
  }

  if (error?.message) {
    return error.message;
  }

  return fallback;
};

const isUnverifiedAccountError = (error) => {
  const payload = error?.response?.data ?? error?.data ?? {};
  const message = [error?.message, payload?.message, ...Object.values(payload || {})]
    .filter((value) => typeof value === 'string')
    .join(' ')
    .toLowerCase();

  return /not verified|unverified|verification required|must be verified/.test(message)
    || /request does not satisfy the collection requirements to authenticate|request doesn't satisfy the collection requirements to authenticate/.test(message);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (pb.authStore.isValid && pb.authStore.model?.verified === false) {
      pb.authStore.clear();
    } else if (pb.authStore.isValid) {
      setCurrentUser(pb.authStore.model);
    }
    setInitialLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      if (!email || !password) {
        throw new Error('Faltan datos para iniciar sesión.');
      }

      const authData = await pb.collection('users').authWithPassword(email, password);
      if (authData.record?.verified === false) {
        pb.authStore.clear();
        const error = new Error('Esta cuenta todavía no ha verificado su correo.');
        error.code = 'EMAIL_NOT_VERIFIED';
        throw error;
      }
      setCurrentUser(authData.record);
      return { success: true, user: authData.record };
    } catch (error) {
      console.error('Login error:', error);
      if (error?.code === 'EMAIL_NOT_VERIFIED' || isUnverifiedAccountError(error)) {
        pb.authStore.clear();
        let otp;
        try {
          otp = await pb.collection('users').requestOTP(email.trim(), { $autoCancel: false });
        } catch (verificationError) {
          const errorWithStatus = new Error(
            `Esta cuenta todavía no ha verificado su correo, pero no se pudo enviar el código. ${extractErrorMessage(
              verificationError,
              'Inténtalo de nuevo más tarde.',
            )}`,
          );
          errorWithStatus.requiresVerification = true;
          throw errorWithStatus;
        }
        const verificationError = new Error(
          `Esta cuenta todavía no ha verificado su correo. La solicitud del código fue aceptada para ${email.trim()}.`,
        );
        verificationError.requiresVerification = true;
        verificationError.otpId = otp.otpId;
        throw verificationError;
      }
      throw new Error(extractErrorMessage(
        error,
        'Correo o contraseña incorrectos. Si tu cuenta es nueva, verifica tu correo antes de iniciar sesión.',
      ));
    }
  };

  const signup = async (email, password, passwordConfirm, name) => {
    try {
      if (!email || !password || !passwordConfirm) {
        throw new Error('Faltan datos para crear la cuenta.');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Por favor, introduce un correo electrónico válido.');
      }

      if (password.length < 8) {
        throw new Error('La contraseña debe tener al menos 8 caracteres.');
      }

      if (password !== passwordConfirm) {
        throw new Error('Las contraseñas no coinciden.');
      }

      const safeName = (name || '').trim() || email.split('@')[0];
      const usersCollection = pb.collection('users');

      try {
        const duplicateCheck = typeof usersCollection.getFullList === 'function'
          ? await usersCollection.getFullList({
              filter: `email = "${email.replace(/"/g, '\\"')}"`,
              fields: 'id,email',
            })
          : await usersCollection.getList(1, 1, {
              filter: `email = "${email.replace(/"/g, '\\"')}"`,
              fields: 'id,email',
            });

        const duplicateItems = Array.isArray(duplicateCheck?.items)
          ? duplicateCheck.items
          : Array.isArray(duplicateCheck)
            ? duplicateCheck
            : [];

        if (duplicateItems.some((user) => user?.email?.toLowerCase() === email.toLowerCase())) {
          throw new Error(`El correo ${email} ya tiene una cuenta asociada.`);
        }
      } catch (error) {
        if (error?.message?.includes('ya tiene una cuenta asociada')) {
          throw error;
        }
      }

      const payload = {
        email,
        password,
        passwordConfirm,
        name: safeName,
        emailVisibility: true,
      };

      await usersCollection.create(payload);

      try {
        const otp = await usersCollection.requestOTP(email, { $autoCancel: false });
        return {
          success: true,
          requiresVerification: true,
          emailSent: true,
          email,
          otpId: otp.otpId,
        };
      } catch (verificationError) {
        console.error('Account created but verification code could not be sent:', verificationError);
        return {
          success: true,
          requiresVerification: true,
          emailSent: false,
          email,
          verificationErrorMessage: extractErrorMessage(verificationError, 'No se pudo solicitar el código de verificación.'),
        };
      }
    } catch (error) {
      console.error('Signup error:', error);
      throw new Error(extractErrorMessage(error, 'No se pudo crear la cuenta. Inténtalo de nuevo.', email));
    }
  };

  const resendVerification = async (email) => {
    if (!email) throw new Error('Escribe el correo con el que creaste tu cuenta.');
    try {
      return await pb.collection('users').requestOTP(email.trim(), { $autoCancel: false });
    } catch (error) {
      console.error('Email verification code request failed:', error);
      throw new Error(extractErrorMessage(
        error,
        'No se pudo solicitar el código de verificación. Revisa la dirección e inténtalo de nuevo.',
      ));
    }
  };

  const verifyEmailCode = async (otpId, code) => {
    if (!otpId) throw new Error('Solicita un nuevo código de verificación para continuar.');
    if (!/^\d{6}$/.test(code || '')) throw new Error('Introduce el código de seis dígitos que recibiste por correo.');

    try {
      const authData = await pb.collection('users').authWithOTP(otpId, code, { $autoCancel: false });
      if (authData.record?.verified === false) {
        pb.authStore.clear();
        throw new Error('El correo todavía no aparece verificado. Solicita un nuevo código.');
      }
      setCurrentUser(authData.record);
      return authData.record;
    } catch (error) {
      console.error('Email verification code validation failed:', error);
      throw new Error(extractErrorMessage(error, 'El código venció o no es válido. Solicita uno nuevo e inténtalo otra vez.'));
    }
  };

  const confirmEmailVerification = async (token) => {
    if (!token) throw new Error('El enlace de verificación no contiene un token válido.');
    try {
      await pb.collection('users').confirmVerification(token, { $autoCancel: false });
      return true;
    } catch (error) {
      console.error('Email verification confirmation failed:', error);
      throw new Error('El enlace venció o no es válido. Solicita un nuevo correo de verificación.');
    }
  };

  const loginWithGoogle = async () => {
    try {
      const authData = await pb.collection('users').authWithOAuth2({
        provider: 'google',
        createData: { emailVisibility: false },
      });
      setCurrentUser(authData.record);
      return authData.record;
    } catch (error) {
      console.error('Google authentication failed:', error);
      throw new Error('No se pudo iniciar sesión con Google. Inténtalo de nuevo.');
    }
  };

  const logout = () => {
    pb.authStore.clear();
    setCurrentUser(null);
  };

  const value = {
    currentUser,
    login,
    signup,
    resendVerification,
    verifyEmailCode,
    confirmEmailVerification,
    loginWithGoogle,
    logout,
    isAuthenticated: !!currentUser,
    initialLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
