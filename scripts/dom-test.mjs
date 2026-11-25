// 前端集成自测：用 jsdom 真实执行 app.js，检查页面渲染与交互
//
// 首次运行前安装依赖：npm install
// 运行：node scripts/dom-test.mjs buyer
//       node scripts/dom-test.mjs admin
import fs from 'node:fs'
import { JSDOM, VirtualConsole } from 'jsdom'

const MODE = process.argv[2] || 'buyer'
let pass = 0
let failed = 0
function ok(cond, label) {
  if (cond) { pass++; console.log('  ok   ' + label) }
  else { failed++; console.log('  FAIL ' + label) }
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

const html = fs.readFileSync(new URL('../web/index.html', import.meta.url), 'utf8')
const vc = new VirtualConsole()
vc.on('jsdomError', e => {
  if (!/Not implemented/.test(String(e.message))) console.log('  [jsdom] ' + e.message)
})

const dom = new JSDOM(html, {
  url: 'http://127.0.0.1:8765/#/',
  pretendToBeVisual: true,
  virtualConsole: vc
})
const w = dom.window

for (const k of ['window', 'document', 'location', 'history', 'localStorage', 'sessionStorage', 'Event', 'HTMLElement', 'Node', 'getComputedStyle']) {
  try { globalThis[k] = w[k] } catch (e) { /* navigator 等只读全局跳过 */ }
}
globalThis.window = w

// 管理员模式：先把管理员会话写进本地存储，再启动应用
// 测试始终跑本地演示数据，避免依赖/污染真实云端
w.localStorage.setItem('cm_force_local', '1')

if (MODE === 'admin') {
  w.localStorage.setItem('cm_token', 'mock.u0')
  w.localStorage.setItem('cm_user', JSON.stringify({
    id: 'u0', phone: '13700000000', nickname: '管理员', school: '示例大学',
    studentNo: '0000000000', contactPhone: '13700000000', role: 'admin'
  }))
}

const $ = s => w.document.querySelector(s)
const $$ = s => [...w.document.querySelectorAll(s)]
const text = s => ($(s) ? $(s).textContent.trim() : '')

async function goto(hash, wait = 220) {
  w.location.hash = hash
  await sleep(wait)
}

await import('../web/js/app.js')
await sleep(320)

if (MODE === 'buyer') {
  console.log('\n== 首页 ==')
  ok($$('.grid .card').length === 12, '首页渲染出 12 张商品卡片（实际 ' + $$('.grid .card').length + '）')
  ok($$('.hero-stats b')[0].textContent === '12', '在售件数统计为 12')
  ok(text('.card .price').includes('¥'), '卡片上有价格：' + text('.card .price'))
  ok($$('#catChips .chip').length === 8, '分类筛选按钮 8 个（全部 + 7 类）')
  ok(!!$('.card .card-title') && $('.card .card-title').textContent.length > 2, '卡片标题：' + text('.card .card-title'))

  console.log('\n== 分类筛选 ==')
  $$('#catChips .chip')[2].click()   // 图书教材
  await sleep(260)
  const catCards = $$('.grid .card')
  ok(catCards.length > 0 && catCards.length < 12, '切换分类后只剩该类商品（' + catCards.length + ' 件）')

  console.log('\n== 顶栏搜索 ==')
  w.location.hash = '#/'
  await sleep(240)
  $('#topSearchInput').value = '耳机'
  $('#topSearch').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }))
  await sleep(280)
  ok(w.location.hash.startsWith('#/search?q='), '提交搜索框跳到结果页（' + w.location.hash + '）')
  ok($$('.grid .card').length >= 1, '结果页有商品')
  ok($('#topSearchInput').value === '耳机', '搜索框回填关键词')

  console.log('\n== 商品详情 ==')
  await goto('#/p/p1')
  ok(!!$('.detail-side'), '详情页副栏渲染')
  ok(text('.detail-side h1').includes('iPad'), '标题正确：' + text('.detail-side h1'))
  ok(!!$('.detail-side a[href*="/login"]'), '未登录时购买入口引导去登录')
  ok($$('.gallery-thumbs img').length === 0, '单图商品不显示缩略图条')

  console.log('\n== 搜索 ==')
  await goto('#/search?q=考研')
  ok($$('.grid .card').length >= 2, '搜索“考研”命中 ' + $$('.grid .card').length + ' 件')
  ok(text('#searchMeta').includes('共'), '结果统计文案：' + text('#searchMeta'))

  await goto('#/search?q=雅思')
  const partial = $$('.grid .card').length
  ok(partial >= 1 && partial < 12, '搜片段“雅思”命中 ' + partial + ' 件（不是整条标题也能中）')

  await goto('#/search?q=雅思 真题')
  ok($$('.grid .card').length >= 1, '多词“雅思 真题”命中 ' + $$('.grid .card').length + ' 件')

  await goto('#/search?q=ipad')
  ok($$('.grid .card').length >= 1, '小写 ipad 能搜到 iPad')

  await goto('#/search?q=不存在的东西')
  ok(!!$('.empty'), '无结果时显示空状态')

  console.log('\n== 未登录拦截 ==')
  await goto('#/cart')
  ok(w.location.hash.includes('/login'), '未登录访问购物车被跳到登录页（' + w.location.hash + '）')

  console.log('\n== 登录 ==')
  $('#lPhone').value = '13900000001'
  $('#lPwd').value = '123456'
  $('#doBtn').click()
  await sleep(320)
  ok(!!w.localStorage.getItem('cm_token'), '登录后写入 token')
  ok($('.topnav .avatar-chip') !== null, '顶栏出现用户入口')
  ok(w.location.hash === '#/cart', '登录后回到原本要去的页面（' + w.location.hash + '）')

  console.log('\n== 加入购物车 ==')
  await goto('#/p/p2')
  $('#addCart').click()
  await sleep(200)
  ok($('.tabbar a .badge') || $('.topnav .badge'), '购物车角标出现')
  await goto('#/cart')
  ok($$('.cart-row').length === 1, '购物车里有 1 行商品')
  ok(text('.cart-side .btn-primary').includes('去结算'), '结算按钮存在')

  console.log('\n== 结算下单 ==')
  $('#goCheckout').click()
  await sleep(260)
  ok(w.location.hash.startsWith('#/checkout'), '进入确认订单页')
  ok(!!$('#cPlace'), '面交地点输入框存在')
  ok($('#cPlace').value.length > 0, '默认地址自动带出：' + $('#cPlace').value)
  $('#cName').value = '林小满'
  $('#cPhone').value = '13900000001'
  $('#cPlace').value = '图书馆南门'
  $('#submitOrder').click()
  await sleep(400)
  ok(w.location.hash === '#/orders', '下单后跳转订单页（' + w.location.hash + '）')
  ok($$('.order').length === 1, '订单列表出现 1 条订单')
  ok(text('.order .order-head').includes('CM'), '订单号显示正常')
  ok(text('.order .tag').includes('待面交'), '订单状态为待面交')
  ok(!!$('[data-confirm]'), '有确认按钮')

  console.log('\n== 个人中心 ==')
  await goto('#/me')
  ok(!!$('.me-head'), '个人中心渲染')
  ok(text('.me-head h2').includes('林小满'), '显示昵称')
  ok($$('#meStats .me-stat b').every(el => el.textContent !== '–'), '四项统计都算出来了：' + $$('#meStats .me-stat b').map(e => e.textContent).join('/'))
  ok($$('.list-row').length >= 4, '功能入口齐备')

  console.log('\n== 我的发布 / 发布页 ==')
  await goto('#/me/products')
  ok(!!$('.empty') || $$('.list-row').length > 0, '我的发布页可渲染')
  await goto('#/publish')
  ok(!!$('#fTitle') && !!$('#fPrice') && !!$('#fDesc'), '发布表单字段齐全')
  ok(!!$('#addImg'), '有图片添加入口')
  $('#fTitle').value = '测试标题'
  $('#fPrice').value = '12'
  $('#fDesc').value = '这是一段测试描述'
  $('#submitBtn').click()
  await sleep(260)
  ok(text('#formErr').includes('图片'), '没传图片时提示需要图片：' + text('#formErr'))
  console.log('\n== 注册表单 ==')
  await goto('#/login?mode=reg')
  ok($('#regFields').style.display === 'block', '切到注册后字段展开')
  ok(!!$('#lAdmin'), '注册表单里有「管理员注册码」输入框')
  ok(!!$('#lSchool') && !!$('#lNo'), '学校与学号字段齐全')
} else {
  console.log('\n== 管理员后台 ==')
  await goto('#/admin')
  ok(!!$('.admin-stat'), '统计卡片区渲染')
  ok($$('.admin-card b').every(el => el.textContent !== '–'), '统计数字已加载：' + $$('.admin-card b').map(e => e.textContent).join('/'))
  ok($$('.tabs button').length === 4, '四个状态页签')
  ok(!!$('.empty'), '待审核为空时显示空状态')

  await goto('#/admin?tab=on')
  ok($$('.mod-row').length === 12, '在售列表 12 条（实际 ' + $$('.mod-row').length + '）')
  ok(!!$('[data-take]'), '有下架按钮')

  console.log('\n== 顶栏与权限 ==')
  ok(!!$('.avatar-chip'), '管理员已登录')
  await goto('#/me')
  ok(text('.list-card').includes('管理员后台'), '个人中心里出现管理员入口')
}

console.log('\n--------------------------------')
console.log(`[${MODE}] 通过 ${pass} 项，失败 ${failed} 项`)
process.exit(failed ? 1 : 0)
