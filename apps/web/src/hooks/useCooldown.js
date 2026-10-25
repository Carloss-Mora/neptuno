import { useCallback, useEffect, useState } from 'react';

// Cuenta atrás en segundos (p. ej. para limitar la petición de códigos de verificación).
export const useCooldown = () => {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return undefined;
    const timer = setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  const start = useCallback((seconds = 60) => setRemaining(seconds), []);
  return { remaining, start };
};
