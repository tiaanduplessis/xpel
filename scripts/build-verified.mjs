import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Isolate maintained build tools from this package's historical toolchain.
const toolRoot = path.resolve(process.argv[2] || '.build-tools')
const minifierRoot = path.resolve(process.argv[3] || toolRoot)
const root = path.resolve(process.argv[4] || fileURLToPath(new URL('../', import.meta.url)))
const toolRequire = createRequire(path.join(toolRoot, 'package.json'))
const minifierRequire = createRequire(path.join(minifierRoot, 'package.json'))
for (const [name, version] of Object.entries({ '@babel/core': '8.0.7', '@babel/preset-env': '8.0.7', rollup: '4.64.3' })) {
  if (toolRequire(name + '/package.json').version !== version) throw new Error('Unexpected build tool version: ' + name)
}
if (minifierRequire('uglify-js/package.json').version !== '3.19.3') throw new Error('Expected UglifyJS 3.19.3')
delete process.env.UGLIFY_BUG_REPORT
const minifier = minifierRequire('uglify-js')
const loadTool = name => import(pathToFileURL(toolRequire.resolve(name)).href)
const { transformAsync } = await loadTool('@babel/core')
const { default: presetEnv } = await loadTool('@babel/preset-env')
const { rollup } = await loadTool('rollup')
const source = path.join(root, 'src/index.js')
const transformed = await transformAsync(fs.readFileSync(source, 'utf8'), {
  filename: source,
  babelrc: false,
  configFile: false,
  comments: true,
  sourceType: 'module',
  assumptions: { ignoreFunctionLength: true },
  presets: [[presetEnv, { targets: { ie: '11' }, modules: false, useBuiltIns: false }]]
})
const entry = 'index.js'
const bundle = await rollup({
  input: entry,
  plugins: [{ name: 'verified-source', resolveId: id => id === entry ? entry : null, load: id => id === entry ? transformed.code : null }]
})
fs.mkdirSync(path.join(root, 'dist'), { recursive: true })
try {
  for (const [format, filename] of [['es', 'xpel.es.js'], ['umd', 'xpel.js']]) {
    await bundle.write({ file: path.join(root, 'dist', filename), format, name: 'xpel', exports: 'default', generatedCode: 'es5', sourcemap: false })
  }
} finally {
  await bundle.close()
}
const minified = minifier.minify({ 'xpel.js': fs.readFileSync(path.join(root, 'dist/xpel.js'), 'utf8') }, {
  module: false,
  toplevel: false,
  // Keep repeated subscription getter reads observable.
  compress: { keep_fargs: true, conditionals: false },
  sourceMap: { filename: 'xpel.min.js', url: 'xpel.min.js.map', includeSources: true }
})
if (minified.error) throw minified.error
fs.writeFileSync(path.join(root, 'dist/xpel.min.js'), minified.code + '\n')
fs.writeFileSync(path.join(root, 'dist/xpel.min.js.map'), minified.map + '\n')
console.log('Built ES and UMD distributions with Babel 8.0.7, Rollup 4.64.3 and UglifyJS 3.19.3')
