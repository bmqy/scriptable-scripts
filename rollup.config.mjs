import path from 'node:path'
import { pathToFileURL } from 'node:url'
import glob from 'glob'
import serve from 'rollup-plugin-serve'
import pkg from './package.json' assert { type: 'json' }

const { version } = pkg
console.info(`Scriptable Template v${version}\r\n`)

const config = {
  author: 'bmqy',
  input: 'src/*.js',
  exclude: [
    'src/*.module.js',
    'src/no-background.js',
    'src/Config.js'
  ],
  dest: 'dist'
}

const files = glob.sync(config.input, { ignore: config.exclude || [] })
/** @type {import('rollup').RollupOptions[]} */
const modules = []

for (const filename of files) {
  const matches = filename.match(/(^.+?)(\.js)$/)
  if (matches) {
    const [, suffix] = matches.splice(1)
    let conf = {}
    try {
      const confPath = path.resolve(filename.replace(new RegExp(`${suffix}$`), '.json'))
      const confModule = await import(pathToFileURL(confPath), { assert: { type: 'json' } })
      conf = confModule.default
    } catch (e) {}
    const annotations = []
    if (conf.description) {
      const { description } = conf
      if (Array.isArray(description)) {
        for (const item of description) {
          annotations.push(` * ${item}`)
        }
      } else {
        annotations.push(` * ${description}`)
      }
      annotations.push(' *')
    }
    annotations.push(` * @version ${conf.version || '1.0.0'}`)
    if (config.author) {
      annotations.push(` * @author ${conf.author || config.author}`)
    }
    const banners = [
      '/**\n' + annotations.join('\n') + '\n */\n'
    ]
    if (conf.setting) {
      const { setting } = conf
      const items = []
      for (const key in setting) {
        items.push(`${key}: ${setting[key]};`)
      }
      if (items.length) {
        banners.unshift(
          '// Variables used by Scriptable.\n' +
          '// These must be at the very top of the file. Do not edit.\n' +
          `// ${items.join(' ')}`
        )
      }
    }

    const plugins = [
      // transform `module.exports`
      {
        /**
         * @param {string} code
         */
        transform (code) {
          return code.replace(/module\.exports\s* =\s*{/g, 'export {')
            .replace(/module\.exports\s* =/g, 'export default ')
            .replace(/(?:module\.)?exports\.(\w+)\s*=/g, (str, name) => {
              return `export const ${name} =`
            })
        }
      },
      // remove the secondary code
      {
        transform (code) {
          return code.replace("if (typeof require === 'undefined') require = importModule", '')
        }
      },
      // transform `importModule('utils')`/`require('utils')`
      {
        /**
         * @param {string} code
         */
        transform (code) {
          return code.replace(
            /((?:let)|(?:const)|(?:var))\s*((?:\w+)|(?:\{.*\}))\s*=\s*(?:importModule|require)\('(.*?)'\)/g,
            (str, declaration, imported, moduleName) => {
              return `import ${imported.replace(/:/g, ' as ')} from "./${moduleName}"`
            }
          )
            .replace(
              /(?:let|const)\s*{([\s\S]*?)\}\s*=\s*(?:importModule|require)\('(.*?)'\)/,
              "import {$1} from '$2'"
            )
        }
      }
    ]

    modules.push({
      input: filename,
      context: 'this',
      output: {
        banner: banners.join('\n'),
        file: path.join(
          config.dest,
          conf.name ? (conf.name + suffix) : path.relative('src', filename)
        ),
        format: 'es'
      },
      plugins:
        process.env.NODE_ENV === 'development'
          ? [
              ...plugins,
              serve(config.dest)
            ]
          : [...plugins]
    })
  }
}

export default modules
