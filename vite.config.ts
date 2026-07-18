import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'

export default defineConfig(({ mode }) => ({
  plugins: [svelte(), svelteTesting()],
  resolve:
    mode === 'test'
      ? undefined
      : {
          alias: {
            'zlibjs/bin/gunzip.min.js': fileURLToPath(new URL('./src/shims/gunzip.ts', import.meta.url)),
            path: fileURLToPath(new URL('./src/shims/path.ts', import.meta.url)),
          },
        },
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts', 'tests/setup-jsdom.ts'],
  },
}))
