import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import viteCompression from 'vite-plugin-compression';
import { visualizer } from 'rollup-plugin-visualizer';
import legacy from '@vitejs/plugin-legacy';
import terser from '@rollup/plugin-terser';
import purgecss from 'vite-plugin-purgecss';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Whether to polyfill `node:` protocol imports.
      protocolImports: true,
      // Include specific polyfills needed by simple-peer
      include: ['events', 'stream', 'util']
    }),
    // Generate gzip and brotli files
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
    }),
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
    }),
    // Legacy browser support
    legacy({
      targets: ['defaults', 'not IE 11']
    }),
    // Bundle analysis in stats.html (only active in production build)
    process.env.ANALYZE && visualizer({
      filename: 'stats.html',
      open: true,
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@context": path.resolve(__dirname, "./src/context"),
      "@services": path.resolve(__dirname, "./src/services"),
      "@pages": path.resolve(__dirname, "./src/pages"),
      "@styles": path.resolve(__dirname, "./src/styles"),
      "@utils": path.resolve(__dirname, "./src/utils"),
    },
    extensions: [".mjs", ".js", ".jsx", ".ts", ".tsx", ".json"],
  },
  define: {
    'global': 'globalThis',
    'process.env': {},
  },
  server: {
    port: 3000,
    open: true,
    cors: true,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
      },
      "/uploads": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: "http://localhost:5000",
        ws: true,
        changeOrigin: true,
      },
    },
    hmr: {
      host: "localhost",
      protocol: "ws",
      port: 3000,
    },
  },
  css: {
    // Simple CSS optimization
    devSourcemap: true,
  },
  build: {
    outDir: "dist",
    sourcemap: process.env.NODE_ENV !== 'production', // Only in development
    chunkSizeWarningLimit: 1600,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: process.env.NODE_ENV === 'production',
      },
    },
    rollupOptions: {
      plugins: [
        terser({
          format: {
            comments: false, // Remove comments
          },
        }),
      ],
      output: {
        // Chunk splitting strategy
        manualChunks: (id) => {
          // Core vendor dependencies
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('i18next') || id.includes('react-i18next')) {
              return 'vendor-i18n';
            }
            if (id.includes('react-icons')) {
              return 'vendor-icons';
            }
            if (id.includes('toastify') || id.includes('swiper') || id.includes('ui-components')) {
              return 'vendor-ui';
            }
            // Group other dependencies
            return 'vendor-other';
          }
          
          // Feature-based chunking for application code
          if (id.includes('/src/components/VideoCall')) {
            return 'feature-video-call';
          }
          if (id.includes('/src/pages/Settings')) {
            return 'feature-settings';
          }
          if (id.includes('/src/components/Admin/')) {
            return 'feature-admin';
          }
        },
        // Generate smaller chunks with descriptive names
        chunkFileNames: (chunkInfo) => {
          const name = chunkInfo.name;
          if (name.includes('vendor')) {
            return 'assets/vendor-[name]-[hash].js';
          }
          return 'assets/[name]-[hash].js';
        },
        // Asset file naming
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/\.(png|jpe?g|gif|svg|webp)$/.test(assetInfo.name)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/\.(woff2?|ttf|eot)$/.test(assetInfo.name)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          if (/\.css$/.test(assetInfo.name)) {
            return `assets/css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
      },
    },
  },
});
