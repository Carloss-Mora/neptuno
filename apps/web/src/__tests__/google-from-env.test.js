import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const source = fs.readFileSync(
  path.resolve(__dirname, '../../../pocketbase/pb_hooks/google-from-env.pb.js'),
  'utf8',
);

function run(env) {
  const users = { oauth2: { enabled: false, providers: [] } };
  const save = vi.fn();
  let handler;
  vm.runInNewContext(source, {
    onBootstrap: (fn) => { handler = fn; },
    $os: { getenv: (k) => env[k] || '' },
    $app: { findCollectionByNameOrId: () => users, save },
    console: { log() {}, error() {} },
  });
  handler({ next() {} });
  return { users, save };
}

describe('google-from-env hook', () => {
  it('activa Google cuando hay credenciales', () => {
    const { users, save } = run({ GOOGLE_CLIENT_ID: ' id ', GOOGLE_CLIENT_SECRET: 'sec' });
    expect(users.oauth2.enabled).toBe(true);
    expect(users.oauth2.providers).toEqual([{ name: 'google', clientId: 'id', clientSecret: 'sec' }]);
    expect(save).toHaveBeenCalledOnce();
  });

  it('no toca nada si falta alguna credencial', () => {
    const { users, save } = run({ GOOGLE_CLIENT_ID: 'id' });
    expect(users.oauth2.enabled).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });
});
