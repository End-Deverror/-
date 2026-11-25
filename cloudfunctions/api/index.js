/**
 * 校园集市 · 云函数 api
 * ------------------------------------------------------------------
 * 一个函数承载全部业务接口，客户端只发 { action, data, token }。
 * 既支持「HTTP 访问服务」调用（浏览器 fetch），也支持 callFunction 直接调用。
 * 部署步骤见 docs/部署说明.md
 */
const crypto = require('crypto')

// ============ 云开发初始化 ============
let cloud = null
let db = null

function initCloud() {
  if (cloud) return cloud

  // 优先 CloudBase Node SDK，没有则回退微信云开发 SDK
  try {
    const tcb = require('@cloudbase/node-sdk')
    cloud = tcb.init({ env: process.env.TCB_ENV || process.env.SCF_NAMESPACE || tcb.SYMBOL_CURRENT_ENV })
  } catch (e1) {
    try {
      const ws = require('wx-server-sdk')
      cloud = ws.init({ env: ws.DYNAMIC_CURRENT_ENV })
    } catch (e2) {
      throw new Error('云开发 SDK 未就绪，请安装 @cloudbase/node-sdk 或 wx-server-sdk')
    }
  }
  db = cloud.database()
  return cloud
}

const COLL = {
  users: 'users',
  products: 'products',
  carts: 'carts',
  orders: 'orders',
  addresses: 'addresses'
}

// ============ 令牌 ============
const SECRET = process.env.TOKEN_SECRET || 'campus-market-secret-please-change'
const TOKEN_TTL = 30 * 24 * 3600 * 1000

function signToken(uid) {
  const payload = { uid, exp: Date.now() + TOKEN_TTL }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url')
  return body + '.' + sig
}

