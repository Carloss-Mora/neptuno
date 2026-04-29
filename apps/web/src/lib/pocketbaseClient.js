import Pocketbase from 'pocketbase';

const POCKETBASE_API_URL = "https://beige-chinchilla-339994.hostingersite.com/hcgi/platform";

const pocketbaseClient = new Pocketbase(POCKETBASE_API_URL);

export default pocketbaseClient;

export { pocketbaseClient };
