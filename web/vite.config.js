import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  // nodePolyfills: Buffer/process/global for the Privacy Pools SDK (poseidon / maci-crypto) in the browser
  plugins: [react(), nodePolyfills()],
  // dedupe three: react-globe.gl / three-globe each pull their own copy, which triggers the
  // "Multiple instances of Three.js" console warning. Force a single shared copy.
  resolve: { dedupe: ["three"] },
  server: { port: 5173, open: true },
});
