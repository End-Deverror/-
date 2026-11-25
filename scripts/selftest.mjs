// 接口自测：用本地演示后端跑一遍完整流程（发布 → 审核 → 搜索 → 购物车 → 下单 → 双方确认）
// 运行：node scripts/selftest.mjs
const store = new Map()
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k)
}

const { mockCall } = await import('../web/js/mock.js')

let token = ''
const call = (action, data = {}) => mockCall(action, data, token)

let pass = 0
let failed = 0
function ok(cond, label) {
  if (cond) { pass++; console.log('  ok   ' + label) }
  else { failed++; console.log('  FAIL ' + label) }
}
async function throws(fn, label) {
  try { await fn(); failed++; console.log('  FAIL ' + label + '（本该报错）') }
  catch (e) { pass++; console.log('  ok   ' + label + ' → ' + e.message) }
}
function section(t) { console.log('\n== ' + t + ' ==') }

// ---------- 登录 ----------
section('登录与鉴权')
const sellerLogin = await call('auth.login', { phone: '13900000002', password: '123456' })
ok(!!sellerLogin.token, '卖家登录成功：' + sellerLogin.user.nickname)
const sellerToken = sellerLogin.token

const adminLogin = await call('auth.login', { phone: '13700000000', password: '123456' })
ok(adminLogin.user.role === 'admin', '管理员登录，role=admin')

token = sellerToken
await throws(() => call('admin.stats'), '普通用户访问管理员接口被拒')

// ---------- 发布 ----------
section('发布商品')
const pub = await call('product.publish', {
  title: '自测用：索尼降噪耳机 WH-1000XM4',
  desc: '自测数据，功能正常，配件齐全。',
  price: 89900,
  category: '数码电子',
  stock: 1,
  images: ['data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E']
})
ok(!!pub.id, '发布成功，状态 ' + pub.status)
ok(pub.status === 'pending', '新发布默认待审核')

const listed = await call('product.list', {})
ok(!listed.items.some(p => p.id === pub.id), '待审核商品不出现在首页')

await throws(() => call('product.publish', { title: '短', desc: 'x', price: 1, images: [] }), '标题/描述/图片校验')

// ---------- 审核 ----------
section('管理员审核')
token = adminLogin.token
const pending = await call('admin.list', { status: 'pending' })
ok(pending.items.some(p => p.id === pub.id), '待审核列表里能看到')

await call('admin.moderate', { id: pub.id, pass: true })
token = sellerToken
const detail = await call('product.detail', { id: pub.id })
ok(detail.product.status === 'on', '审核通过后状态变为在售')

// ---------- 搜索 ----------
section('搜索')
const byKw = await call('product.list', { keyword: '降噪' })
ok(byKw.items.some(p => p.id === pub.id), '关键词“降噪”能搜到（标题片段）')

const byDesc = await call('product.list', { keyword: '配件' })
ok(byDesc.items.some(p => p.id === pub.id), '关键词“配件”能搜到（描述片段）')

const multi = await call('product.list', { keyword: '索尼 耳机' })
ok(multi.items.some(p => p.id === pub.id), '多词“索尼 耳机”命中（词之间是且）')

const multiMiss = await call('product.list', { keyword: '索尼 显示器' })
ok(!multiMiss.items.some(p => p.id === pub.id), '“索尼 显示器”不命中（有一个词对不上）')

const lower = await call('product.list', { keyword: 'ipad' })
ok(lower.items.some(p => p.title.includes('iPad')), '小写 ipad 能匹配 iPad（忽略大小写）')

const fullWidth = await call('product.list', { keyword: 'ＩＰＡＤ' })
ok(fullWidth.items.some(p => p.title.includes('iPad')), '全角 ＩＰＡＤ 能匹配 iPad（全半角归一）')

const byCat = await call('product.list', { category: '图书教材' })
ok(byCat.items.length > 0 && byCat.items.every(p => p.category === '图书教材'), '分类筛选只返回该分类')
const sorted = await call('product.list', { sort: 'priceAsc', pageSize: 50 })
ok(sorted.items.every((p, i, a) => i === 0 || a[i - 1].price <= p.price), '价格升序排序正确')

// ---------- 购物车 ----------
section('购物车')
const buyerLogin = await call('auth.login', { phone: '13900000001', password: '123456' })
const buyerToken = buyerLogin.token
token = buyerToken

