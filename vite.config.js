import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'fonts/*', 'graphics/*'],
      manifest: {
        name: 'Inkstone',
        short_name: 'Inkstone',
        description: 'Learn to write Chinese characters offline',
        theme_color: '#444444',
        background_color: '#444444',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'graphics/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'graphics/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,json,txt,list,ttf,jpg,png,svg}',
          'assets/characters_v2/*'
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/vendor\//],
        maximumFileSizeToCacheInBytes: 25 * 1024 * 1024 // Allow up to 25MB to accommodate the 17MB Chinese font
      }
    })
  ],
  define: {
    'import.meta.env.BUILD_DATE': JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: {
      '/src': resolve(__dirname, './src'),
      '/client': resolve(__dirname, './src/client'),
      '/lib': resolve(__dirname, './src/lib'),
      react: 'preact/compat',
      'react-dom/test-utils': 'preact/test-utils',
      'react-dom': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime'
    }
  }
})
