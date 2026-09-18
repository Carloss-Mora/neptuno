
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
    return 'Correo o contraseña incorrectos.';
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

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (pb.authStore.isValid) {
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
      setCurrentUser(authData.record);
      return { success: true, user: authData.record };
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(extractErrorMessage(error, 'Correo o contraseña incorrectos.'));
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

      const authData = await pb.collection('users').authWithPassword(email, password);
      setCurrentUser(authData.record);

      return { success: true, user: authData.record };
    } catch (error) {
      console.error('Signup error:', error);
      throw new Error(extractErrorMessage(error, 'No se pudo crear la cuenta. Inténtalo de nuevo.', email));
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
