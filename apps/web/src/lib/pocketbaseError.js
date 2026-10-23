export const getPocketBaseErrorDetails = (error) => {
  const status = Number(error?.status || error?.response?.status || 0);
  const message = error?.response?.message || error?.message || 'Error desconocido';
  const cause = error?.originalError?.message || error?.cause?.message;
  const validationDetails = Object.entries(error?.response?.data || {})
    .map(([field, detail]) => {
      const fieldMessage = typeof detail === 'string' ? detail : detail?.message;
      return fieldMessage ? `${field}: ${fieldMessage}` : '';
    })
    .filter(Boolean)
    .join('; ');

  return [
    status ? `HTTP ${status}` : 'Error de red o cliente',
    message,
    cause && cause !== message ? cause : '',
    validationDetails,
  ].filter(Boolean).join(' — ');
};
