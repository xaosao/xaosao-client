import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  server: {
    port: 5176,
    host: true, // Required for ngrok to connect
    allowedHosts: [".ngrok-free.app", ".ngrok-free.dev", ".ngrok.io"],
  },
  optimizeDeps: {
    exclude: ['telbiz', 'web-push', 'nodemailer'],
  },
  ssr: {
    external: ['telbiz', 'web-push', 'nodemailer'],
  },
});
