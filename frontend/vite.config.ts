
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Force a single module instance for React and the router across all chunks.
    // Without this, Rollup can emit duplicate copies of react-router into lazy
    // chunks (e.g. TasksPage-*.js), giving them a different DataRouterContext
    // object than the one RouterProvider provided — making useBlocker throw.
    dedupe: ['react', 'react-dom', 'react-router-dom', 'react-router', '@remix-run/router'],
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    port: 3600,
    proxy: {
      '/api': {
        target: 'http://localhost:8100',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
      '/ws': {
        target: 'ws://localhost:8101',
        ws: true,
        changeOrigin: true,
      },
    },
    sourcemapIgnoreList(sourcePath) {
      return sourcePath.includes('node_modules');
    },
  },
  build: {
    sourcemap: false,
    minify: 'esbuild',
    esbuild: {
      drop: ['console', 'debugger'],
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Colocate react, react-dom, and the router in one shared vendor chunk
          // so every lazy page chunk references the same module singleton and
          // therefore the same DataRouterContext object.
          vendor: ['react', 'react-dom', 'react-router-dom', 'react-router', '@remix-run/router'],
        },
      },
    },
  },
});

