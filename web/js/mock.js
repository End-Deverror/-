// ===== 本地演示后端 =====
// 与云函数 api 保持完全相同的接口契约，方便随时切换到云端。
// 数据存放在 localStorage，只用于本地演示与流程验证。
import { CATEGORIES } from './config.js'
import { compressImage } from './image.js'

const DB_KEY = 'cm_db_v1'
const TOKEN_PREFIX = 'mock.'

// ---------- 占位图（纯 SVG，不依赖外网） ----------
function ph(emoji, c1, c2, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
    </linearGradient></defs>
    <rect width="640" height="640" fill="url(#g)"/>
    <text x="320" y="330" font-size="210" text-anchor="middle">${emoji}</text>
    <text x="320" y="530" font-size="30" fill="rgba(255,255,255,.9)" text-anchor="middle"
      font-family="PingFang SC,Microsoft YaHei,sans-serif">${label}</text>
  </svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

// ---------- 种子数据 ----------
const DAY = 864e5
const now = Date.now()

function seedUsers() {
  return [
    { id: 'u1', phone: '13900000001', pwd: hash('123456'), nickname: '林小满', school: '示例大学', studentNo: '2023010587', contactPhone: '13900000001', role: 'user', createdAt: now - 90 * DAY },
    { id: 'u2', phone: '13900000002', pwd: hash('123456'), nickname: '陈屿', school: '示例大学', studentNo: '2022040311', contactPhone: '13900000002', role: 'user', createdAt: now - 60 * DAY },
    { id: 'u3', phone: '13900000003', pwd: hash('123456'), nickname: '周晴', school: '示例大学', studentNo: '2021030902', contactPhone: '13900000003', role: 'user', createdAt: now - 30 * DAY },
    { id: 'u0', phone: '13700000000', pwd: hash('123456'), nickname: '管理员', school: '示例大学', studentNo: '0000000000', contactPhone: '13700000000', role: 'admin', createdAt: now - 120 * DAY }
  ]
}

const SEED_PRODUCTS = [
  ['p1', 'u1', '九成新 iPad 第 9 代 64G 深空灰', '去年买的，用来上课记笔记。屏幕无划痕，边框有一点点磨损，功能一切正常。原装充电器和盒子都在。', 135000, '数码电子', [['📱', '#3d4b5c', '#5b6f85', 'iPad 第9代']], 'on', 3],
  ['p2', 'u2', '考研数学全套资料 张宇+李永乐', '一战上岸了，数学 132。全套笔记很密，重点都画了，适合想省时间的人。整套出，不单卖。', 6800, '图书教材', [['📚', '#8a6d3b', '#b8935a', '考研资料']], 'on', 2],
  ['p3', 'u3', '捷安特 ATX 山地车 26 寸', '骑了一年半，最近换电驴了。刹车链条上月刚保养过，锁和车筐一起送。', 48000, '运动户外', [['🚲', '#2d6a4f', '#40916c', '山地车']], 'on', 1],
  ['p4', 'u1', '小米蓝牙耳机 Air2 SE', '充电盒有点花，耳机本体很新。续航大概 4 小时，听网课够用。', 4500, '数码电子', [['🎧', '#4a4e69', '#6c7086', '蓝牙耳机']], 'on', 5],
  ['p5', 'u2', '宿舍小台灯 可调光 USB 供电', '毕业清仓，三档亮度，夹床头的。用了半年，灯珠正常。', 2500, '生活用品', [['💡', '#b5651d', '#d68c45', '小台灯']], 'on', 4],
  ['p6', 'u3', '雅思真题 4-18 全套 + 单词书', '书页干净，只有几处铅笔标注，可以擦掉。单词书是乱序版。', 8900, '图书教材', [['📖', '#1f4e79', '#2e75b6', '雅思真题']], 'on', 6],
  ['p7', 'u1', '优衣库摇粒绒外套 M 码 米白', '买大了一码，只穿过两次。无污渍无起球，吊牌还在兜里。', 7900, '服饰鞋包', [['🧥', '#8d7b68', '#b3a08a', '摇粒绒外套']], 'on', 2],
  ['p8', 'u2', '雅马哈 F310 民谣吉他', '大二买的，现在不怎么弹了。琴颈没变形，送琴包和拨片。', 32000, '乐器文娱', [['🎸', '#7b4b2a', '#a8703f', '民谣吉他']], 'on', 1],
  ['p9', 'u3', '考研英语一真题 + 作文模板', '笔记做得很全，作文模板是我自己整理的，一共 20 篇。', 3200, '图书教材', [['📝', '#5b5f97', '#7d80b5', '英语资料']], 'on', 8],
  ['p10', 'u1', '保温杯 500ml 不锈钢', '内胆干净，没磕碰。就是杯子太多用不过来。', 2800, '生活用品', [['🥤', '#3a7ca5', '#5aa5cc', '保温杯']], 'on', 7],
  ['p11', 'u2', '罗技 M170 无线鼠标', '宿舍备用鼠，用了三个月，接收器在。', 3500, '数码电子', [['🖱️', '#4a5568', '#718096', '无线鼠标']], 'on', 2],
  ['p12', 'u3', '瑜伽垫 加厚 10mm 紫色', '买来练了两次就吃灰了。已擦干净，送绑带。', 3900, '运动户外', [['🧘', '#6a4c93', '#9179b5', '瑜伽垫']], 'on', 1]
]

function seedProducts() {
  return SEED_PRODUCTS.map((p, i) => ({
    id: p[0],
    sellerId: p[1],
    title: p[2],
    desc: p[3],
    price: p[4],
    category: p[5],
    images: p[6].map(([e, c1, c2, l]) => ph(e, c1, c2, l)),
    stock: 1,
    status: p[7],
    rejectReason: '',
    views: Math.floor(Math.random() * 80 + 10),
    createdAt: now - (i * 7 + 1) * 3600e3,
    updatedAt: now - (i * 7 + 1) * 3600e3
  }))
}

function seedAddresses() {
  return [
    { id: 'a1', userId: 'u1', name: '林小满', phone: '13900000001', place: '东区 3 号宿舍楼下快递柜', isDefault: 1 },
    { id: 'a2', userId: 'u2', name: '陈屿', phone: '13900000002', place: '图书馆南门台阶', isDefault: 1 }
  ]
}

// ---------- 存储 ----------
function hash(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return 'h' + h.toString(36)
}

function load() {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) { /* 存储损坏则重建 */ }
  const db = {
    users: seedUsers(),
    products: seedProducts(),
    carts: [],
    orders: [],
    addresses: seedAddresses(),
    seq: 1000
  }
  save(db)
  return db
}

