// 临时检查：云函数 HTTP 入口的外层协议（OPTIONS / 坏 JSON / 未知 action / CORS 头）
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const entry = fileURLToPath(new URL('../cloudfunctions/api/index.js', import.meta.url))
const api = require(entry)

const rows = []
const check = (label, cond) => rows.push([label, !!cond])

const opt = await api.main({ httpMethod: 'OPTIONS', body: '' }, {})
check('OPTIONS -> 204', opt.statusCode === 204)
check('OPTIONS 带 CORS 头', opt.headers['Access-Control-Allow-Origin'] === '*')

const bad = await api.main({ httpMethod: 'POST', body: 'not-json' }, {})
const badBody = JSON.parse(bad.body)
check('坏 JSON -> 200/ok:false', bad.statusCode === 200 && badBody.ok === false)

const unknown = await api.main({ httpMethod: 'POST', body: JSON.stringify({ action: 'nope' }) }, {})
const unBody = JSON.parse(unknown.body)
check('未知 action -> ok:false', unBody.ok === false)
check('响应头 Content-Type 正确', String(unknown.headers['Content-Type']).includes('application/json'))

for (const [k, v] of rows) console.log((v ? 'ok   ' : 'FAIL ') + k)
process.exit(rows.every(r => r[1]) ? 0 : 1)
