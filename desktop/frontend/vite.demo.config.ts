import { defineConfig, mergeConfig, type Plugin } from "vite";
import base from "./vite.config.ts";

function demoEntry(): Plugin {
  return {
    name: "lpm-demo-entry",
    transformIndexHtml: {
      order: "pre",
      handler: (html) => html.replace("/src/main.tsx", "/src/demo/main.ts"),
    },
  };
}

export default mergeConfig(
  base,
  defineConfig({
    base: "./",
    server: { port: 9246 },
    plugins: [demoEntry()],
    build: { outDir: "../../website/public/demo-app", emptyOutDir: true },
  }),
);
