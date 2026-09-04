const esbuild = require('esbuild');

const isWatch = process.argv.includes('--watch');
const isProduction = process.argv.includes('--production');

async function build() {
  const context = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: isProduction,
    sourcemap: !isProduction,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    logLevel: 'info'
  });

  if (isWatch) {
    await context.watch();
    console.log('Watching for extension changes...');
  } else {
    await context.rebuild();
    await context.dispose();
    console.log('Extension build completed.');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
