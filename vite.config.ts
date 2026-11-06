import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';

/** version.json next to the game: what version it is, and the app build it needs (see src/core/update.ts). */
function versionFile(): Plugin {
  return {
    name: 'version-file',
    generateBundle() {
      const version = /v: '([0-9.]+)'/.exec(readFileSync('src/core/changelog.ts', 'utf8'))?.[1] ?? '0';
      const appBuild = Number(/APP_BUILD_NEEDED = (\d+)/.exec(readFileSync('src/core/notify.ts', 'utf8'))?.[1] ?? 0);
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version, appBuild }) });
    },
  };
}

export default defineConfig({
  // Relative paths so the build works from any static host (or packaged as a mobile app).
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
  plugins: [versionFile()],
});
