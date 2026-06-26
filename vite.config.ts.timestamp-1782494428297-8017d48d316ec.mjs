// vite.config.ts
import { defineConfig } from "file:///sessions/magical-keen-babbage/mnt/Pejota/app/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/magical-keen-babbage/mnt/Pejota/app/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///sessions/magical-keen-babbage/mnt/Pejota/app/node_modules/lovable-tagger/dist/index.js";
import { VitePWA } from "file:///sessions/magical-keen-babbage/mnt/Pejota/app/node_modules/vite-plugin-pwa/dist/index.js";
import { sentryVitePlugin } from "file:///sessions/magical-keen-babbage/mnt/Pejota/app/node_modules/@sentry/vite-plugin/dist/esm/index.mjs";
var __vite_injected_original_dirname = "/sessions/magical-keen-babbage/mnt/Pejota/app";
var sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
var sentryOrg = process.env.SENTRY_ORG;
var sentryProject = process.env.SENTRY_PROJECT;
var release = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || process.env.SENTRY_RELEASE || `atlas@${process.env.npm_package_version || "dev"}`;
var vite_config_default = defineConfig(({ mode }) => ({
  define: {
    "import.meta.env.VITE_SENTRY_RELEASE": JSON.stringify(release)
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false
    }
  },
  build: {
    sourcemap: false,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2
      },
      format: {
        comments: false
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-popover", "@radix-ui/react-dropdown-menu", "@radix-ui/react-tabs", "@radix-ui/react-select", "@radix-ui/react-tooltip"],
          "vendor-charts": ["recharts"],
          "vendor-pdf": ["jspdf", "jspdf-autotable"]
        }
      }
    }
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
        "icons/*.png"
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
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    }),
    sentryAuthToken && sentryOrg && sentryProject && mode === "production" && sentryVitePlugin({
      authToken: sentryAuthToken,
      org: sentryOrg,
      project: sentryProject,
      release: { name: release },
      sourcemaps: {
        assets: "./dist/**",
        filesToDeleteAfterUpload: "./dist/**/*.map"
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvbWFnaWNhbC1rZWVuLWJhYmJhZ2UvbW50L1Blam90YS9hcHBcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9tYWdpY2FsLWtlZW4tYmFiYmFnZS9tbnQvUGVqb3RhL2FwcC92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvbWFnaWNhbC1rZWVuLWJhYmJhZ2UvbW50L1Blam90YS9hcHAvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5pbXBvcnQgeyBjb21wb25lbnRUYWdnZXIgfSBmcm9tIFwibG92YWJsZS10YWdnZXJcIjtcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tIFwidml0ZS1wbHVnaW4tcHdhXCI7XG5pbXBvcnQgeyBzZW50cnlWaXRlUGx1Z2luIH0gZnJvbSBcIkBzZW50cnkvdml0ZS1wbHVnaW5cIjtcblxuY29uc3Qgc2VudHJ5QXV0aFRva2VuID0gcHJvY2Vzcy5lbnYuU0VOVFJZX0FVVEhfVE9LRU47XG5jb25zdCBzZW50cnlPcmcgPSBwcm9jZXNzLmVudi5TRU5UUllfT1JHO1xuY29uc3Qgc2VudHJ5UHJvamVjdCA9IHByb2Nlc3MuZW52LlNFTlRSWV9QUk9KRUNUO1xuY29uc3QgcmVsZWFzZSA9XG4gIHByb2Nlc3MuZW52LlZFUkNFTF9HSVRfQ09NTUlUX1NIQT8uc2xpY2UoMCwgNykgfHxcbiAgcHJvY2Vzcy5lbnYuU0VOVFJZX1JFTEVBU0UgfHxcbiAgYGF0bGFzQCR7cHJvY2Vzcy5lbnYubnBtX3BhY2thZ2VfdmVyc2lvbiB8fCBcImRldlwifWA7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiAoe1xuICBkZWZpbmU6IHtcbiAgICBcImltcG9ydC5tZXRhLmVudi5WSVRFX1NFTlRSWV9SRUxFQVNFXCI6IEpTT04uc3RyaW5naWZ5KHJlbGVhc2UpLFxuICB9LFxuICBzZXJ2ZXI6IHtcbiAgICBob3N0OiBcIjo6XCIsXG4gICAgcG9ydDogODA4MCxcbiAgICBobXI6IHtcbiAgICAgIG92ZXJsYXk6IGZhbHNlLFxuICAgIH0sXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgc291cmNlbWFwOiBmYWxzZSxcbiAgICBtaW5pZnk6IFwidGVyc2VyXCIsXG4gICAgdGVyc2VyT3B0aW9uczoge1xuICAgICAgY29tcHJlc3M6IHtcbiAgICAgICAgZHJvcF9jb25zb2xlOiB0cnVlLFxuICAgICAgICBkcm9wX2RlYnVnZ2VyOiB0cnVlLFxuICAgICAgICBwYXNzZXM6IDIsXG4gICAgICB9LFxuICAgICAgZm9ybWF0OiB7XG4gICAgICAgIGNvbW1lbnRzOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XG4gICAgICAgICAgXCJ2ZW5kb3ItcmVhY3RcIjogW1wicmVhY3RcIiwgXCJyZWFjdC1kb21cIiwgXCJyZWFjdC1yb3V0ZXItZG9tXCJdLFxuICAgICAgICAgIFwidmVuZG9yLXF1ZXJ5XCI6IFtcIkB0YW5zdGFjay9yZWFjdC1xdWVyeVwiXSxcbiAgICAgICAgICBcInZlbmRvci11aVwiOiBbXCJAcmFkaXgtdWkvcmVhY3QtZGlhbG9nXCIsIFwiQHJhZGl4LXVpL3JlYWN0LXBvcG92ZXJcIiwgXCJAcmFkaXgtdWkvcmVhY3QtZHJvcGRvd24tbWVudVwiLCBcIkByYWRpeC11aS9yZWFjdC10YWJzXCIsIFwiQHJhZGl4LXVpL3JlYWN0LXNlbGVjdFwiLCBcIkByYWRpeC11aS9yZWFjdC10b29sdGlwXCJdLFxuICAgICAgICAgIFwidmVuZG9yLWNoYXJ0c1wiOiBbXCJyZWNoYXJ0c1wiXSxcbiAgICAgICAgICBcInZlbmRvci1wZGZcIjogW1wianNwZGZcIiwgXCJqc3BkZi1hdXRvdGFibGVcIl0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIG1vZGUgPT09IFwiZGV2ZWxvcG1lbnRcIiAmJiBjb21wb25lbnRUYWdnZXIoKSxcbiAgICBWaXRlUFdBKHtcbiAgICAgIHJlZ2lzdGVyVHlwZTogXCJwcm9tcHRcIixcbiAgICAgIGluY2x1ZGVBc3NldHM6IFtcbiAgICAgICAgXCJmYXZpY29uLmljb1wiLFxuICAgICAgICBcImFwcGxlLXRvdWNoLWljb24ucG5nXCIsXG4gICAgICAgIFwibG9nby5wbmdcIixcbiAgICAgICAgXCJpY29ucy8qLnBuZ1wiLFxuICAgICAgXSxcbiAgICAgIG1hbmlmZXN0OiBmYWxzZSxcbiAgICAgIHdvcmtib3g6IHtcbiAgICAgICAgaW1wb3J0U2NyaXB0czogW1wiL3B1c2gtc3cuanNcIl0sXG4gICAgICAgIG1heGltdW1GaWxlU2l6ZVRvQ2FjaGVJbkJ5dGVzOiA1ICogMTAyNCAqIDEwMjQsXG4gICAgICAgIGdsb2JQYXR0ZXJuczogW1wiKiovKi57anMsY3NzLGh0bWwsd29mZjIsd29mZix0dGZ9XCJdLFxuICAgICAgICBuYXZpZ2F0ZUZhbGxiYWNrOiBcIi9pbmRleC5odG1sXCIsXG4gICAgICAgIG5hdmlnYXRlRmFsbGJhY2tEZW55bGlzdDogWy9eXFwvfm9hdXRoLywgL15cXC9hcGlcXC8vXSxcbiAgICAgICAgc2tpcFdhaXRpbmc6IGZhbHNlLFxuICAgICAgICBjbGllbnRzQ2xhaW06IHRydWUsXG4gICAgICAgIGNsZWFudXBPdXRkYXRlZENhY2hlczogdHJ1ZSxcbiAgICAgICAgcnVudGltZUNhY2hpbmc6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcL2ZvbnRzXFwuZ29vZ2xlYXBpc1xcLmNvbVxcLy4qL2ksXG4gICAgICAgICAgICBoYW5kbGVyOiBcIkNhY2hlRmlyc3RcIixcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiBcImdvb2dsZS1mb250cy1jYWNoZVwiLFxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7IG1heEVudHJpZXM6IDEwLCBtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiAzNjUgfSxcbiAgICAgICAgICAgICAgY2FjaGVhYmxlUmVzcG9uc2U6IHsgc3RhdHVzZXM6IFswLCAyMDBdIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgdXJsUGF0dGVybjogL15odHRwczpcXC9cXC9mb250c1xcLmdzdGF0aWNcXC5jb21cXC8uKi9pLFxuICAgICAgICAgICAgaGFuZGxlcjogXCJDYWNoZUZpcnN0XCIsXG4gICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgIGNhY2hlTmFtZTogXCJnc3RhdGljLWZvbnRzLWNhY2hlXCIsXG4gICAgICAgICAgICAgIGV4cGlyYXRpb246IHsgbWF4RW50cmllczogMTAsIG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDM2NSB9LFxuICAgICAgICAgICAgICBjYWNoZWFibGVSZXNwb25zZTogeyBzdGF0dXNlczogWzAsIDIwMF0gfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXFwuKHBuZ3xqcGd8anBlZ3xzdmd8Z2lmfHdlYnB8aWNvKSQvaSxcbiAgICAgICAgICAgIGhhbmRsZXI6IFwiQ2FjaGVGaXJzdFwiLFxuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBjYWNoZU5hbWU6IFwiaW1hZ2VzLWNhY2hlXCIsXG4gICAgICAgICAgICAgIGV4cGlyYXRpb246IHsgbWF4RW50cmllczogNjAsIG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDMwIH0sXG4gICAgICAgICAgICAgIGNhY2hlYWJsZVJlc3BvbnNlOiB7IHN0YXR1c2VzOiBbMCwgMjAwXSB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICB9KSxcbiAgICBzZW50cnlBdXRoVG9rZW4gJiYgc2VudHJ5T3JnICYmIHNlbnRyeVByb2plY3QgJiYgbW9kZSA9PT0gXCJwcm9kdWN0aW9uXCIgJiYgc2VudHJ5Vml0ZVBsdWdpbih7XG4gICAgICBhdXRoVG9rZW46IHNlbnRyeUF1dGhUb2tlbixcbiAgICAgIG9yZzogc2VudHJ5T3JnLFxuICAgICAgcHJvamVjdDogc2VudHJ5UHJvamVjdCxcbiAgICAgIHJlbGVhc2U6IHsgbmFtZTogcmVsZWFzZSB9LFxuICAgICAgc291cmNlbWFwczoge1xuICAgICAgICBhc3NldHM6IFwiLi9kaXN0LyoqXCIsXG4gICAgICAgIGZpbGVzVG9EZWxldGVBZnRlclVwbG9hZDogXCIuL2Rpc3QvKiovKi5tYXBcIixcbiAgICAgIH0sXG4gICAgfSksXG4gIF0uZmlsdGVyKEJvb2xlYW4pIGFzIGFueSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcbiAgICB9LFxuICB9LFxufSkpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF5VCxTQUFTLG9CQUFvQjtBQUN0VixPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZUFBZTtBQUN4QixTQUFTLHdCQUF3QjtBQUxqQyxJQUFNLG1DQUFtQztBQU96QyxJQUFN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
