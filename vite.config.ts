import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const hmrDisabled = env.DISABLE_HMR === 'true';
  const hmrPort = Number(env.HMR_PORT || 24678);
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Disable HMR when requested so the dev client does not try to open a websocket.
      hmr: hmrDisabled ? false : { port: hmrPort, clientPort: hmrPort, host: 'localhost' },
    },
  };
});
