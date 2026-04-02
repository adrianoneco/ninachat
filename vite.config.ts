import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      host: true,
      port: 40000,
      hmr: {
        // Use the current page hostname by default. You can force a host via HMR_HOST env var
        protocol: 'ws',
        host: env.HMR_HOST || undefined,
        port: 40000,
      },
      proxy: {
        // Proxy frontend /api requests to backend
        '/api': {
          target: `http://192.168.3.39:${env.PORT || '40001'}`,
          changeOrigin: true,
          secure: false,
        },
        // Proxy uploads to backend
        '/uploads': {
          target: `http://192.168.3.39:${env.PORT || '40001'}`,
          changeOrigin: true,
        },
        // Proxy Socket.IO to backend
        '/socket.io': {
          target: `http://192.168.3.39:${env.PORT || '40001'}`,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    plugins: [
      react(),
      mode === 'development' && componentTagger(),
    ].filter(Boolean),
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    }
  };
});
