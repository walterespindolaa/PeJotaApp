import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { sentryVitePlugin } from "@sentry/vite-plugin";

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT;
const release =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
  process.env.SENTRY_RELEASE ||
  `atlas@${process.env.npm_package_version || "dev"}`;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    "import.meta.env.VITE_SENTRY_RELEASE": JSON.stringify(release),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  build: {
    sourcemap: false,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2,
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-popover", "@radix-ui/react-dropdown-menu", "@radix-ui/react-tabs", "@radix-ui/react-select", "@radix-ui/react-tooltip"],
          "vendor-charts": ["recharts"],
          "vendor-pdf": ["jspdf", "jspdf-autotable"],
        },
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "prompt",
      includeAssets: [
        "favicon.ico",
        "apple-touch-icon.png",
        "logo.png",
        "icons/*.png",
      ],
      manifest: false,
      workbox: {
        importScripts: ["/push-sw.js"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,woff2,woff,ttf}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
        skipWaiting: false,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
    sentryAuthToken && sentryOrg && sentryProject && mode === "production" && sentryVitePlugin({
      authToken: sentryAuthToken,
      org: sentryOrg,
      project: sentryProject,
      release: { name: release },
      sourcemaps: {
        assets: "./dist/**",
        filesToDeleteAfterUpload: "./dist/**/*.map",
      },
    }),
  ].filter(Boolean) as any,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