function save(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
  } catch (e) {
    throw new Error('本地存储已满，请删掉几条自己的发布后再试')
  }
}

function nid(db, prefix) {
  db.seq += 1
  return prefix + db.seq.toString(36)
}

// ---------- 鉴权 ----------
function publicUser(u) {
  if (!u) return null
  return {
    id: u.id, phone: u.phone, nickname: u.nickname, school: u.school,
    studentNo: u.studentNo, contactPhone: u.contactPhone, role: u.role, createdAt: u.createdAt
  }
}

function requireUser(db, token) {
  const id = String(token || '').startsWith(TOKEN_PREFIX) ? token.slice(TOKEN_PREFIX.length) : ''
  const u = id && db.users.find(x => x.id === id)
  if (!u) throw new Error('登录已过期，请重新登录')
  return u
}

function requireAdmin(db, token) {
  const u = requireUser(db, token)
  if (u.role !== 'admin') throw new Error('需要管理员权限')
  return u
}

// ---------- 查询辅助 ----------
function withSeller(db, p) {
  const s = db.users.find(u => u.id === p.sellerId)
  return {
    ...p,
    seller: s ? { id: s.id, nickname: s.nickname, school: s.school, contactPhone: s.contactPhone, createdAt: s.createdAt } : null
  }
}

function publicProduct(db, p) { return withSeller(db, p) }

// ---------- 关键词拆词（与云函数保持同一套规则） ----------
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

function haystack(p) {
  return (String(p.title || '') + ' ' + String(p.desc || '') + ' ' + String(p.category || ''))
    .normalize('NFKC')
    .toLowerCase()
}

