import Pocketbase from 'pocketbase';

const developmentApiUrl = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:8090`
  : 'http://127.0.0.1:8090';
const configuredApiUrl = import.meta.env.VITE_POCKETBASE_URL;
const POCKETBASE_API_URL = configuredApiUrl || (import.meta.env.DEV ? developmentApiUrl : '');

if (!POCKETBASE_API_URL) {
  throw new Error('VITE_POCKETBASE_URL must be set to the deployed PocketBase API URL.');
}

const pocketbaseClient = new Pocketbase(POCKETBASE_API_URL);

export default pocketbaseClient;

export { pocketbaseClient };
