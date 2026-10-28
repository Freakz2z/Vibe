import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const BACKEND = "http://127.0.0.1:8787";

export default defineConfig(({ mode }) => ({
  base: mode === "toy" ? "./" : "/",
  resolve: {
    alias: [
      {
        find: /^\.{1,2}\/edition$/,
        replacement: fileURLToPath(
          new URL(
            mode === "toy" ? "./src/toy/edition.tsx" : "./src/edition.tsx",
            import.meta.url,
          ),
        ),
      },
    ],
  },
  plugins: [
    react(),
    {
      name: "website-build-boundary",
      enforce: "post",
      generateBundle(_options, bundle) {
        if (mode === "toy") return;
        const forbidden = Object.values(bundle).flatMap((output) =>
          output.type === "chunk"
            ? Object.keys(output.modules).filter((id) =>
                /[/\\]src[/\\]toy[/\\]/.test(id),
              )
            : [],
        );
        if (forbidden.length)
          this.error(
            "Website build includes Toy modules: " + forbidden.join(", "),
          );
        const leaked = Object.keys(bundle).filter((name) =>
          /Games-|robot-stickers|toy-sdk/i.test(name),
        );
        if (leaked.length)
          this.error("Website build includes Toy assets: " + leaked.join(", "));
      },
    },
    {
      name: "toy-entry",
      transformIndexHtml: {
        order: "pre",
        handler(html) {
          if (mode !== "toy") return html;
          return html
            .replace("/src/main.tsx", "/src/toy/main.tsx")
            .replaceAll("/media/", "./media/")
            .replace(/<meta name="google-site-verification"[^>]+>/, "")
            .replace(
              "</head>",
              '<script src="https://s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js"></script></head>',
            );
        },
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": { target: BACKEND, changeOrigin: true },
      "/media": { target: BACKEND, changeOrigin: true },
    },
  },
  build: {
    outDir: mode === "toy" ? "../../dist-toy" : "dist",
    emptyOutDir: true,
    rolldownOptions:
      mode === "toy"
        ? {
            output: {
              // Toy serves .js and .json; its preview returned 404 for .mjs/.geojson.
              assetFileNames: (asset) =>
                asset.names.some((name) => name.endsWith(".mjs"))
                  ? "assets/[name]-[hash].js"
                  : "assets/[name]-[hash][extname]",
            },
          }
        : undefined,
    // Keep local fonts as same-origin files under the strict font-src policy.
    assetsInlineLimit: 0,
  },
}));
