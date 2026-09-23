/**
 * PostCSS config.
 *
 * Plugins MUST be given as string keys — Next.js rejects functions passed by
 * require() with "Malformed PostCSS Configuration". Next resolves these names
 * itself, so `tailwindcss` and `autoprefixer` have to be reachable from the
 * project root (they are declared in devDependencies).
 *
 * @type {import('postcss-load-config').Config}
 */
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
