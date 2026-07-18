import { cp, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const dictDir = join(dirname(require.resolve('kuromoji/package.json')), 'dict')
const modelFile = require.resolve('sasara/model/model.json')

await mkdir('public/dict', { recursive: true })
await cp(dictDir, 'public/dict', { recursive: true })
await cp(modelFile, 'public/model.json')
console.log('assets synced to public/')
