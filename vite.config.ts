import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    {
      name: 'isolate-plugin-bundle',
      generateBundle(_options, bundle) {
        // ES2015 lowering can place helpers outside Rollup's IIFE.
        // Keep those helpers private to the plugin as well.
        for (const output of Object.values(bundle)) {
          if (output.type === 'chunk') {
            output.code = `(function(){\n${output.code}\n})();`;
          }
        }
      },
    },
  ],
  build: {
    target: 'es2015',
    lib: {
      entry: 'src/index.ts',
      name: 'LampaStream',
      formats: ['iife'],
      fileName: () => 'plugin.js',
    },
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  test: { environment: 'jsdom', clearMocks: true, restoreMocks: true },
});
