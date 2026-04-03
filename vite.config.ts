import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const buildDate = new Date();
  const version = `${buildDate.getFullYear()}.${String(buildDate.getMonth() + 1).padStart(2, "0")}.${String(buildDate.getDate()).padStart(2, "0")}-${String(buildDate.getHours()).padStart(2, "0")}${String(buildDate.getMinutes()).padStart(2, "0")}`;

  return {
    define: {
      __BUILD_TIMESTAMP__: JSON.stringify(version),
    },
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "placeholder.svg"],
        workbox: {
          navigateFallbackDenylist: [/^\/~oauth/],
          globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp}"],
          importScripts: ["/push-sw.js"],
        },
        manifest: {
          name: "Hypnos Café",
          short_name: "Hypnos",
          description: "Menú digital de Hypnos Café: café de especialidad, tés, malteadas y comida.",
          theme_color: "#1e293b",
          background_color: "#ffffff",
          display: "standalone",
          orientation: "portrait",
          start_url: "/",
          scope: "/",
          icons: [
            { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
            { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
