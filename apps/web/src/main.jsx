import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
	<App />
);

// App instalable: el service worker solo se registra en producción (en desarrollo estorbaría al recargar).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/sw.js').catch((error) => console.error('No se pudo registrar el service worker:', error));
	});
}
