import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Define path aliases to match any existing in your project
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@context": path.resolve(__dirname, "./src/context"),
      "@services": path.resolve(__dirname, "./src/services"),
      "@pages": path.resolve(__dirname, "./src/pages"),
      "@styles": path.resolve(__dirname, "./src/styles"),
      "@utils": path.resolve(__dirname, "./src/utils"),
    },
    extensions: [".mjs", ".js", ".jsx", ".ts", ".tsx", ".json"], // Add this line to ensure all extensions are properly resolved
  },
  server: {
    port: 3000, // Set your preferred development port
    open: true, // Auto-open browser on start
    proxy: {
      // Configure API proxy if needed
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
      // Add WebSocket proxy for Socket.IO
      "/socket.io": {
        target: "http://localhost:5000",
        ws: true,
        changeOrigin: true,
      },
    },
    // Configure HMR to use the correct host
    hmr: {
      host: "localhost",
      protocol: "ws",
      port: 3000,
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    // Customize chunk size to optimize loading
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          ui: ["react-icons", "react-toastify"],
        },
      },
    },
  },
})
