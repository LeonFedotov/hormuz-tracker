import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/data': {
        target: 'http://localhost:3847',
        changeOrigin: true,
      },
    },
  },
  publicDir: 'public',
});
