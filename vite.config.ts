import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss(), sveltekit()],
  // Resolve Svelte's browser build ONLY under vitest (mode==='test') so @testing-library/svelte
  // render() works; leaving dev/prod client resolution (module/development|production) untouched.
  ...(mode === 'test' ? { resolve: { conditions: ['browser'] } } : {}),
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts}', 'scripts/**/*.{test,spec}.{js,ts}']
  }
}));