function readToken(token) {
  if (!token || typeof token !== 'string' || token.indexOf('.') < 0) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const body = parts[0]
  const sig = parts[1]
  const expect = crypto.createHmac('sha256', SECRET).update(body).digest('base64url')
  if (sig.length !== expect.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null
  let payload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch (e) {
    return null
  }
  if (!payload.uid || payload.exp < Date.now()) return null
  return payload
}

// ============ 口令 ============
function hashPwd(pwd, salt) {
  return crypto.scryptSync(String(pwd), salt, 32).toString('hex')
}
function newSalt() {
  return crypto.randomBytes(12).toString('hex')
}

// ============ 小工具 ============
const nowTs = () => Date.now()
const str = v => String(v == null ? '' : v).trim()
const escapeReg = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// doc().get() 在不同 SDK 版本里可能返回数组或单个对象，统一取一条
function firstOf(res) {
  const d = res && res.data
  return Array.isArray(d) ? (d[0] || null) : (d || null)
}

function fail(msg) {
  const e = new Error(msg)
  e.expose = true
  throw e
}

// 云存储临时链接缓存
//
// 注意：getTempFileURL 返回的签名链接只活十几分钟，**不能**按官方说的 2 小时去缓存。
// 之前这里缓存 25 分钟，超过链接寿命；云函数是多实例的，每个实例各存各的，
// 于是命中有新签名的实例能显示，命中旧实例的图片就 403（CDN_SIGNATURE_EXPIRED）。
// 现在缓存 2 分钟，远小于链接寿命，保证发出去的链接都还能用。
const URL_CACHE_TTL = 2 * 60 * 1000
const urlCache = new Map()

async function resolveFileIDs(ids) {
  const uniq = [...new Set((ids || []).filter(x => typeof x === 'string' && x.startsWith('cloud://')))]
  if (!uniq.length) return ids

  const need = uniq.filter(id => {
    const c = urlCache.get(id)
    return !c || nowTs() - c.at > URL_CACHE_TTL
  })

  for (let i = 0; i < need.length; i += 50) {
    const chunk = need.slice(i, i + 50)
    try {
      const res = await cloud.getTempFileURL({ fileList: chunk })
      ;(res.fileList || []).forEach(f => {
        if (f.tempFileURL) urlCache.set(f.fileID, { url: f.tempFileURL, at: nowTs() })
      })
    } catch (e) {
      // 取不到临时链接就退回原始 fileID，不影响列表渲染
    }
  }
  return ids.map(id => (urlCache.get(id) || {}).url || id)
}

async function mapProductImages(list) {
  const all = []
  list.forEach(p => (p.images || []).forEach(u => all.push(u)))
  if (!all.length) return list
  const resolved = await resolveFileIDs(all)
  let k = 0
  return list.map(p => ({ ...p, images: (p.images || []).map(() => resolved[k++]) }))
}

// 订单里存的也是 fileID，缩略图同样要换成临时链接，否则订单页会图片裂开
async function mapOrderImages(orders) {
  const all = []
  orders.forEach(o => (o.items || []).forEach(it => all.push(it.image)))
  if (!all.length) return orders
  const resolved = await resolveFileIDs(all)
  let k = 0
  for (const o of orders) {
    for (const it of o.items || []) {
      it.image = resolved[k++] || ''
    }
  }
  return orders
}

function publicUser(u) {
  if (!u) return null
  return {
    id: u._id,
    phone: u.phone,
    nickname: u.nickname,
    school: u.school,
    studentNo: u.studentNo,
    contactPhone: u.contactPhone,
    role: u.role,
    createdAt: u.createdAt
  }
}

function sellerBrief(u) {
  if (!u) return null
  return { id: u._id, nickname: u.nickname, school: u.school, contactPhone: u.contactPhone, createdAt: u.createdAt }
}

function shapeProduct(p) {
  return {
    id: p._id,
    sellerId: p.sellerId,
    title: p.title,
    desc: p.desc,
    price: p.price,
    category: p.category,
    images: p.images || [],
    stock: p.stock,
    status: p.status,
    rejectReason: p.rejectReason || '',
    views: p.views || 0,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt
  }
}

async function attachSellers(list) {
  const ids = [...new Set(list.map(p => p.sellerId).filter(Boolean))]
  if (!ids.length) return list
  const _ = db.command
  const res = await db.collection(COLL.users).where({ _id: _.in(ids) })
    .field({ nickname: true, school: true, contactPhone: true, createdAt: true }).get()
  const map = {}
  ;(res.data || []).forEach(u => { map[u._id] = sellerBrief(u) })
  return list.map(p => ({ ...p, seller: map[p.sellerId] || null }))
}

async function getUserById(id) {
  if (!id) return null
  try {
    const r = await db.collection(COLL.users).doc(id).get()
    return firstOf(r)
  } catch (e) {
    return null
  }
}

async function requireUser(token) {
  const payload = readToken(token)
  if (!payload) fail('登录已过期，请重新登录')
  const u = await getUserById(payload.uid)
  if (!u) fail('登录已过期，请重新登录')
  return u
}

async function requireAdmin(token) {
  const u = await requireUser(token)
  if (u.role !== 'admin') fail('需要管理员权限')
  return u
}

async function getProduct(id) {
  if (!id) fail('商品不存在或已被删除')
  let p = null
  try {
    p = firstOf(await db.collection(COLL.products).doc(id).get())
  } catch (e) {
    p = null
  }
  if (!p) fail('商品不存在或已被删除')
  return p
}

// ============ 业务接口 ============
const handlers = {}

// ---------- 账号 ----------
handlers['auth.register'] = async (d) => {
  const phone = str(d.phone)
  const pwd = String(d.password || '')
  const nickname = str(d.nickname)
  const school = str(d.school)
  const studentNo = str(d.studentNo)

  if (!/^1\d{10}$/.test(phone)) fail('请输入 11 位手机号')
  if (pwd.length < 6) fail('密码至少 6 位')
  if (!nickname || nickname.length > 16) fail('昵称请填 1-16 个字')
  if (!school) fail('请填写学校')
  if (!/^\d{6,12}$/.test(studentNo)) fail('学号应为 6-12 位数字')

  const exist = await db.collection(COLL.users).where({ phone }).count()
  if (exist.total > 0) fail('这个手机号已经注册过了')

  const salt = newSalt()
  const adminCode = process.env.ADMIN_CODE || 'CAMPUS-ADMIN'
  const isAdmin = str(d.adminCode) && str(d.adminCode) === adminCode
  const doc = {
    phone,
    pwdHash: hashPwd(pwd, salt),
    salt,
    nickname,
    school,
    studentNo,
    contactPhone: phone,
    role: isAdmin ? 'admin' : 'user',
    createdAt: nowTs()
  }
  const r = await db.collection(COLL.users).add(doc)
  return { token: signToken(r.id), user: publicUser({ _id: r.id, ...doc }) }
}

handlers['auth.login'] = async (d) => {
  const phone = str(d.phone)
  const pwd = String(d.password || '')
  const r = await db.collection(COLL.users).where({ phone }).limit(1).get()
  const u = (r.data || [])[0]
  if (!u) fail('手机号或密码不正确')
  if (u.pwdHash !== hashPwd(pwd, u.salt)) fail('手机号或密码不正确')
  return { token: signToken(u._id), user: publicUser(u) }
}

handlers['auth.me'] = async (d, token) => {
  const u = await requireUser(token)
  return { user: publicUser(u) }
}

handlers['user.update'] = async (d, token) => {
  const u = await requireUser(token)
  const patch = {}
  if (d.nickname != null) {
    const n = str(d.nickname)
    if (!n || n.length > 16) fail('昵称请填 1-16 个字')
    patch.nickname = n
  }
  if (d.contactPhone != null) {
    const p = str(d.contactPhone)
    if (!/^1\d{10}$/.test(p)) fail('联系方式请填 11 位手机号')
    patch.contactPhone = p
  }
  if (d.school != null) {
    const s = str(d.school)
    if (!s) fail('请填写学校')
    patch.school = s
  }
  if (d.studentNo != null) {
    const s = str(d.studentNo)
    if (!/^\d{6,12}$/.test(s)) fail('学号应为 6-12 位数字')
    patch.studentNo = s
  }
  if (Object.keys(patch).length) {
    await db.collection(COLL.users).doc(u._id).update(patch)
  }
  return { user: publicUser(await getUserById(u._id)) }
}

// ---------- 面交地址 ----------
handlers['address.list'] = async (d, token) => {
  const u = await requireUser(token)
  const r = await db.collection(COLL.addresses).where({ userId: u._id }).orderBy('isDefault', 'desc').get()
  return {
    items: (r.data || []).map(a => ({
      id: a._id, name: a.name, phone: a.phone, place: a.place, isDefault: a.isDefault ? 1 : 0
    }))
  }
}

handlers['address.save'] = async (d, token) => {
  const u = await requireUser(token)
  const name = str(d.name)
  const phone = str(d.phone)
  const place = str(d.place)
  if (!name) fail('请填写联系人')
  if (!/^1\d{10}$/.test(phone)) fail('联系电话请填 11 位手机号')
  if (!place) fail('请填写面交地点')

  const payload = { userId: u._id, name, phone, place }
  let id = str(d.id)

  if (id) {
    await db.collection(COLL.addresses).doc(id).update(payload)
  } else {
    const cnt = await db.collection(COLL.addresses).where({ userId: u._id }).count()
    payload.isDefault = cnt.total === 0
    payload.createdAt = nowTs()
    const r = await db.collection(COLL.addresses).add(payload)
    id = r.id
  }

  if (d.isDefault) {
    const all = await db.collection(COLL.addresses).where({ userId: u._id }).get()
    for (const a of all.data || []) {
      await db.collection(COLL.addresses).doc(a._id).update({ isDefault: a._id === id })
    }
  }

  const cur = firstOf(await db.collection(COLL.addresses).doc(id).get())
  return { item: cur ? { id: cur._id, name: cur.name, phone: cur.phone, place: cur.place, isDefault: cur.isDefault ? 1 : 0 } : null }
}

handlers['address.remove'] = async (d, token) => {
  const u = await requireUser(token)
  const id = str(d.id)
  if (!id) fail('地址不存在')
  const a = firstOf(await db.collection(COLL.addresses).doc(id).get())
  if (!a || a.userId !== u._id) fail('地址不存在')
  await db.collection(COLL.addresses).doc(id).remove()
  return { ok: true }
}

// ---------- 商品 ----------
// 关键词拆词：按空白切开，忽略大小写与全半角差异（NFKC），最多 5 个词
function splitTerms(kw) {
  return String(kw || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 5)
}

// 参与搜索的文本：标题 + 描述 + 分类
function haystack(p) {
  return (String(p.title || '') + ' ' + String(p.desc || '') + ' ' + String(p.category || ''))
    .normalize('NFKC')
    .toLowerCase()
}

// 每个词都要出现（词之间是「且」），但每个词可以出现在任意字段（字段之间是「或」）
function matchAllTerms(p, terms) {
  const h = haystack(p)
  return terms.every(t => h.includes(t))
}

handlers['product.list'] = async (d) => {
  const _ = db.command
  const base = { status: d.status ? str(d.status) : 'on' }
  if (d.category) base.category = str(d.category)
  if (d.sellerId) base.sellerId = str(d.sellerId)

  const page = Math.max(1, Number(d.page) || 1)
  const size = Math.min(48, Math.max(1, Number(d.pageSize) || 12))
  const sortField = d.sort === 'priceAsc' || d.sort === 'priceDesc' ? 'price' : 'createdAt'
  const sortDir = d.sort === 'priceAsc' ? 'asc' : 'desc'

  const terms = splitTerms(d.keyword)

  // ---- 关键词搜索 ----
  // 数据库这层用「任一词命中任一字段」宽松捞候选（正则),再在内存里要求每个词都出现。
  // 这样「考研 数学」「ipad」「ＩＰＡＤ」这类都能搜到，而不会被精确匹配卡住。
  if (terms.length) {
    const reg = db.RegExp({ regexp: terms.map(escapeReg).join('|'), options: 'i' })
    const where = _.or([
      { ...base, title: reg },
      { ...base, desc: reg },
      { ...base, category: reg }
    ])

    const r = await db.collection(COLL.products).where(where)
      .orderBy(sortField, sortDir).limit(100).get()

    let hits = (r.data || []).map(shapeProduct).filter(p => matchAllTerms(p, terms))
    const total = hits.length
    hits = hits.slice((page - 1) * size, page * size)

    let items = await attachSellers(hits)
    items = await mapProductImages(items)
    return { items, total, hasMore: page * size < total, page }
  }

  // ---- 无关键词：正常分页 ----
  let q = db.collection(COLL.products).where(base).orderBy(sortField, sortDir)
  const [list, cnt] = await Promise.all([
    q.skip((page - 1) * size).limit(size).get(),
    db.collection(COLL.products).where(base).count()
  ])

  let items = (list.data || []).map(shapeProduct)
  items = await attachSellers(items)
  items = await mapProductImages(items)

  return { items, total: cnt.total, hasMore: page * size < cnt.total, page }
}

handlers['product.mine'] = async (d, token) => {
  const u = await requireUser(token)
  const r = await db.collection(COLL.products).where({ sellerId: u._id }).orderBy('createdAt', 'desc').limit(100).get()
  let items = (r.data || []).map(shapeProduct)
  items = await attachSellers(items)
  items = await mapProductImages(items)
  return { items }
}

handlers['product.detail'] = async (d) => {
  const p = await getProduct(str(d.id))
  await db.collection(COLL.products).doc(p._id).update({ views: db.command.inc(1) }).catch(() => {})
  let items = await attachSellers([shapeProduct(p)])
  items = await mapProductImages(items)
  return { product: { ...items[0], views: (p.views || 0) + 1 } }
}

handlers['product.publish'] = async (d, token) => {
  const u = await requireUser(token)
  const title = str(d.title)
  const desc = str(d.desc)
  const price = Math.round(Number(d.price))
  const category = str(d.category) || '其他'
  const images = Array.isArray(d.images) ? d.images.filter(Boolean).slice(0, 5) : []
  const stock = Math.min(20, Math.max(1, Number(d.stock) || 1))

  if (title.length < 4 || title.length > 40) fail('标题请填 4-40 个字')
  if (desc.length < 5) fail('描述至少写 5 个字，方便别人判断')
  if (!Number.isFinite(price) || price < 1) fail('请输入正确的价格')
  if (price > 10000000) fail('价格超出范围')
  if (!images.length) fail('至少上传 1 张图片')

  const doc = {
    sellerId: u._id, title, desc, price, category, images, stock,
    status: 'pending', rejectReason: '', views: 0, createdAt: nowTs(), updatedAt: nowTs()
  }
  const r = await db.collection(COLL.products).add(doc)
  return { id: r.id, status: 'pending' }
}

handlers['product.off'] = async (d, token) => {
  const u = await requireUser(token)
  const p = await getProduct(str(d.id))
  if (p.sellerId !== u._id) fail('商品不存在')
  if (p.status === 'sold' || p.status === 'reserved') fail('已售出或已预订的商品不能下架')
  await db.collection(COLL.products).doc(p._id).update({ status: 'off', updatedAt: nowTs() })
  return { ok: true }
}

// ---------- 购物车 ----------
handlers['cart.list'] = async (d, token) => {
  const u = await requireUser(token)
  const r = await db.collection(COLL.carts).where({ userId: u._id }).orderBy('createdAt', 'desc').get()
  const rows = r.data || []
  if (!rows.length) return { items: [] }

  const _ = db.command
  const pr = await db.collection(COLL.products).where({ _id: _.in(rows.map(x => x.productId)) }).get()
  let products = (pr.data || []).map(shapeProduct)
  products = await attachSellers(products)
  products = await mapProductImages(products)

  const pmap = {}
  products.forEach(p => { pmap[p.id] = p })
  return {
    items: rows.filter(x => pmap[x.productId]).map(x => ({ id: x._id, qty: x.qty, product: pmap[x.productId] }))
  }
}

handlers['cart.add'] = async (d, token) => {
  const u = await requireUser(token)
  const p = await getProduct(str(d.productId))
  if (p.sellerId === u._id) fail('不能买自己发布的商品')
  if (p.status !== 'on') fail('这件商品暂时不能购买')

  const want = Math.max(1, Math.min(Number(d.qty) || 1, p.stock || 1))
  const exist = (await db.collection(COLL.carts).where({ userId: u._id, productId: p._id }).limit(1).get()).data || []
  if (exist[0]) {
    await db.collection(COLL.carts).doc(exist[0]._id).update({
      qty: Math.min((exist[0].qty || 1) + want, p.stock || 1)
    })
  } else {
    await db.collection(COLL.carts).add({ userId: u._id, productId: p._id, qty: want, createdAt: nowTs() })
  }
  const cnt = await db.collection(COLL.carts).where({ userId: u._id }).count()
  return { count: cnt.total }
}

handlers['cart.update'] = async (d, token) => {
  const u = await requireUser(token)
  const id = str(d.id)
  const c = firstOf(await db.collection(COLL.carts).doc(id).get())
  if (!c || c.userId !== u._id) fail('购物车条目不存在')
  const p = await getProduct(c.productId)
  const qty = Math.max(1, Math.min(Number(d.qty) || 1, p.stock || 1))
  await db.collection(COLL.carts).doc(id).update({ qty })
  return { ok: true }
}

handlers['cart.remove'] = async (d, token) => {
  const u = await requireUser(token)
  const id = str(d.id)
  const c = firstOf(await db.collection(COLL.carts).doc(id).get())
  if (c && c.userId === u._id) await db.collection(COLL.carts).doc(id).remove()
  return { ok: true }
}

handlers['cart.count'] = async (d, token) => {
  const payload = readToken(token)
  if (!payload) return { count: 0 }
  const cnt = await db.collection(COLL.carts).where({ userId: payload.uid }).count()
  return { count: cnt.total }
}

// ---------- 订单 ----------
function decorateOrder(o, buyer, seller, uid) {
  return {
    id: o._id,
    orderNo: o.orderNo,
    items: o.items || [],
    total: o.total,
    status: o.status,
    contact: o.contact,
    note: o.note || '',
    buyerConfirmed: !!o.buyerConfirmed,
    sellerConfirmed: !!o.sellerConfirmed,
    createdAt: o.createdAt,
    doneAt: o.doneAt || 0,
    canceledAt: o.canceledAt || 0,
    buyer: buyer ? { id: buyer._id, nickname: buyer.nickname, contactPhone: buyer.contactPhone } : null,
    seller: seller ? { id: seller._id, nickname: seller.nickname, contactPhone: seller.contactPhone } : null,
    myRole: o.buyerId === uid ? 'buyer' : 'seller'
  }
}

handlers['order.create'] = async (d, token) => {
  const u = await requireUser(token)
  const raw = Array.isArray(d.items) ? d.items : []
  if (!raw.length) fail('请先选择要买的东西')

  const lines = []
  for (const r of raw) {
    const p = await getProduct(str(r.productId))
    if (p.sellerId === u._id) fail('不能买自己发布的商品')
    if (p.status !== 'on') fail('「' + p.title + '」已经不能购买了')
    const qty = Math.max(1, Math.min(Number(r.qty) || 1, p.stock || 1))
    lines.push({ p, qty })
  }

  const sellers = [...new Set(lines.map(l => l.p.sellerId))]
  if (sellers.length > 1) fail('一次只能结算同一个卖家的商品，请分开下单')

  const contact = d.contact || {}
  if (!str(contact.place)) fail('请选择面交地点')
  if (!/^1\d{10}$/.test(str(contact.phone))) fail('请填写正确的联系电话')

  const total = lines.reduce((s, l) => s + l.p.price * l.qty, 0)
  const orderNo = 'CM' + String(nowTs()).slice(-10) + String(Math.floor(Math.random() * 90 + 10))
  const doc = {
    orderNo,
    buyerId: u._id,
    sellerId: sellers[0],
    items: lines.map(l => ({
      productId: l.p._id, title: l.p.title, price: l.p.price, qty: l.qty, image: (l.p.images || [])[0] || ''
    })),
    total,
    status: 'pending',
    contact: { name: str(contact.name) || u.nickname, phone: str(contact.phone), place: str(contact.place) },
    note: str(d.note).slice(0, 200),
    buyerConfirmed: false,
    sellerConfirmed: false,
    createdAt: nowTs(),
    doneAt: 0,
    canceledAt: 0
  }
  const r = await db.collection(COLL.orders).add(doc)

  for (const l of lines) {
    await db.collection(COLL.products).doc(l.p._id).update({ status: 'reserved', updatedAt: nowTs() })
    const cs = await db.collection(COLL.carts).where({ userId: u._id, productId: l.p._id }).get()
    for (const c of cs.data || []) {
      await db.collection(COLL.carts).doc(c._id).remove()
    }
  }
  return { id: r.id, orderNo }
}

handlers['order.list'] = async (d, token) => {
  const u = await requireUser(token)
  const role = d.role === 'sell' ? 'sell' : 'buy'
  const field = role === 'sell' ? 'sellerId' : 'buyerId'
  const r = await db.collection(COLL.orders).where({ [field]: u._id }).orderBy('createdAt', 'desc').limit(100).get()
  const rows = r.data || []

  const _ = db.command
  const uids = [...new Set(rows.flatMap(o => [o.buyerId, o.sellerId]))].filter(Boolean)
  const umap = {}
  if (uids.length) {
    const ur = await db.collection(COLL.users).where({ _id: _.in(uids) }).get()
    ;(ur.data || []).forEach(x => { umap[x._id] = x })
  }
  let items = rows.map(o => decorateOrder(o, umap[o.buyerId], umap[o.sellerId], u._id))
  items = await mapOrderImages(items)
  return { items }
}

handlers['order.detail'] = async (d, token) => {
  const u = await requireUser(token)
  const o = firstOf(await db.collection(COLL.orders).doc(str(d.id)).get())
  if (!o) fail('订单不存在')
  if (o.buyerId !== u._id && o.sellerId !== u._id && u.role !== 'admin') fail('无权查看这个订单')
  const order = decorateOrder(o, await getUserById(o.buyerId), await getUserById(o.sellerId), u._id)
  const [withImages] = await mapOrderImages([order])
  return { order: withImages }
}

handlers['order.confirm'] = async (d, token) => {
  const u = await requireUser(token)
  const id = str(d.id)
  const o = firstOf(await db.collection(COLL.orders).doc(id).get())
  if (!o) fail('订单不存在')
  if (o.status !== 'pending') fail('这个订单已经结束')

  const patch = {}
  if (o.buyerId === u._id) patch.buyerConfirmed = true
  else if (o.sellerId === u._id) patch.sellerConfirmed = true
  else fail('无权操作这个订单')

  const bothDone = (patch.buyerConfirmed || o.buyerConfirmed) && (patch.sellerConfirmed || o.sellerConfirmed)
  if (bothDone) {
    patch.status = 'done'
    patch.doneAt = nowTs()
  }
  await db.collection(COLL.orders).doc(id).update(patch)

  if (bothDone) {
    for (const it of o.items || []) {
      await db.collection(COLL.products).doc(it.productId).update({ status: 'sold', updatedAt: nowTs() }).catch(() => {})
    }
  }

  const fresh = firstOf(await db.collection(COLL.orders).doc(id).get())
  return {
    order: decorateOrder(fresh, await getUserById(fresh.buyerId), await getUserById(fresh.sellerId), u._id)
  }
}

handlers['order.cancel'] = async (d, token) => {
  const u = await requireUser(token)
  const id = str(d.id)
  const o = firstOf(await db.collection(COLL.orders).doc(id).get())
  if (!o) fail('订单不存在')
  if (o.status !== 'pending') fail('这个订单已经结束')
  if (o.buyerId !== u._id && o.sellerId !== u._id) fail('无权操作这个订单')

  await db.collection(COLL.orders).doc(id).update({ status: 'canceled', canceledAt: nowTs() })
  for (const it of o.items || []) {
    let cp = null
    try { cp = firstOf(await db.collection(COLL.products).doc(it.productId).get()) } catch (e) { cp = null }
    if (cp && cp.status === 'reserved') {
      await db.collection(COLL.products).doc(it.productId).update({ status: 'on', updatedAt: nowTs() })
    }
  }

  const fresh = firstOf(await db.collection(COLL.orders).doc(id).get())
  return {
    order: decorateOrder(fresh, await getUserById(fresh.buyerId), await getUserById(fresh.sellerId), u._id)
  }
}

// ---------- 管理员 ----------
handlers['admin.stats'] = async (d, token) => {
  await requireAdmin(token)
  const [pending, onSale, users, orders] = await Promise.all([
    db.collection(COLL.products).where({ status: 'pending' }).count(),
    db.collection(COLL.products).where({ status: 'on' }).count(),
    db.collection(COLL.users).count(),
    db.collection(COLL.orders).count()
  ])
  return { pending: pending.total, onSale: onSale.total, users: users.total, orders: orders.total }
}

handlers['admin.list'] = async (d, token) => {
  await requireAdmin(token)
  const status = str(d.status) || 'pending'
  const r = await db.collection(COLL.products).where({ status }).orderBy('createdAt', 'desc').limit(100).get()
  let items = (r.data || []).map(shapeProduct)
  items = await attachSellers(items)
  items = await mapProductImages(items)
  return { items }
}

handlers['admin.moderate'] = async (d, token) => {
  await requireAdmin(token)
  const p = await getProduct(str(d.id))
  if (d.pass) {
    await db.collection(COLL.products).doc(p._id).update({ status: 'on', rejectReason: '', updatedAt: nowTs() })
  } else {
    const reason = str(d.reason).slice(0, 100) || '内容不符合规范'
    await db.collection(COLL.products).doc(p._id).update({ status: 'rejected', rejectReason: reason, updatedAt: nowTs() })
  }
  return { ok: true }
}

handlers['admin.takedown'] = async (d, token) => {
  await requireAdmin(token)
  const p = await getProduct(str(d.id))
  await db.collection(COLL.products).doc(p._id).update({ status: 'off', updatedAt: nowTs() })
  return { ok: true }
}

// ---------- 图片上传 ----------
handlers['storage.upload'] = async (d, token) => {
  const u = await requireUser(token)
  const base64 = String(d.base64 || '')
  if (!base64) fail('没有收到图片内容')
  if (base64.length > 6 * 1024 * 1024) fail('图片太大了，换一张试试')

  const buf = Buffer.from(base64, 'base64')
  if (buf.length > 3 * 1024 * 1024) fail('图片太大了，换一张试试')

  const ext = /^[a-z0-9]{1,5}$/i.test(String(d.ext || '')) ? String(d.ext).toLowerCase() : 'jpg'
  const cloudPath = 'products/' + u._id + '/' + nowTs() + '-' + crypto.randomBytes(4).toString('hex') + '.' + ext

  const up = await cloud.uploadFile({ cloudPath, fileContent: buf })
  const fileID = up.fileID
  let url = fileID
  try {
    const tmp = await cloud.getTempFileURL({ fileList: [fileID] })
    const f = (tmp.fileList || [])[0]
    if (f && f.tempFileURL) {
      url = f.tempFileURL
      urlCache.set(fileID, { url, at: nowTs() })
    }
  } catch (e) { /* 取不到临时链接就返回 fileID */ }

  return { ref: fileID, url }
}

// ---------- 演示数据（管理员手动触发一次） ----------
handlers['admin.seedDemo'] = async (d, token) => {
  const u = await requireAdmin(token)
  const cnt = await db.collection(COLL.products).count()
  if (cnt.total > 0) fail('已经有商品了，不再重复导入')

  const ph = (emoji, c1, c2, label) => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640">'
      + '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
      + '<stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient></defs>'
      + '<rect width="640" height="640" fill="url(#g)"/>'
      + '<text x="320" y="330" font-size="210" text-anchor="middle">' + emoji + '</text>'
      + '<text x="320" y="530" font-size="30" fill="rgba(255,255,255,.9)" text-anchor="middle">' + label + '</text></svg>'
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  }

  const demo = [
    ['九成新 iPad 第 9 代 64G 深空灰', '去年买的，上课记笔记用。屏幕无划痕，功能一切正常，原装充电器和盒子都在。', 135000, '数码电子', ph('📱', '#3d4b5c', '#5b6f85', 'iPad 第9代')],
    ['考研数学全套资料 张宇+李永乐', '一战上岸，数学 132。笔记很密，重点都画了，整套出，不单卖。', 6800, '图书教材', ph('📚', '#8a6d3b', '#b8935a', '考研资料')],
    ['捷安特 ATX 山地车 26 寸', '骑了一年半，最近换电驴了。刹车链条上月刚保养，锁和车筐一起送。', 48000, '运动户外', ph('🚲', '#2d6a4f', '#40916c', '山地车')],
    ['小米蓝牙耳机 Air2 SE', '充电盒有点花，耳机本体很新，听网课够用。', 4500, '数码电子', ph('🎧', '#4a4e69', '#6c7086', '蓝牙耳机')],
    ['宿舍小台灯 可调光 USB 供电', '毕业清仓，三档亮度，夹床头的。用了半年，灯珠正常。', 2500, '生活用品', ph('💡', '#b5651d', '#d68c45', '小台灯')],
    ['雅思真题 4-18 全套 + 单词书', '书页干净，只有几处铅笔标注，可以擦掉。', 8900, '图书教材', ph('📖', '#1f4e79', '#2e75b6', '雅思真题')]
  ]

  for (const item of demo) {
    await db.collection(COLL.products).add({
      sellerId: u._id,
      title: item[0],
      desc: item[1],
      price: item[2],
      category: item[3],
      images: [item[4]],
      stock: 1,
      status: 'on',
      rejectReason: '',
      views: Math.floor(Math.random() * 50 + 5),
      createdAt: nowTs() - Math.floor(Math.random() * 5) * 86400000,
      updatedAt: nowTs()
    })
  }
  return { ok: true, count: demo.length }
}

// ============ 入口 ============
const CORS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function httpResponse(payload) {
  return { statusCode: 200, isBase64Encoded: false, headers: CORS, body: JSON.stringify(payload) }
}

exports.main = async (event, context) => {
  const isHttp = !!(event && (event.httpMethod || event.requestContext))

  if (isHttp && String(event.httpMethod || '').toUpperCase() === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' }
  }

  let body = event || {}
  if (isHttp) {
    let raw = event.body || ''
    if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8')
    try {
      body = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {})
    } catch (e) {
      const bad = { ok: false, error: '请求格式错误' }
      return isHttp ? httpResponse(bad) : bad
    }
  }

  const action = body.action
  const data = body.data || {}
  const token = body.token || ''

  try {
    initCloud()
    const fn = handlers[action]
    if (!fn) throw new Error('未知接口：' + action)
    const result = await fn(data, token)
    const payload = { ok: true, data: result }
    return isHttp ? httpResponse(payload) : payload
  } catch (err) {
    console.error('[api]', action, err && err.message)
    const msg = err && err.expose ? err.message : '服务开小差了，请稍后再试'
    const payload = { ok: false, error: msg }
    return isHttp ? httpResponse(payload) : payload
  }
}