function matchAllTerms(p, terms) {
  const h = haystack(p)
  return terms.every(t => h.includes(t))
}

// ---------- 接口实现 ----------
const H = {
  // ---- 账号 ----
  'auth.register'(db, d) {
    const phone = String(d.phone || '').trim()
    const pwd = String(d.password || '')
    const nickname = String(d.nickname || '').trim()
    const school = String(d.school || '').trim()
    const studentNo = String(d.studentNo || '').trim()
    if (!/^1\d{10}$/.test(phone)) throw new Error('请输入 11 位手机号')
    if (pwd.length < 6) throw new Error('密码至少 6 位')
    if (!nickname || nickname.length > 16) throw new Error('昵称请填 1-16 个字')
    if (!school) throw new Error('请填写学校')
    if (!/^\d{6,12}$/.test(studentNo)) throw new Error('学号应为 6-12 位数字')
    if (db.users.some(u => u.phone === phone)) throw new Error('这个手机号已经注册过了')

    const u = {
      id: nid(db, 'u'), phone, pwd: hash(pwd), nickname, school, studentNo,
      contactPhone: phone, role: d.adminCode === 'CAMPUS-ADMIN' ? 'admin' : 'user', createdAt: Date.now()
    }
    db.users.push(u)
    save(db)
    return { token: TOKEN_PREFIX + u.id, user: publicUser(u) }
  },

  'auth.login'(db, d) {
    const phone = String(d.phone || '').trim()
    const pwd = String(d.password || '')
    const u = db.users.find(x => x.phone === phone)
    if (!u || u.pwd !== hash(pwd)) throw new Error('手机号或密码不正确')
    return { token: TOKEN_PREFIX + u.id, user: publicUser(u) }
  },

  'auth.me'(db, d, token) {
    return { user: publicUser(requireUser(db, token)) }
  },

  'user.update'(db, d, token) {
    const u = requireUser(db, token)
    if (d.nickname != null) {
      const n = String(d.nickname).trim()
      if (!n || n.length > 16) throw new Error('昵称请填 1-16 个字')
      u.nickname = n
    }
    if (d.contactPhone != null) {
      const p = String(d.contactPhone).trim()
      if (!/^1\d{10}$/.test(p)) throw new Error('联系方式请填 11 位手机号')
      u.contactPhone = p
    }
    if (d.school != null) { if (!String(d.school).trim()) throw new Error('请填写学校'); u.school = String(d.school).trim() }
    if (d.studentNo != null) {
      const s = String(d.studentNo).trim()
      if (!/^\d{6,12}$/.test(s)) throw new Error('学号应为 6-12 位数字')
      u.studentNo = s
    }
    save(db)
    return { user: publicUser(u) }
  },

  // ---- 面交地址 ----
  'address.list'(db, d, token) {
    const u = requireUser(db, token)
    return { items: db.addresses.filter(a => a.userId === u.id).sort((a, b) => b.isDefault - a.isDefault) }
  },

  'address.save'(db, d, token) {
    const u = requireUser(db, token)
    const name = String(d.name || '').trim()
    const phone = String(d.phone || '').trim()
    const place = String(d.place || '').trim()
    if (!name) throw new Error('请填写联系人')
    if (!/^1\d{10}$/.test(phone)) throw new Error('联系电话请填 11 位手机号')
    if (!place) throw new Error('请填写面交地点')
    let item = d.id ? db.addresses.find(a => a.id === d.id && a.userId === u.id) : null
    if (d.id && !item) throw new Error('地址不存在')
    if (!item) {
      item = { id: nid(db, 'a'), userId: u.id, isDefault: db.addresses.some(a => a.userId === u.id) ? 0 : 1 }
      db.addresses.push(item)
    }
    item.name = name; item.phone = phone; item.place = place
    if (d.isDefault) {
      db.addresses.forEach(a => { if (a.userId === u.id) a.isDefault = 0 })
      item.isDefault = 1
    }
    save(db)
    return { item }
  },

  'address.remove'(db, d, token) {
    const u = requireUser(db, token)
    const i = db.addresses.findIndex(a => a.id === d.id && a.userId === u.id)
    if (i < 0) throw new Error('地址不存在')
    db.addresses.splice(i, 1)
    save(db)
    return { ok: true }
  },

  // ---- 商品 ----
  'product.list'(db, d) {
    let list = db.products.filter(p => (d.status ? p.status === d.status : p.status === 'on'))
    const terms = splitTerms(d.keyword)
    if (terms.length) list = list.filter(p => matchAllTerms(p, terms))
    if (d.category) list = list.filter(p => p.category === d.category)
    if (d.sellerId) list = list.filter(p => p.sellerId === d.sellerId)
    if (d.sort === 'priceAsc') list.sort((a, b) => a.price - b.price)
    else if (d.sort === 'priceDesc') list.sort((a, b) => b.price - a.price)
    else list.sort((a, b) => b.createdAt - a.createdAt)

    const page = Math.max(1, Number(d.page) || 1)
    const size = Math.min(48, Math.max(1, Number(d.pageSize) || 12))
    const total = list.length
    const items = list.slice((page - 1) * size, page * size).map(p => publicProduct(db, p))
    return { items, total, hasMore: page * size < total, page }
  },

  'product.mine'(db, d, token) {
    const u = requireUser(db, token)
    const list = db.products.filter(p => p.sellerId === u.id).sort((a, b) => b.createdAt - a.createdAt)
    return { items: list.map(p => publicProduct(db, p)) }
  },

  'product.detail'(db, d) {
    const p = db.products.find(x => x.id === d.id)
    if (!p) throw new Error('商品不存在或已被删除')
    p.views = (p.views || 0) + 1
    save(db)
    return { product: publicProduct(db, p) }
  },

  'product.publish'(db, d, token) {
    const u = requireUser(db, token)
    const title = String(d.title || '').trim()
    const desc = String(d.desc || '').trim()
    const price = Math.round(Number(d.price))
    const category = CATEGORIES.includes(d.category) ? d.category : '其他'
    const images = Array.isArray(d.images) ? d.images.filter(Boolean).slice(0, 5) : []
    const stock = Math.min(20, Math.max(1, Number(d.stock) || 1))
    if (title.length < 4 || title.length > 40) throw new Error('标题请填 4-40 个字')
    if (desc.length < 5) throw new Error('描述至少写 5 个字，方便别人判断')
    if (!Number.isFinite(price) || price < 1) throw new Error('请输入正确的价格')
    if (price > 10000000) throw new Error('价格超出范围')
    if (!images.length) throw new Error('至少上传 1 张图片')

    const p = {
      id: nid(db, 'p'), sellerId: u.id, title, desc, price, category, images, stock,
      status: 'pending', rejectReason: '', views: 0, createdAt: Date.now(), updatedAt: Date.now()
    }
    db.products.push(p)
    save(db)
    return { id: p.id, status: p.status }
  },

  'product.off'(db, d, token) {
    const u = requireUser(db, token)
    const p = db.products.find(x => x.id === d.id && x.sellerId === u.id)
    if (!p) throw new Error('商品不存在')
    if (['sold', 'reserved'].includes(p.status)) throw new Error('已售出或已预订的商品不能下架')
    p.status = 'off'; p.updatedAt = Date.now()
    save(db)
    return { ok: true }
  },

  // ---- 购物车 ----
  'cart.list'(db, d, token) {
    const u = requireUser(db, token)
    const items = db.carts.filter(c => c.userId === u.id).map(c => {
      const p = db.products.find(x => x.id === c.productId)
      return p ? { id: c.id, qty: c.qty, product: publicProduct(db, p) } : null
    }).filter(Boolean)
    return { items }
  },

  'cart.add'(db, d, token) {
    const u = requireUser(db, token)
    const p = db.products.find(x => x.id === d.productId)
    if (!p) throw new Error('商品不存在')
    if (p.sellerId === u.id) throw new Error('不能买自己发布的商品')
    if (p.status !== 'on') throw new Error('这件商品暂时不能购买')
    const qty = Math.max(1, Math.min(Number(d.qty) || 1, p.stock))
    const exist = db.carts.find(c => c.userId === u.id && c.productId === p.id)
    if (exist) exist.qty = Math.min(exist.qty + qty, p.stock)
    else db.carts.push({ id: nid(db, 'c'), userId: u.id, productId: p.id, qty, createdAt: Date.now() })
    save(db)
    return { count: db.carts.filter(c => c.userId === u.id).length }
  },

  'cart.update'(db, d, token) {
    const u = requireUser(db, token)
    const c = db.carts.find(x => x.id === d.id && x.userId === u.id)
    if (!c) throw new Error('购物车条目不存在')
    const p = db.products.find(x => x.id === c.productId)
    c.qty = Math.max(1, Math.min(Number(d.qty) || 1, p ? p.stock : 1))
    save(db)
    return { ok: true }
  },

  'cart.remove'(db, d, token) {
    const u = requireUser(db, token)
    const i = db.carts.findIndex(x => x.id === d.id && x.userId === u.id)
    if (i >= 0) db.carts.splice(i, 1)
    save(db)
    return { ok: true }
  },

  'cart.count'(db, d, token) {
    try {
      const u = requireUser(db, token)
      return { count: db.carts.filter(c => c.userId === u.id).length }
    } catch (e) { return { count: 0 } }
  },

  // ---- 订单 ----
  'order.create'(db, d, token) {
    const u = requireUser(db, token)
    const raw = Array.isArray(d.items) ? d.items : []
    if (!raw.length) throw new Error('请先选择要买的东西')

    const lines = []
    for (const r of raw) {
      const p = db.products.find(x => x.id === r.productId)
      if (!p) throw new Error('有商品已不存在，请刷新购物车')
      if (p.sellerId === u.id) throw new Error('不能买自己发布的商品')
      if (p.status !== 'on') throw new Error(`「${p.title}」已经不能购买了`)
      const qty = Math.max(1, Math.min(Number(r.qty) || 1, p.stock))
      lines.push({ p, qty })
    }

    const sellers = [...new Set(lines.map(l => l.p.sellerId))]
    if (sellers.length > 1) throw new Error('一次只能结算同一个卖家的商品，请分开下单')

    const contact = d.contact || {}
    if (!String(contact.place || '').trim()) throw new Error('请选择面交地点')
    if (!/^1\d{10}$/.test(String(contact.phone || '').trim())) throw new Error('请填写正确的联系电话')

    const total = lines.reduce((s, l) => s + l.p.price * l.qty, 0)
    const order = {
      id: nid(db, 'o'),
      orderNo: 'CM' + Date.now().toString().slice(-10) + Math.floor(Math.random() * 90 + 10),
      buyerId: u.id,
      sellerId: sellers[0],
      items: lines.map(l => ({ productId: l.p.id, title: l.p.title, price: l.p.price, qty: l.qty, image: l.p.images[0] || '' })),
      total,
      status: 'pending',
      contact: { name: String(contact.name || u.nickname), phone: String(contact.phone).trim(), place: String(contact.place).trim() },
      note: String(d.note || '').slice(0, 200),
      buyerConfirmed: false,
      sellerConfirmed: false,
      createdAt: Date.now(),
      doneAt: 0,
      canceledAt: 0
    }
    db.orders.push(order)
    lines.forEach(l => {
      l.p.status = 'reserved'
      l.p.updatedAt = Date.now()
      db.carts = db.carts.filter(c => !(c.userId === u.id && c.productId === l.p.id))
    })
    save(db)
    return { id: order.id, orderNo: order.orderNo }
  },

  'order.list'(db, d, token) {
    const u = requireUser(db, token)
    const role = d.role === 'sell' ? 'sell' : 'buy'
    const list = db.orders
      .filter(o => role === 'sell' ? o.sellerId === u.id : o.buyerId === u.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(o => decorateOrder(db, o, u.id))
    return { items: list }
  },

  'order.detail'(db, d, token) {
    const u = requireUser(db, token)
    const o = db.orders.find(x => x.id === d.id)
    if (!o) throw new Error('订单不存在')
    if (o.buyerId !== u.id && o.sellerId !== u.id && u.role !== 'admin') throw new Error('无权查看这个订单')
    return { order: decorateOrder(db, o, u.id) }
  },

  'order.confirm'(db, d, token) {
    const u = requireUser(db, token)
    const o = db.orders.find(x => x.id === d.id)
    if (!o) throw new Error('订单不存在')
    if (o.status !== 'pending') throw new Error('这个订单已经结束')
    if (o.buyerId === u.id) o.buyerConfirmed = true
    else if (o.sellerId === u.id) o.sellerConfirmed = true
    else throw new Error('无权操作这个订单')

    if (o.buyerConfirmed && o.sellerConfirmed) {
      o.status = 'done'
      o.doneAt = Date.now()
      o.items.forEach(it => {
        const p = db.products.find(x => x.id === it.productId)
        if (p) { p.status = 'sold'; p.updatedAt = Date.now() }
      })
    }
    save(db)
    return { order: decorateOrder(db, o, u.id) }
  },

  'order.cancel'(db, d, token) {
    const u = requireUser(db, token)
    const o = db.orders.find(x => x.id === d.id)
    if (!o) throw new Error('订单不存在')
    if (o.status !== 'pending') throw new Error('这个订单已经结束')
    if (o.buyerId !== u.id && o.sellerId !== u.id) throw new Error('无权操作这个订单')
    o.status = 'canceled'
    o.canceledAt = Date.now()
    o.items.forEach(it => {
      const p = db.products.find(x => x.id === it.productId)
      if (p && p.status === 'reserved') { p.status = 'on'; p.updatedAt = Date.now() }
    })
    save(db)
    return { order: decorateOrder(db, o, u.id) }
  },

  // ---- 管理员 ----
  'admin.stats'(db, d, token) {
    requireAdmin(db, token)
    return {
      pending: db.products.filter(p => p.status === 'pending').length,
      onSale: db.products.filter(p => p.status === 'on').length,
      users: db.users.length,
      orders: db.orders.length
    }
  },

  'admin.list'(db, d, token) {
    requireAdmin(db, token)
    const status = d.status || 'pending'
    const list = db.products.filter(p => p.status === status).sort((a, b) => b.createdAt - a.createdAt)
    return { items: list.map(p => publicProduct(db, p)) }
  },

  'admin.moderate'(db, d, token) {
    requireAdmin(db, token)
    const p = db.products.find(x => x.id === d.id)
    if (!p) throw new Error('商品不存在')
    if (d.pass) { p.status = 'on'; p.rejectReason = '' }
    else {
      p.status = 'rejected'
      p.rejectReason = String(d.reason || '内容不符合规范').slice(0, 100)
    }
    p.updatedAt = Date.now()
    save(db)
    return { ok: true }
  },

  'admin.takedown'(db, d, token) {
    requireAdmin(db, token)
    const p = db.products.find(x => x.id === d.id)
    if (!p) throw new Error('商品不存在')
    p.status = 'off'; p.updatedAt = Date.now()
    save(db)
    return { ok: true }
  }
}

function decorateOrder(db, o, uid) {
  const buyer = db.users.find(u => u.id === o.buyerId)
  const seller = db.users.find(u => u.id === o.sellerId)
  return {
    ...o,
    buyer: buyer ? { id: buyer.id, nickname: buyer.nickname, contactPhone: buyer.contactPhone } : null,
    seller: seller ? { id: seller.id, nickname: seller.nickname, contactPhone: seller.contactPhone } : null,
    myRole: o.buyerId === uid ? 'buyer' : 'seller'
  }
}

// ---------- 对外入口 ----------
export async function mockCall(action, data = {}, token = '') {
  const fn = H[action]
  if (!fn) throw new Error('未知接口：' + action)
  const db = load()
  // 模拟网络往返，让 loading 状态可见
  await new Promise(r => setTimeout(r, 60))
  return fn(db, data, token)
}

export async function mockUploadImage(file) {
  const { dataUrl } = await compressImage(file)
  return { ref: dataUrl, url: dataUrl }
}

export function resetMockDB() {
  localStorage.removeItem(DB_KEY)
}
