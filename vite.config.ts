import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

const productionCsp: Plugin = {
  name: 'production-content-security-policy',
  apply: 'build',
  transformIndexHtml: {
    order: 'pre',
    handler: (html) => html.replace(
      '</head>',
      '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\'; img-src \'self\'; font-src \'self\'; connect-src \'self\'; object-src \'none\'; base-uri \'none\'; form-action \'self\'">\n  </head>',
    ),
  },
};

export default defineConfig({
  plugins: [react(), productionCsp],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    restoreMocks: true,
  },
});
