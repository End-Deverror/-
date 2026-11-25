// 用真实云端接口跑一遍前端搜索流程（jsdom 执行 app.js，不走本地演示数据）
import fs from 'node:fs'
import { JSDOM, VirtualConsole } from 'jsdom'

const sleep = ms => new Promise(r => setTimeout(r, ms))
const html = fs.readFileSync(new URL('../web/index.html', import.meta.url), 'utf8')
const vc = new VirtualConsole()
vc.on('jsdomError', e => { if (!/Not implemented/.test(String(e.message))) console.log('  [jsdom] ' + e.message) })

const dom = new JSDOM(html, { url: 'http://127.0.0.1:8765/#/', pretendToBeVisual: true, virtualConsole: vc })
const w = dom.window

for (const k of ['window', 'document', 'location', 'history', 'localStorage', 'sessionStorage', 'Event', 'HTMLElement', 'Node', 'getComputedStyle']) {
  try { globalThis[k] = w[k] } catch (e) {}
}
globalThis.window = w
w.localStorage.removeItem('cm_force_local')

const $ = s => w.document.querySelector(s)
const $$ = s => [...w.document.querySelectorAll(s)]

await import('../web/js/app.js')
await sleep(1500)
console.log('首页卡片数：' + $$('.grid .card').length + '（云端数据）\n')

for (const kw of ['牛奶', '活页', '九成新牛奶', '不存在的东西']) {
  $('#topSearchInput').value = kw
  $('#topSearch').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }))
  await sleep(1200)
  console.log(`搜索「${kw}」 hash=${w.location.hash}`)
  console.log(`   结果 ${$$('.grid .card').length} 张卡片，${$('#searchMeta') ? $('#searchMeta').textContent : '无统计'}`)
}