await throws(() => call('product.detail', { id: 'not-exist' }), '不存在的商品详情报错')

const add = await call('cart.add', { productId: pub.id, qty: 1 })
ok(add.count >= 1, '加入购物车，当前 ' + add.count + ' 条')
const cart = await call('cart.list', {})
const row = cart.items.find(i => i.product.id === pub.id)
ok(!!row, '购物车里能看到这件商品')
await call('cart.update', { id: row.id, qty: 3 })
const cart2 = await call('cart.list', {})
ok(cart2.items.find(i => i.id === row.id).qty === 1, '数量被库存上限限制为 1')

// 卖家买自己的东西应被拒
token = sellerToken
await throws(() => call('cart.add', { productId: pub.id, qty: 1 }), '不能买自己发布的商品')
token = buyerToken

// ---------- 下单 ----------
section('下单')
const addr = await call('address.list', {})
ok(addr.items.length > 0, '默认面交地址已就绪：' + addr.items[0].place)

const created = await call('order.create', {
  items: [{ productId: pub.id, qty: 1 }],
  contact: { name: '林小满', phone: '13900000001', place: '东区 3 号宿舍楼下' },
  note: '晚上六点后都在'
})
ok(!!created.orderNo, '下单成功，订单号 ' + created.orderNo)

const afterOrder = await call('cart.list', {})
ok(!afterOrder.items.some(i => i.product.id === pub.id), '下单后该商品从购物车移除')
const reserved = await call('product.detail', { id: pub.id })
ok(reserved.product.status === 'reserved', '商品被锁定为「已预订」')

// ---------- 双方确认 ----------
section('订单流转')
const buyList = await call('order.list', { role: 'buy' })
const o1 = buyList.items.find(o => o.id === created.id)
ok(o1 && o1.status === 'pending' && o1.myRole === 'buyer', '买家订单列表可见，状态待面交')

await call('order.confirm', { id: created.id })
const mid = (await call('order.detail', { id: created.id })).order
ok(mid.status === 'pending' && mid.buyerConfirmed, '买家单方确认后仍是待面交')

token = sellerToken
const sellList = await call('order.list', { role: 'sell' })
ok(sellList.items.some(o => o.id === created.id), '卖家订单列表可见')

const done = await call('order.confirm', { id: created.id })
ok(done.order.status === 'done', '双方确认后订单完成')

const sold = await call('product.detail', { id: pub.id })
ok(sold.product.status === 'sold', '商品状态变为已售出')

await throws(() => call('order.confirm', { id: created.id }), '已结束的订单不能再确认')

// ---------- 取消 ----------
section('取消订单')
token = sellerToken
const pub2 = await call('product.publish', {
  title: '自测用：宿舍折叠桌', desc: '自测数据第二件。', price: 5000,
  category: '生活用品', images: ['data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E']
})
token = adminLogin.token
await call('admin.moderate', { id: pub2.id, pass: true })
token = buyerToken
const c2 = await call('order.create', {
  items: [{ productId: pub2.id, qty: 1 }],
  contact: { name: '林小满', phone: '13900000001', place: '图书馆南门' }
})
await call('order.cancel', { id: c2.id })
const back = await call('product.detail', { id: pub2.id })
ok(back.product.status === 'on', '取消订单后商品回到在售')

// ---------- 驳回 ----------
section('驳回与下架')
token = sellerToken
const pub3 = await call('product.publish', {
  title: '自测用：来路不明的充电宝', desc: '自测数据第三件，用于验证驳回。', price: 2000,
  category: '数码电子', images: ['data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E']
})
token = adminLogin.token
await call('admin.moderate', { id: pub3.id, pass: false, reason: '疑似违禁品' })
token = sellerToken
const rej = await call('product.mine', {})
const rejItem = rej.items.find(p => p.id === pub3.id)
ok(rejItem && rejItem.status === 'rejected' && rejItem.rejectReason === '疑似违禁品', '驳回原因回传给卖家')

// ---------- 统计 ----------
section('管理员统计')
token = adminLogin.token
const st = await call('admin.stats')
ok(typeof st.pending === 'number' && st.users >= 4, '统计接口正常：' + JSON.stringify(st))

console.log('\n--------------------------------')
console.log(`通过 ${pass} 项，失败 ${failed} 项`)
process.exit(failed ? 1 : 0)
