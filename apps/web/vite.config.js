import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const envDir = path.resolve(currentDir, '../..');

export default defineConfig(({ mode }) => {
	if (mode === 'production') {
		const productionEnv = loadEnv(mode, envDir, 'VITE_');
		const apiUrl = process.env.VITE_POCKETBASE_URL || productionEnv.VITE_POCKETBASE_URL;
		let apiHost = '';

		try {
			apiHost = new URL(apiUrl).hostname;
		} catch {
			throw new Error('Set VITE_POCKETBASE_URL to the public HTTPS PocketBase URL before building for production.');
		}

		if (
			!apiUrl.startsWith('https://')
			|| !apiHost
			|| apiHost === 'localhost'
			|| apiHost.endsWith('.localhost')
			|| apiHost === '::1'
			|| /^127\./.test(apiHost)
			|| apiHost.endsWith('.example')
		) {
			throw new Error('Production builds require VITE_POCKETBASE_URL to use a public HTTPS host.');
		}
	}

	return {
		envDir,
		plugins: [react()],
		server: {
			port: 3000,
		},
		resolve: {
			extensions: ['.jsx', '.js', '.tsx', '.ts', '.json'],
			alias: {
				'@': path.resolve(currentDir, './src'),
			},
		},
	};
});
