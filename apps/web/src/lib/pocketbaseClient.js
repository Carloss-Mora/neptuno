import Pocketbase from 'pocketbase';

const POCKETBASE_API_URL = import.meta.env.VITE_POCKETBASE_URL || 
  (import.meta.env.DEV ? 'http://127.0.0.1:8090' : 'https://beige-chinchilla-339994.hostingersite.com/hcgi/platform');

const pocketbaseClient = new Pocketbase(POCKETBASE_API_URL);

export default pocketbaseClient;

export { pocketbaseClient };
