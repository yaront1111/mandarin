import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Support for CRA's src/ absolute imports
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Handle CRA's public folder
  publicDir: 'public',
  // Configure server
  server: {
    port: 3000,
    open: true,
  },
});
