import { defineConfig } from 'vite';
export default defineConfig(({mode})=>({
  base: './',
  build: {
    outDir:mode==='web'?'web-dist':'dist',
    target: 'es2022',
    chunkSizeWarningLimit: 850,
    rolldownOptions: {
      output: {
        // Keep the renderer dependency cache separate from gameplay/save updates.
        codeSplitting: { groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }] },
      },
    },
  },
  server: { strictPort: true },
}));
