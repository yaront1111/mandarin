import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import viteCompression from 'vite-plugin-compression';
import { visualizer } from 'rollup-plugin-visualizer';
import legacy from '@vitejs/plugin-legacy';
import terser from '@rollup/plugin-terser';
import purgecss from 'vite-plugin-purgecss';
import { createHtmlPlugin } from 'vite-plugin-html';
import preload from 'vite-plugin-preload';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // Filter out disabled plugins
    ...[
    react({
      // Minimize React runtime
      jsxRuntime: 'automatic',
      babel: {
        plugins: [
          ['transform-react-remove-prop-types', { removeImport: true }]
        ],
      }
    }),
    // PurgeCSS is disabled because of issues with slash characters in utility classes
    null,
    // Generate critical CSS inline in the HTML
    createHtmlPlugin({
      minify: true,
      inject: {
        data: {
          injectCriticalCss: true
        }
      }
    }),
    // Add preload directives for important resources
    preload({
      // Preload critical fonts, CSS, and JS
      includeSelector: ['link[as=font]', 'link[as=style]', 'script[type=module]'],
      // Don't preload everything (can hurt performance)
      includeAssets: [/\.woff2$/, /index.*\.css$/, /index.*\.js$/],
    }),
    nodePolyfills({
      // Whether to polyfill `node:` protocol imports.
      protocolImports: true,
      // Only include necessary polyfills to reduce bundle size
      include: ['events', 'stream', 'util']
    }),
    // Generate gzip and brotli files
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      filter: /\.(js|css|html|svg)$/i,
      threshold: 1024  // Only compress files larger than 1KB
    }),
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      filter: /\.(js|css|html|svg)$/i,
      threshold: 1024  // Only compress files larger than 1KB
    }),
    // Legacy browser support
    legacy({
      targets: ['defaults', 'not IE 11'],
      // Only generate legacy builds for modern browsers to reduce bundle size
      modernPolyfills: true
    }),
    // Bundle analysis in stats.html (only active in production build)
    process.env.ANALYZE && visualizer({
      filename: 'stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    })
  ].filter(Boolean)],
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
    cssMinify: true, // Ensure CSS is minified
    cssCodeSplit: true, // Split CSS into smaller chunks
    modulePreload: { 
      polyfill: true, // Add module preload polyfill for browsers
      resolveDependencies: (filename, deps) => {
        // Only preload critical dependencies
        return deps.filter(dep => 
          !dep.includes('admin') && 
          !dep.includes('video-call') && 
          !dep.includes('stories')
        );
      }
    },
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: process.env.NODE_ENV === 'production',
        passes: 2, // Additional optimization pass
        pure_getters: true,
        unsafe: true,
        unsafe_comps: true
      },
      mangle: {
        safari10: true, // Safari 10 compatibility
      },
      format: {
        comments: false // Remove all comments
      }
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
        // Optimize chunk size to reduce waterfall loading
        experimentalMinChunkSize: 10000, // 10KB
        inlineDynamicImports: false,
        // Chunk splitting strategy - improved for Lighthouse
        manualChunks: (id) => {
          // Common chunks used on most pages 
          if (id.includes('/src/components/common/') || 
              id.includes('/src/utils/') || 
              id.includes('/src/context/') ||
              id.includes('/src/hooks/')) {
            return 'core-app';
          }
          
          // Core vendor dependencies
          if (id.includes('node_modules')) {
            // React core - critical for all pages
            if (id.includes('react/') || id.includes('react-dom/') || 
                id.includes('scheduler') || id.includes('prop-types')) {
              return 'vendor-react-core';
            }
            
            // React ecosystem - routers, etc.
            if (id.includes('react-router') || id.includes('react-helmet') || 
                id.includes('react-transition') || id.includes('react-redux')) {
              return 'vendor-react-ecosystem';
            }
            
            // i18n and localization 
            if (id.includes('i18next') || id.includes('react-i18next') || 
                id.includes('intl') || id.includes('locale')) {
              return 'vendor-i18n';
            }
            
            // Icons are commonly non-critical
            if (id.includes('react-icons') || id.includes('icons')) {
              return 'vendor-icons';
            }
            
            // UI components - load after core react
            if (id.includes('toastify') || id.includes('swiper') || 
                id.includes('ui-components') || id.includes('framer-motion')) {
              return 'vendor-ui';
            }
            
            // Admin-only dependencies - low priority loading
            if (id.includes('admin') || id.includes('chart') || 
                id.includes('analytics') || id.includes('dashboard')) {
              return 'vendor-admin';
            }
            
            // Group remaining dependencies
            return 'vendor-other';
          }
          
          // Feature-based chunking for application code
          // Core pages - high priority
          if (id.includes('/src/pages/Home') || 
              id.includes('/src/pages/Login') || 
              id.includes('/src/pages/Register')) {
            return 'pages-core';
          }
          
          // Admin features - load on demand
          if (id.includes('/src/components/Admin/') || 
              id.includes('/src/pages/Admin')) {
            return 'feature-admin';
          }
          
          // Video call - large feature that's only used when needed
          if (id.includes('/src/components/VideoCall') || 
              id.includes('webrtc') || 
              id.includes('media-stream')) {
            return 'feature-video-call';
          }
          
          // Settings - only used on settings page
          if (id.includes('/src/pages/Settings')) {
            return 'feature-settings';
          }
          
          // Stories feature - can be lazy loaded
          if (id.includes('/src/components/Stories/') ||
              id.includes('Story')) {
            return 'feature-stories';
          }
        },
        // Generate smaller chunks with descriptive names
        chunkFileNames: (chunkInfo) => {
          const name = chunkInfo.name;
          if (name.includes('vendor')) {
            return 'assets/vendor-[name]-[hash].js';
          }
          if (name.includes('feature') || name.includes('pages')) {
            return 'assets/[name]-[hash].js';  
          }
          return 'assets/modules/[name]-[hash].js';
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
            // Split CSS into core and feature specific
            if (assetInfo.name.includes('base') || assetInfo.name.includes('index')) {
              return `assets/css/critical-[hash][extname]`;
            }
            return `assets/css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
      },
    },
  },
});
