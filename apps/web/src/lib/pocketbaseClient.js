import Pocketbase from 'pocketbase';
import { resolveApiUrl } from '@/lib/apiUrl';

const POCKETBASE_API_URL = resolveApiUrl({
  configured: import.meta.env.VITE_POCKETBASE_URL,
  hostname: typeof window !== 'undefined' ? window.location.hostname : '',
  protocol: typeof window !== 'undefined' ? window.location.protocol : 'http:',
  isDev: Boolean(import.meta.env.DEV),
});

if (!POCKETBASE_API_URL) {
  throw new Error('VITE_POCKETBASE_URL must be set to the deployed PocketBase API URL.');
}

const pocketbaseClient = new Pocketbase(POCKETBASE_API_URL);

export default pocketbaseClient;

export { pocketbaseClient };
