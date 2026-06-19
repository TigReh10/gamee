import { defineConfig } from 'vite'

// Static site (index.html + game.js). Three.js is loaded via CDN in index.html.
export default defineConfig({
  server: {
    host: true, // expose on the network so Codespaces port-forwarding works
    port: 5173,
    open: false,
  },
  preview: {
    host: true,
    port: 4173,
  },
})
