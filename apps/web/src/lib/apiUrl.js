const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

const isLoopback = (hostname) => LOOPBACK_HOSTS.includes(hostname) || hostname.endsWith('.localhost');

// Decide a qué URL de PocketBase habla la web.
// En desarrollo, si el .env apunta a localhost/127.0.0.1 pero la página se abre desde otro equipo
// (por ejemplo el celular en http://192.168.1.12:3000), "127.0.0.1" sería el propio celular y todo fallaría
// con "Something went wrong while processing your request". En ese caso se usa el mismo host de la página.
export const resolveApiUrl = ({ configured, hostname, protocol = 'http:', isDev }) => {
  const pageHostname = hostname || '';
  const sameHostUrl = pageHostname ? `${protocol}//${pageHostname}:8090` : 'http://127.0.0.1:8090';

  if (!configured) return isDev ? sameHostUrl : '';
  if (!isDev || !pageHostname || isLoopback(pageHostname)) return configured;

  try {
    const configuredHost = new URL(configured).hostname;
    return isLoopback(configuredHost) ? sameHostUrl : configured;
  } catch {
    return configured;
  }
};
