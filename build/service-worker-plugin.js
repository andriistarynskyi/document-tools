// Emits sw.js from public/sw.js with the build hash and the app-shell file list filled in.
// A cache name per build lets the service worker delete everything an older deploy cached.
const fs = require('fs');
const { Compilation, sources } = require('webpack');

const NAME = 'ServiceWorkerPlugin';
const PREFIX_TOKEN = '__CACHE_PREFIX__';
const BUILD_TOKEN = '__BUILD_HASH__';
const SHELL_TOKEN = '__APP_SHELL__';

/** Files only for tooling or legal notices; never worth caching for offline use. */
const isCacheable = (file) => !/\.(map|LICENSE\.txt)$/.test(file);

/** Fills the template placeholders. Pure, so it can be unit tested without webpack. */
function renderServiceWorker(template, { cachePrefix, buildHash, shell }) {
  for (const token of [PREFIX_TOKEN, BUILD_TOKEN, SHELL_TOKEN]) {
    if (!template.includes(token)) throw new Error(`${NAME}: template is missing ${token}`);
  }
  return template
    .replace(PREFIX_TOKEN, JSON.stringify(cachePrefix))
    .replace(BUILD_TOKEN, JSON.stringify(buildHash))
    .replace(SHELL_TOKEN, JSON.stringify(shell));
}

/** The page plus the files the entry needs to start; lazy chunks are cached on first use. */
function appShell(compilation) {
  const entryFiles = [...compilation.entrypoints.values()].flatMap((e) => e.getFiles());
  return ['./', ...new Set(entryFiles.filter(isCacheable).map((f) => `./${f}`))];
}

class ServiceWorkerPlugin {
  /** @param {{ template: string, cachePrefix: string }} options */
  constructor(options) {
    this.options = options;
  }

  apply(compiler) {
    compiler.hooks.thisCompilation.tap(NAME, (compilation) => {
      compilation.fileDependencies.add(this.options.template);
      compilation.hooks.processAssets.tap(
        { name: NAME, stage: Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE },
        () => {
          const template = fs.readFileSync(this.options.template, 'utf8');
          const source = renderServiceWorker(template, {
            cachePrefix: this.options.cachePrefix,
            buildHash: compilation.fullHash ?? compilation.hash,
            shell: appShell(compilation),
          });
          compilation.emitAsset('sw.js', new sources.RawSource(source));
        },
      );
    });
  }
}

module.exports = { ServiceWorkerPlugin, renderServiceWorker };
