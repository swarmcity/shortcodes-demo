import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact()],
  build: {
    target: ["es2020"],
    ssr: false,
  },
  resolve: {
    conditions: ["browser", "module"],
    alias: {
      os: "rollup-plugin-node-polyfills/polyfills/os",
      util: "rollup-plugin-node-polyfills/polyfills/util",
      stream: "rollup-plugin-node-polyfills/polyfills/stream",
      http: "rollup-plugin-node-polyfills/polyfills/http",
      https: "rollup-plugin-node-polyfills/polyfills/http",
      url: "rollup-plugin-node-polyfills/polyfills/url",
      querystring: "rollup-plugin-node-polyfills/polyfills/qs",
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
        "globalThis.process.env.NODE_ENV": '"globalThis.process.env.NODE_ENV"',
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          process: true,
          buffer: true,
        }),
      ],
    },
  },
});
