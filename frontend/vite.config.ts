import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        id: '/',
        scope: '/',
        lang: 'pt-BR',
        prefer_related_applications: false,
        name: 'Forja - Controle de Produção',
        short_name: 'Forja',
        description: 'Sistema de Controle de Produção Pecsil',
        theme_color: '#dc2626',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/icons/forja-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/forja-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/forja-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        skipWaiting: false,
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api(?:\/|$)/, /^\/socket\.io(?:\/|$)/, /^\/storage(?:\/|$)/, /^\/health(?:\/|$)/],
        clientsClaim: true,
      },
    }),
  ],
  server: {
    port: 5173,
    host: 'localhost',
  },
});
