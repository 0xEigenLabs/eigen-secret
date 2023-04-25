import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import {viteCommonjs, esbuildCommonjs} from '@originjs/vite-plugin-commonjs'

// https://vitejs.dev/config/
export default defineConfig({
  esbuildOptions: {
    plugins: [esbuildCommonjs(['@eigen-secret/core'])],
  },
  plugins: [
    react(),
    viteCommonjs(),
    nodePolyfills({
      // Whether to polyfill `node:` protocol imports.
      protocolImports: true,
    }),
  ],
})
