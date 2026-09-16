// vite.config.js
import { defineConfig } from "vite";

export default defineConfig({
    build: {
        target: "es2020",
        outDir: "dist",
        emptyOutDir: true,
        rollupOptions: {
            input: {
                background: "src/background.js"
            },
            output: {
                entryFileNames: "[name].js",
                format: "esm"
            }
        }
    }
});
