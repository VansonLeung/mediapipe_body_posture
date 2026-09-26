import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { readFileSync } from 'node:fs';

export default defineConfig(({ mode }) => {
  const secure = mode === 'https';
  const cert = process.env.DEV_HTTPS_CERT;
  const key = process.env.DEV_HTTPS_KEY;
  if (secure && !!cert !== !!key)
    throw new Error('Set both DEV_HTTPS_CERT and DEV_HTTPS_KEY, or neither.');
  return {
    cacheDir: secure ? 'node_modules/.vite-https' : 'node_modules/.vite',
    plugins: [
      react(),
      secure && !cert && basicSsl({ name: 'Forma local development' }),
    ],
    // Separate ports let desktop HTTP and tablet HTTPS run together.
    server: {
      port: secure ? 5176 : 5175,
      strictPort: true,
      https:
        secure && cert && key
          ? { cert: readFileSync(cert), key: readFileSync(key) }
          : undefined,
    },
  };
});
