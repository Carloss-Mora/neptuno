import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';

// Recorre las pantallas principales con una sesión real y falla ante cualquier respuesta
// HTTP >= 400 o console.error. Requiere PocketBase y la web en marcha:
//   PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD  (crea un usuario desechable)
//   UI_URL (por defecto http://127.0.0.1:3000)
const pbUrl = (process.env.PB_URL || '').replace(/\/+$/, '');
const adminEmail = process.env.PB_ADMIN_EMAIL || '';
const adminPassword = process.env.PB_ADMIN_PASSWORD || '';
const routes = ['/dashboard', '/control', '/statistics', '/historial', '/crops', '/simulator', '/devices', '/summary', '/settings', '/sensors', '/reports'];

const api = async (path: string, init: { method?: string; token?: string; body?: unknown } = {}) => {
  const response = await fetch(`${pbUrl}${path}`, {
    method: init.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(init.token ? { Authorization: init.token } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} -> ${response.status} ${JSON.stringify(data)}`);
  return data;
};

test.describe('pantallas principales sin errores', () => {
  test.skip(!pbUrl || !adminEmail || !adminPassword, 'Define PB_URL, PB_ADMIN_EMAIL y PB_ADMIN_PASSWORD.');
  let adminToken = '';
  let userId = '';
  let authData: { token: string; record: unknown };

  test.beforeAll(async () => {
    adminToken = (await api('/api/collections/_superusers/auth-with-password', {
      method: 'POST', body: { identity: adminEmail, password: adminPassword },
    })).token;
    const password = `Np-${randomBytes(12).toString('hex')}!`;
    const email = `ui-smoke-${Date.now()}@example.test`;
    const user = await api('/api/collections/users/records', {
      method: 'POST', token: adminToken,
      body: { email, password, passwordConfirm: password, name: 'UI smoke', verified: true, emailVisibility: true },
    });
    userId = user.id;
    authData = await api('/api/collections/users/auth-with-password', { method: 'POST', body: { identity: email, password } });
    await api('/api/collections/crops/records', {
      method: 'POST', token: authData.token, body: { userId, name: 'Fresas UI smoke', control_mode: 'MANUAL' },
    });
  });

  test.afterAll(async () => {
    if (userId) await api(`/api/collections/users/records/${userId}`, { method: 'DELETE', token: adminToken }).catch(() => {});
  });

  for (const route of routes) {
    test(`${route} carga sin errores HTTP ni de consola`, async ({ page, context }) => {
      await context.addInitScript(([token, record]) => {
        localStorage.setItem('pocketbase_auth', JSON.stringify({ token, record }));
      }, [authData.token, authData.record]);
      const problems: string[] = [];
      page.on('console', (message) => {
        // Los 4xx/5xx ya se registran como respuestas; este mensaje genérico del navegador solo duplica.
        if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) problems.push(`console: ${message.text()}`);
      });
      page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
      page.on('response', (response) => {
        if (response.status() >= 400 && response.url().startsWith(pbUrl)) {
          problems.push(`HTTP ${response.status()} ${response.url().replace(pbUrl, '')}`);
        }
      });
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(new RegExp(`${route}$`));
      await expect(page.locator('body')).not.toContainText(/Sin cultivos|Cannot read|undefined is not/);
      expect(problems, problems.join('\n')).toEqual([]);
    });
  }
});
