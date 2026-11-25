// ===== 校园集市 · 页面与交互 =====
import {
  call, uploadImage, getUser, setSession, clearSession, patchUser,
  setCartCount, getCartCount, refreshCartCount, onChange
} from './api.js'
import { CATEGORIES, PRODUCT_STATUS, ORDER_STATUS, IS_CLOUD } from './config.js'
import {
  esc, priceHTML, timeAgo, dateTime, avatarHTML, toast, dialog,
  emptyHTML, skeletonGrid, ICON, categoryLabel, money
} from './ui.js'

const view = document.getElementById('view')
const topnav = document.getElementById('topnav')
const tabbar = document.getElementById('tabbar')

const S = { user: getUser() }

// ================= 路由 =================
const ROUTES = [
  { p: '/', fn: Home },
  { p: '/search', fn: Search },
  { p: '/p/:id', fn: Detail },
  { p: '/publish', fn: Publish, auth: true },
  { p: '/cart', fn: Cart, auth: true },
  { p: '/checkout', fn: Checkout, auth: true },
  { p: '/orders', fn: Orders, auth: true },
  { p: '/me', fn: Me, auth: true },
  { p: '/me/edit', fn: MeEdit, auth: true },
  { p: '/me/address', fn: AddressBook, auth: true },
  { p: '/me/products', fn: MyProducts, auth: true },
  { p: '/login', fn: Login },
  { p: '/admin', fn: Admin, auth: true, admin: true }
]

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/'
  const [path, qs] = raw.split('?')
  return { path: path || '/', qs: new URLSearchParams(qs || '') }
}

function matchRoute(path) {
  const segs = path.split('/').filter(Boolean)
  for (const r of ROUTES) {
    const rs = r.p.split('/').filter(Boolean)
    if (rs.length !== segs.length) continue
    const params = {}
    let ok = true
    for (let i = 0; i < rs.length; i++) {
      if (rs[i].startsWith(':')) params[rs[i].slice(1)] = decodeURIComponent(segs[i])
      else if (rs[i] !== segs[i]) { ok = false; break }
    }
    if (ok) return { ...r, params }
  }
  return null
}

function go(path) {
  if (location.hash === '#' + path) render()
  else location.hash = path
}

let renderSeq = 0
async function render() {
  const seq = ++renderSeq
  const { path, qs } = parseHash()
  const hit = matchRoute(path)
  refreshShell()

  if (!hit) {
    document.title = '页面不存在 · 校园集市'
    view.innerHTML = `<div class="container">${emptyHTML('🧭', '这里什么都没有', '地址可能输错了', '<a class="btn btn-primary" href="#/">回首页</a>')}</div>`
    return
  }
  if (hit.auth && !S.user) {
    go('/login?next=' + encodeURIComponent(path + (qs.toString() ? '?' + qs : '')))
    return
  }
  if (hit.admin && S.user && S.user.role !== 'admin') {
    view.innerHTML = `<div class="container">${emptyHTML('🔒', '没有权限', '这个页面只对管理员开放', '<a class="btn btn-primary" href="#/">回首页</a>')}</div>`
    return
  }

  const root = document.createElement('div')
  root.className = 'container'
  view.replaceChildren(root)
  window.scrollTo(0, 0)

  try {
    await hit.fn(root, hit.params, qs)
  } catch (err) {
    if (seq !== renderSeq) return
    root.innerHTML = emptyHTML('😵', '出了点问题', err.message || '请稍后再试',
      '<button class="btn btn-primary" onclick="location.reload()">重新加载</button>')
  }
}

window.addEventListener('hashchange', render)

// 图片加载失败（比如云存储临时链接过期）时换一张占位图，别让 alt 文字裸露在卡片上
const IMG_PLACEHOLDER = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">' +
  '<rect width="120" height="120" fill="#eef1f4"/>' +
  '<g fill="none" stroke="#c2c9d1" stroke-width="3" stroke-linejoin="round">' +
  '<rect x="34" y="38" width="52" height="44" rx="4"/>' +
  '<circle cx="48" cy="52" r="4"/>' +
  '<path d="M36 74l14-12 10 8 8-6 16 12"/></g></svg>'
)
document.addEventListener('error', e => {
  const img = e.target
  if (!img || img.tagName !== 'IMG' || img.dataset.fallback) return
  img.dataset.fallback = '1'
  img.src = IMG_PLACEHOLDER
}, true)

// ================= 外壳 =================
function refreshShell() {
  const { path, qs } = parseHash()
  const u = S.user
  const cart = getCartCount()

  // 顶栏搜索框跟随当前路由回填（正在输入时不打扰）
  const searchInput = document.getElementById('topSearchInput')
  if (searchInput && document.activeElement !== searchInput) {
    searchInput.value = path === '/search' ? (qs.get('q') || '') : ''
  }

  topnav.innerHTML = `
    <a class="navlink" href="#/">首页</a>
    <a class="navlink" href="#/cart">购物车${cart ? `<span class="badge">${cart}</span>` : ''}</a>
    ${u
      ? `<a class="avatar-chip" href="#/me">${avatarHTML(u.nickname, 'sm')}<span class="nm">${esc(u.nickname)}</span></a>`
      : `<a class="navlink" href="#/login">登录 / 注册</a>`}
  `

  const tabs = [
    { href: '/', label: '首页', icon: ICON.home, match: p => p === '/' || p.startsWith('/search') },
    { href: '/publish', label: '发布', icon: ICON.plus, mid: true },
    { href: '/cart', label: '购物车', icon: ICON.cart, match: p => p === '/cart' || p === '/checkout', badge: cart },
    { href: '/orders', label: '订单', icon: ICON.order, match: p => p === '/orders' },
    { href: '/me', label: '我的', icon: ICON.user, match: p => p.startsWith('/me') }
  ]
  tabbar.innerHTML = tabs.map(t => {
    const on = t.match ? t.match(path) : path === t.href ? true : false
    return `<a href="#${t.href}" class="${on ? 'on' : ''} ${t.mid ? 'mid' : ''}">
      ${t.icon}<span>${t.label}</span>${t.badge ? `<span class="badge">${t.badge}</span>` : ''}
    </a>`
  }).join('')
}

onChange(kind => {
  S.user = getUser()
  if (kind === 'cart') S.cart = getCartCount()
  refreshShell()
})

// ================= 复用组件 =================
function cardHTML(p) {
  const st = PRODUCT_STATUS[p.status] || { label: '', cls: 'tag-gray' }
  const cover = (p.images && p.images[0]) || ''
  return `<a class="card" href="#/p/${encodeURIComponent(p.id)}">
    <div class="card-media">
      ${cover ? `<img src="${esc(cover)}" alt="${esc(p.title)}" loading="lazy">` : `<div style="display:grid;place-items:center;height:100%;color:#b6bdc5;font-size:30px">🖼️</div>`}
      ${p.status !== 'on' ? `<span class="flag">${esc(st.label)}</span>` : ''}
    </div>
    <div class="card-body">
      <h3 class="card-title">${esc(p.title)}</h3>
      ${priceHTML(p.price)}
      <div class="card-foot">
        <div class="card-meta">${avatarHTML((p.seller && p.seller.nickname) || '同', 'sm')}<span class="nm">${esc((p.seller && p.seller.nickname) || '同学')}</span></div>
        <span style="font-size:11.5px;color:var(--ink-3)">${esc(timeAgo(p.createdAt))}</span>
      </div>
    </div>
  </a>`
}

function mountFeed(box, getParams, emptyTpl, onData) {
  const st = { page: 1, items: [], hasMore: true, busy: false }

  async function load(more) {
    if (st.busy) return
    st.busy = true
    if (!more) { st.page = 1; box.innerHTML = skeletonGrid(8) }
    try {
      const r = await call('product.list', Object.assign({}, getParams(), { page: st.page, pageSize: 12 }))
      st.items = more ? st.items.concat(r.items) : r.items
      st.hasMore = r.hasMore
      draw()
      onData && onData(r)
      if (r.items.length) st.page += 1
    } catch (err) {
      box.innerHTML = emptyHTML('😵', '加载失败', err.message, '<button class="btn" onclick="location.reload()">重试</button>')
    } finally {
      st.busy = false
    }
  }

  function draw() {
    if (!st.items.length) { box.innerHTML = emptyTpl(); return }
    box.innerHTML = `<div class="grid">${st.items.map(cardHTML).join('')}</div>` +
      (st.hasMore
        ? `<div style="text-align:center;margin-top:20px"><button class="btn" id="feedMore">加载更多</button></div>`
        : `<p class="muted" style="text-align:center;margin-top:20px;font-size:12.5px">已经到底啦</p>`)
    const btn = box.querySelector('#feedMore')
    if (btn) btn.onclick = () => load(true)
  }

  return { reload: () => load(false), get items() { return st.items } }
}

// ================= 首页 =================
async function Home(root) {
  document.title = '校园集市 · 学生二手交易'
  const state = { cat: '', sort: 'new' }

  root.innerHTML = `
    <section class="hero">
      <h1>校园里的好东西，不该被扔在柜子底</h1>
      <p>${esc((S.user && S.user.school) || '本校')}同学之间的二手集市 · 线上下单，线下当面交给</p>
      <div class="hero-stats">
        <div><b class="mono" id="statOn">–</b><span>件在售</span></div>
        <div><b class="mono" id="statNew">–</b><span>今日上新</span></div>
        <div><b class="mono">0</b><span>元手续费</span></div>
      </div>
    </section>

    <div class="chips" id="catChips">
      <button class="chip on" data-cat="">全部</button>
      ${CATEGORIES.map(c => `<button class="chip" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
    </div>

    <div class="section-head">
      <h2 id="feedTitle">最新发布</h2>
      <select class="select" id="sortSel" style="width:auto;height:34px;padding:0 32px 0 12px;font-size:13px">
        <option value="new">最新发布</option>
        <option value="priceAsc">价格从低到高</option>
        <option value="priceDesc">价格从高到低</option>
      </select>
    </div>
    <div id="feed"></div>
  `

  const feedBox = root.querySelector('#feed')
  const feed = mountFeed(feedBox, () => ({ category: state.cat, sort: state.sort }),
    () => emptyHTML('🌱', '这个分类还没有东西', '要不你先发一件？', '<a class="btn btn-primary" href="#/publish">发布闲置</a>'),
    r => {
      const onEl = root.querySelector('#statOn')
      if (onEl && !state.cat && state.sort === 'new') onEl.textContent = r.total
    })

  root.querySelector('#catChips').onclick = e => {
    const btn = e.target.closest('.chip')
    if (!btn) return
    root.querySelectorAll('#catChips .chip').forEach(c => c.classList.toggle('on', c === btn))
    state.cat = btn.dataset.cat || ''
    feed.reload()
  }
  root.querySelector('#sortSel').onchange = e => {
    state.sort = e.target.value
    feed.reload()
  }

  await feed.reload()

  // 今日上新（同一个接口的另一种统计，失败不影响主流程）
  call('product.list', { sort: 'new', page: 1, pageSize: 48 }).then(r => {
    const el = root.querySelector('#statNew')
    if (!el) return
    const dayStart = new Date().setHours(0, 0, 0, 0)
    el.textContent = r.items.filter(p => p.createdAt >= dayStart).length
  }).catch(() => {})

  if (S.user) refreshCartCount()
}

// ================= 搜索 =================
async function Search(root, params, qs) {
  const kw = (qs.get('q') || '').trim()
  document.title = kw ? `${kw} · 搜索 · 校园集市` : '搜索 · 校园集市'
  const state = { sort: 'new' }

  root.innerHTML = `
    <div style="padding:20px 0 6px">
      <h2 style="margin:0 0 4px;font-size:19px">${kw ? `“${esc(kw)}” 的搜索结果` : '全部商品'}</h2>
      <div class="muted" style="font-size:13px" id="searchMeta">正在查找…</div>
    </div>
    <div class="section-head" style="margin-top:14px">
      <span></span>
      <select class="select" id="sortSel" style="width:auto;height:34px;padding:0 32px 0 12px;font-size:13px">
        <option value="new">最新发布</option>
        <option value="priceAsc">价格从低到高</option>
        <option value="priceDesc">价格从高到低</option>
      </select>
    </div>
    <div id="feed"></div>
  `

  const meta = root.querySelector('#searchMeta')
  const feed = mountFeed(root.querySelector('#feed'),
    () => ({ keyword: kw, sort: state.sort }),
    () => emptyHTML('🔍', '没找到相关的东西',
      kw
        ? '可以少输几个字，多个词用空格隔开（例如「考研 数学」）。已预订或已售出的商品不会出现在结果里。'
        : '还没有商品',
      '<a class="btn btn-primary" href="#/">回首页看看</a>'),
    r => { meta.textContent = `共 ${r.total} 件在售商品` })

  root.querySelector('#sortSel').onchange = e => { state.sort = e.target.value; feed.reload() }
  await feed.reload()
}

// ================= 商品详情 =================
async function Detail(root, params) {
  const id = params.id
  let data
  try {
    data = await call('product.detail', { id })
  } catch (err) {
    root.innerHTML = emptyHTML('🫥', '这件商品不见了', err.message, '<a class="btn btn-primary" href="#/">回首页</a>')
    return
  }
  const p = data.product
  const seller = p.seller || {}
  const isMine = S.user && seller.id === S.user.id
  const onSale = p.status === 'on'
  const st = PRODUCT_STATUS[p.status] || { label: '', cls: 'tag-gray' }
  document.title = p.title + ' · 校园集市'

  const imgs = p.images && p.images.length ? p.images : ['']

  root.innerHTML = `
    <div style="padding:14px 0 0">
      <a href="javascript:history.back()" class="btn btn-sm" style="border:0;background:none;padding-left:0;color:var(--ink-3)">‹ 返回</a>
    </div>
    <div class="detail">
      <div>
        <div class="gallery">
          <div class="gallery-main"><img id="mainImg" src="${esc(imgs[0])}" alt="${esc(p.title)}"></div>
          ${imgs.length > 1 ? `<div class="gallery-thumbs">${imgs.map((u, i) =>
            `<img src="${esc(u)}" data-i="${i}" class="${i === 0 ? 'on' : ''}" alt="图${i + 1}">`).join('')}</div>` : ''}
        </div>
        <div class="panel" style="margin-top:16px">
          <h3>卖家描述</h3>
          <div class="detail-desc">${esc(p.desc)}</div>
          <div style="margin-top:18px">
            <div class="kv"><span style="width:70px">分类</span><b>${esc(categoryLabel(p.category))}</b></div>
            <div class="kv"><span style="width:70px">库存</span><b>${esc(p.stock)} 件</b></div>
            <div class="kv"><span style="width:70px">浏览</span><b>${esc(p.views)} 次</b></div>
            <div class="kv"><span style="width:70px">发布</span><b>${esc(dateTime(p.createdAt))}</b></div>
            <div class="kv"><span style="width:70px">商品号</span><b class="mono">${esc(p.id)}</b></div>
          </div>
        </div>
      </div>

      <aside class="detail-side">
        <span class="tag ${st.cls}">${esc(st.label)}</span>
        ${isMine ? '<span class="tag tag-green" style="margin-left:6px">我发布的</span>' : ''}
        <h1>${esc(p.title)}</h1>
        <div style="display:flex;align-items:baseline;gap:10px">
          ${priceHTML(p.price, 'price-lg')}
          ${p.stock > 1 ? `<span class="muted" style="font-size:13px">库存 ${esc(p.stock)} 件</span>` : ''}
        </div>

        <div class="seller-box">
          ${avatarHTML(seller.nickname || '同学')}
          <div style="flex:1;min-width:0">
            <div class="t">${esc(seller.nickname || '同学')}</div>
            <div class="s">${esc(seller.school || '')}${seller.createdAt ? ' · ' + esc(timeAgo(seller.createdAt)) + '加入' : ''}</div>
          </div>
        </div>

        ${S.user
          ? (seller.contactPhone && !isMine
            ? `<div class="kv"><span>联系方式</span><b class="mono">${esc(seller.contactPhone)}</b></div>`
            : '')
          : `<div class="kv"><span>联系方式</span><b><a href="#/login?next=${encodeURIComponent('/p/' + p.id)}" style="color:var(--brand)">登录后可见</a></b></div>`}

        ${p.rejectReason ? `<div class="form-error" style="margin-top:12px">未通过原因：${esc(p.rejectReason)}</div>` : ''}

        <div style="display:flex;gap:10px;margin-top:18px">
          ${onSale && !isMine
            ? (S.user
              ? `<button class="btn btn-ghost" id="addCart" style="flex:1">加入购物车</button>
                 <button class="btn btn-primary" id="buyNow" style="flex:1">立即下单</button>`
              : `<a class="btn btn-primary btn-block" href="#/login?next=${encodeURIComponent('/p/' + p.id)}">登录后购买</a>`)
            : isMine
              ? `<button class="btn btn-block" disabled>这是你自己发布的商品</button>`
              : `<button class="btn btn-block" disabled>${esc(st.label)}，暂时不能购买</button>`}
        </div>
        <p class="muted" style="font-size:12px;margin:12px 0 0;line-height:1.6">
          线下面交：下单后双方约定时间地点，见面验货再付款。平台不经手钱款。
        </p>
      </aside>
    </div>
  `

  const mainImg = root.querySelector('#mainImg')
  root.querySelectorAll('.gallery-thumbs img').forEach(t => {
    t.onclick = () => {
      mainImg.src = t.src
      root.querySelectorAll('.gallery-thumbs img').forEach(x => x.classList.toggle('on', x === t))
    }
  })

  const addCart = root.querySelector('#addCart')
  if (addCart) addCart.onclick = async () => {
    try {
      await call('cart.add', { productId: p.id, qty: 1 })
      toast('已加入购物车', 'ok')
      refreshCartCount()
    } catch (e) { toast(e.message, 'err') }
  }

  const buyNow = root.querySelector('#buyNow')
  if (buyNow) buyNow.onclick = () => {
    sessionStorage.setItem('cm_checkout', JSON.stringify({
      items: [{ productId: p.id, title: p.title, price: p.price, image: imgs[0], qty: 1, sellerId: seller.id, sellerName: seller.nickname }]
    }))
    go('/checkout')
  }
}

// ================= 发布 =================
async function Publish(root) {
  document.title = '发布闲置 · 校园集市'
  const images = []

  root.innerHTML = `
    <div style="padding:20px 0 8px"><h2 style="margin:0;font-size:19px">发布闲置</h2>
      <p class="muted" style="font-size:13px;margin:6px 0 0">照片拍清楚、描述写具体，卖得更快。提交后需要管理员审核才会出现在首页。</p></div>
    <div class="panel" style="max-width:680px">
      <div class="field">
        <label>商品标题</label>
        <input class="input" id="fTitle" maxlength="40" placeholder="例如：九成新 iPad 第 9 代 64G">
        <div class="hint">4-40 个字，把品牌、型号、成色写进去</div>
      </div>
      <div class="row-2">
        <div class="field">
          <label>分类</label>
          <select class="select" id="fCat">${CATEGORIES.map(c => `<option>${esc(c)}</option>`).join('')}</select>
        </div>
        <div class="field">
          <label>售价（元）</label>
          <input class="input" id="fPrice" type="number" min="0.01" step="0.01" placeholder="0.00" inputmode="decimal">
        </div>
      </div>
      <div class="field">
        <label>数量</label>
        <input class="input" id="fStock" type="number" min="1" max="20" value="1" inputmode="numeric" style="max-width:140px">
      </div>
      <div class="field">
        <label>描述</label>
        <textarea class="textarea" id="fDesc" maxlength="500" placeholder="什么时候买的、用了多久、有没有磕碰、配件齐不齐……"></textarea>
        <div class="hint" id="descCount">0 / 500</div>
      </div>
      <div class="field">
        <label>图片（1-5 张）</label>
        <div class="uploader" id="upList"></div>
        <input type="file" id="fileInput" accept="image/*" multiple hidden>
        <div class="hint">第一张会作为封面，建议正面实拍</div>
      </div>
      <div id="formErr"></div>
      <button class="btn btn-primary btn-lg btn-block" id="submitBtn">提交审核</button>
    </div>
  `

  const upList = root.querySelector('#upList')
  const fileInput = root.querySelector('#fileInput')
  const errBox = root.querySelector('#formErr')

  function drawUploader() {
    upList.innerHTML = images.map((im, i) => `<div class="up-cell"><img src="${esc(im.url)}" alt="图${i + 1}"><span class="del" data-del="${i}">✕</span></div>`).join('')
      + (images.length < 5 ? `<div class="up-cell" id="addImg">＋<br>添加图片</div>` : '')
    const add = upList.querySelector('#addImg')
    if (add) add.onclick = () => fileInput.click()
    upList.querySelectorAll('[data-del]').forEach(d => {
      d.onclick = e => { e.stopPropagation(); images.splice(Number(d.dataset.del), 1); drawUploader() }
    })
  }
  drawUploader()

  fileInput.onchange = async () => {
    const files = [...fileInput.files].slice(0, 5 - images.length)
    fileInput.value = ''
    if (!files.length) return
    upList.innerHTML = `<div class="up-cell" style="grid-column:span 2">处理中…</div>`
    for (const f of files) {
      try {
        const r = await uploadImage(f)
        images.push(r)
      } catch (e) { toast(e.message, 'err') }
    }
    drawUploader()
  }

  const desc = root.querySelector('#fDesc')
  desc.oninput = () => { root.querySelector('#descCount').textContent = `${desc.value.length} / 500` }

  root.querySelector('#submitBtn').onclick = async () => {
    errBox.innerHTML = ''
    const title = root.querySelector('#fTitle').value.trim()
    const priceYuan = Number(root.querySelector('#fPrice').value)
    const btn = root.querySelector('#submitBtn')
    btn.disabled = true
    btn.textContent = '提交中…'
    try {
      if (!images.length) throw new Error('至少上传 1 张图片')
      if (!Number.isFinite(priceYuan) || priceYuan <= 0) throw new Error('请输入正确的价格')
      await call('product.publish', {
        title,
        desc: desc.value.trim(),
        price: Math.round(priceYuan * 100),
        category: root.querySelector('#fCat').value,
        stock: Number(root.querySelector('#fStock').value) || 1,
        images: images.map(i => i.ref)
      })
      toast('已提交，等待管理员审核', 'ok')
      go('/me/products')
    } catch (e) {
      errBox.innerHTML = `<div class="form-error">${esc(e.message)}</div>`
    } finally {
      btn.disabled = false
      btn.textContent = '提交审核'
    }
  }
}

// ================= 购物车 =================
async function Cart(root) {
  document.title = '购物车 · 校园集市'
  root.innerHTML = `<div style="padding:22px 0"><h2 style="margin:0;font-size:19px">购物车</h2></div><div id="cartBody">${skeletonGrid(3)}</div>`
  const body = root.querySelector('#cartBody')

  let data
  try {
    data = await call('cart.list')
  } catch (e) {
    body.innerHTML = emptyHTML('😵', '购物车加载失败', e.message)
    return
  }

  const items = data.items.map(i => ({ ...i, checked: i.product.status === 'on' }))
  if (!items.length) {
    body.innerHTML = emptyHTML('🛒', '购物车还是空的', '看到合适的就加进来吧', '<a class="btn btn-primary" href="#/">去逛逛</a>')
    setCartCount(0)
    return
  }

  function checkedItems() { return items.filter(i => i.checked && i.product.status === 'on') }
  function totalFen() { return checkedItems().reduce((s, i) => s + i.product.price * i.qty, 0) }

  function draw() {
    const list = items.length
      ? `<div class="cart-list">${items.map(it => {
        const un = it.product.status !== 'on'
        return `<div class="cart-row" data-id="${esc(it.id)}">
          <div class="checkbox ${it.checked && !un ? 'on' : ''}" data-check="${esc(it.id)}" ${un ? 'style="opacity:.35"' : ''}></div>
          <img class="pic" src="${esc(it.product.images[0] || '')}" alt="">
          <div class="cart-info">
            <h4>${esc(it.product.title)}</h4>
            <div class="muted" style="font-size:12.5px;margin-bottom:4px">${esc(it.product.seller ? it.product.seller.nickname : '')}${un ? ` · ${esc((PRODUCT_STATUS[it.product.status] || {}).label || '不可购买')}` : ''}</div>
            ${priceHTML(it.product.price)}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px">
            <div class="stepper">
              <button data-dec="${esc(it.id)}">−</button><span>${esc(it.qty)}</span><button data-inc="${esc(it.id)}">＋</button>
            </div>
            <button class="btn btn-sm" style="border:0;background:none;color:var(--ink-3)" data-del="${esc(it.id)}">删除</button>
          </div>
        </div>`
      }).join('')}</div>`
      : emptyHTML('🛒', '购物车空了', '', '<a class="btn btn-primary" href="#/">去逛逛</a>')

    const n = checkedItems().length
    body.innerHTML = `<div class="cart-wrap">
      <div>${list}</div>
      <aside class="cart-side">
        <h3 style="margin:0 0 14px;font-size:15px">结算</h3>
        <div class="sum-row"><span>已选商品</span><span class="mono">${n} 件</span></div>
        <div class="sum-row"><span>平台服务费</span><span class="mono">¥0</span></div>
        <div class="sum-row total"><span>合计</span><span class="price price-lg">¥${money(totalFen())}</span></div>
        <button class="btn btn-primary btn-block" id="goCheckout" style="margin-top:16px" ${n ? '' : 'disabled'}>去结算</button>
        <p class="muted" style="font-size:12px;margin:12px 0 0;line-height:1.6">线下当面交易，结算只生成订单，不会扣款。</p>
      </aside>
    </div>`

    body.querySelector('#goCheckout').onclick = () => {
      const picked = checkedItems()
      if (!picked.length) return
      sessionStorage.setItem('cm_checkout', JSON.stringify({
        items: picked.map(i => ({
          productId: i.product.id, title: i.product.title, price: i.product.price,
          image: i.product.images[0] || '', qty: i.qty,
          sellerId: i.product.seller ? i.product.seller.id : '',
          sellerName: i.product.seller ? i.product.seller.nickname : ''
        }))
      }))
      go('/checkout')
    }
  }

  body.onclick = async e => {
    const t = e.target.closest('[data-check],[data-inc],[data-dec],[data-del]')
    if (!t) return
    if (t.dataset.check) {
      const it = items.find(x => x.id === t.dataset.check)
      if (!it || it.product.status !== 'on') return
      it.checked = !it.checked
      draw()
      return
    }
    if (t.dataset.inc || t.dataset.dec) {
      const id = t.dataset.inc || t.dataset.dec
      const it = items.find(x => x.id === id)
      if (!it) return
      const next = Math.max(1, Math.min(it.qty + (t.dataset.inc ? 1 : -1), it.product.stock || 1))
      if (next === it.qty) { if (t.dataset.inc) toast('已经没有更多库存了'); return }
      it.qty = next
      draw()
      try { await call('cart.update', { id, qty: next }) } catch (err) { toast(err.message, 'err') }
      return
    }
    if (t.dataset.del) {
      const id = t.dataset.del
      t.disabled = true
      try {
        await call('cart.remove', { id })
        const i = items.findIndex(x => x.id === id)
        if (i >= 0) items.splice(i, 1)
        draw()
        toast('已从购物车移除')
        refreshCartCount()
        if (!items.length) render()
      } catch (err) { toast(err.message, 'err') }
    }
  }

  draw()
}

// ================= 结算 =================
async function Checkout(root) {
  document.title = '确认订单 · 校园集市'
  let payload = null
  try { payload = JSON.parse(sessionStorage.getItem('cm_checkout') || 'null') } catch (e) { payload = null }
  if (!payload || !payload.items || !payload.items.length) {
    root.innerHTML = emptyHTML('🧾', '还没有选择要买的东西', '', '<a class="btn btn-primary" href="#/cart">回购物车</a>')
    return
  }

  let addrs = []
  try { addrs = (await call('address.list')).items } catch (e) { /* 没地址也能下单，手动填 */ }

  const total = payload.items.reduce((s, i) => s + i.price * i.qty, 0)
  const def = addrs.find(a => a.isDefault) || addrs[0]

  root.innerHTML = `
    <div style="padding:22px 0 8px"><h2 style="margin:0;font-size:19px">确认订单</h2></div>
    <div class="panel">
      <h3>交易商品</h3>
      ${payload.items.map(i => `<div style="display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)">
        <img src="${esc(i.image)}" alt="" style="width:64px;height:64px;border-radius:10px;object-fit:cover;background:#eef1f4">
        <div style="flex:1;min-width:0">
          <div style="font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(i.title)}</div>
          <div class="muted" style="font-size:12.5px">${esc(i.sellerName || '')}</div>
        </div>
        <div style="text-align:right">
          ${priceHTML(i.price)}
          <div class="muted" style="font-size:12.5px">× ${esc(i.qty)}</div>
        </div>
      </div>`).join('')}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px">
        <span class="muted">合计</span>${priceHTML(total, 'price-lg')}
      </div>
    </div>

    <div class="panel">
      <h3>面交信息</h3>
      ${addrs.length ? `<div class="field">
        <label>使用已保存的地点</label>
        <select class="select" id="addrSel">
          ${addrs.map((a, i) => `<option value="${i}" ${a === def ? 'selected' : ''}>${esc(a.place)} — ${esc(a.name)} ${esc(a.phone)}</option>`).join('')}
        </select>
      </div>` : ''}
      <div class="row-2">
        <div class="field"><label>联系人</label><input class="input" id="cName" value="${esc(def ? def.name : (S.user ? S.user.nickname : ''))}" maxlength="20"></div>
        <div class="field"><label>联系电话</label><input class="input" id="cPhone" value="${esc(def ? def.phone : (S.user ? S.user.contactPhone : ''))}" maxlength="11" inputmode="tel"></div>
      </div>
      <div class="field"><label>约定面交地点</label>
        <input class="input" id="cPlace" value="${esc(def ? def.place : '')}" maxlength="60" placeholder="例如：东区 3 号宿舍楼下">
        <div class="hint">写清楚楼栋、门牌或地标，方便对方找到</div>
      </div>
      <div class="field"><label>给卖家留言（选填）</label>
        <textarea class="textarea" id="cNote" maxlength="200" style="min-height:72px" placeholder="例如：工作日晚上六点后都在宿舍"></textarea>
      </div>
      <div id="ckErr"></div>
      <button class="btn btn-primary btn-lg btn-block" id="submitOrder">确认下单</button>
      <p class="muted" style="font-size:12px;margin:12px 0 0;line-height:1.7">
        提交后会生成订单，商品暂时锁定。双方见面交付后，各自在订单页点一次「确认」，订单才算完成。
      </p>
    </div>
  `

  const sel = root.querySelector('#addrSel')
  if (sel) sel.onchange = () => {
    const a = addrs[Number(sel.value)]
    if (!a) return
    root.querySelector('#cName').value = a.name
    root.querySelector('#cPhone').value = a.phone
    root.querySelector('#cPlace').value = a.place
  }

  const btn = root.querySelector('#submitOrder')
  btn.onclick = async () => {
    const errBox = root.querySelector('#ckErr')
    errBox.innerHTML = ''
    btn.disabled = true
    btn.textContent = '提交中…'
    try {
      const contact = {
        name: root.querySelector('#cName').value.trim(),
        phone: root.querySelector('#cPhone').value.trim(),
        place: root.querySelector('#cPlace').value.trim()
      }
      if (!contact.place) throw new Error('请填写面交地点')
      if (!/^1\d{10}$/.test(contact.phone)) throw new Error('请填写 11 位手机号')
      const r = await call('order.create', {
        items: payload.items.map(i => ({ productId: i.productId, qty: i.qty })),
        contact,
        note: root.querySelector('#cNote').value.trim()
      })
      sessionStorage.removeItem('cm_checkout')
      refreshCartCount()
      toast('下单成功，订单号 ' + r.orderNo, 'ok')
      go('/orders')
    } catch (e) {
      errBox.innerHTML = `<div class="form-error">${esc(e.message)}</div>`
      btn.disabled = false
      btn.textContent = '确认下单'
    }
  }
}

// ================= 订单 =================
async function Orders(root, params, qs) {
  document.title = '我的订单 · 校园集市'
  const role = qs.get('role') === 'sell' ? 'sell' : 'buy'

  root.innerHTML = `
    <div style="padding:22px 0 8px"><h2 style="margin:0;font-size:19px">我的订单</h2></div>
    <div class="tabs">
      <button data-role="buy" class="${role === 'buy' ? 'on' : ''}">我买到的</button>
      <button data-role="sell" class="${role === 'sell' ? 'on' : ''}">我卖出的</button>
    </div>
    <div id="orderBody">${skeletonGrid(2)}</div>
  `
  root.querySelectorAll('.tabs button').forEach(b => {
    b.onclick = () => go('/orders?role=' + b.dataset.role)
  })

  const body = root.querySelector('#orderBody')
  let items
  try {
    items = (await call('order.list', { role })).items
  } catch (e) {
    body.innerHTML = emptyHTML('😵', '订单加载失败', e.message)
    return
  }

  if (!items.length) {
    body.innerHTML = role === 'buy'
      ? emptyHTML('📦', '还没有买过东西', '去首页挑一件吧', '<a class="btn btn-primary" href="#/">去逛逛</a>')
      : emptyHTML('📦', '还没有卖出记录', '把闲置发出来试试', '<a class="btn btn-primary" href="#/publish">发布闲置</a>')
    return
  }

  function orderHTML(o) {
    const st = ORDER_STATUS[o.status] || { label: '', cls: 'tag-gray' }
    const it = o.items[0]
    const more = o.items.length > 1 ? ` 等 ${o.items.length} 件` : ''
    const other = role === 'buy' ? o.seller : o.buyer
    const flagText = o.status !== 'pending' ? ''
      : `买家${o.buyerConfirmed ? '已' : '未'}确认 · 卖家${o.sellerConfirmed ? '已' : '未'}确认`

    let acts = ''
    if (o.status === 'pending') {
      const mineDone = role === 'buy' ? o.buyerConfirmed : o.sellerConfirmed
      acts = `
        <button class="btn btn-sm" data-cancel="${esc(o.id)}">取消订单</button>
        <button class="btn btn-sm btn-primary" data-confirm="${esc(o.id)}" ${mineDone ? 'disabled' : ''}>
          ${mineDone ? '已确认，等对方' : (role === 'buy' ? '确认已收到' : '确认已面交')}
        </button>`
    }
    if (o.status === 'done') {
      acts = `<a class="btn btn-sm" href="#/p/${esc(it.productId)}">再看看这件</a>`
    }
    if (o.status === 'canceled') {
      acts = `<a class="btn btn-sm" href="#/">重新挑一件</a>`
    }

    return `<div class="order">
      <div class="order-head">
        <span class="mono">${esc(o.orderNo)} · ${esc(dateTime(o.createdAt))}</span>
        <span class="tag ${st.cls}">${esc(st.label)}</span>
      </div>
      <div class="order-body">
        <img class="pic" src="${esc(it.image || '')}" alt="">
        <div style="flex:1;min-width:0">
          <div style="font-weight:500">${esc(it.title)}${esc(more)}</div>
          <div class="muted" style="font-size:12.5px;margin:4px 0">单价 ¥${money(it.price)} × ${esc(it.qty)}</div>
          <div>共 <b class="price">¥${money(o.total)}</b></div>
          ${o.note ? `<div class="muted" style="font-size:12.5px;margin-top:6px">留言：${esc(o.note)}</div>` : ''}
        </div>
      </div>
      <div class="order-foot">
        <div class="muted" style="font-size:12.5px;line-height:1.7">
          ${role === 'buy' ? '卖家' : '买家'}：${esc(other ? other.nickname : '')} · ${esc(other ? other.contactPhone : '')}<br>
          面交：${esc(o.contact.place)} · ${esc(o.contact.name)} ${esc(o.contact.phone)}
          ${flagText ? `<br><span style="color:#c2410c">${esc(flagText)}</span>` : ''}
          ${o.status === 'done' ? `<br>完成于 ${esc(dateTime(o.doneAt))}` : ''}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${acts}</div>
      </div>
    </div>`
  }

  body.innerHTML = items.map(orderHTML).join('')

  body.onclick = async e => {
    const c = e.target.closest('[data-confirm]')
    const x = e.target.closest('[data-cancel]')
    if (!c && !x) return
    const id = (c || x).dataset.confirm || (c || x).dataset.cancel
    const isConfirm = !!c
    ;(c || x).disabled = true
    try {
      const r = isConfirm
        ? await call('order.confirm', { id })
        : await call('order.cancel', { id })
      if (!isConfirm) toast('订单已取消')
      else if (r.order.status === 'done') toast('订单已完成，交易愉快', 'ok')
      else toast('已确认，等对方也确认后就完成了', 'ok')
      render()
    } catch (err) {
      toast(err.message, 'err')
      ;(c || x).disabled = false
    }
  }
}

// ================= 个人中心 =================
async function Me(root) {
  document.title = '我的 · 校园集市'
  const u = S.user
  root.innerHTML = `<div style="padding:22px 0 4px"><h2 style="margin:0 0 16px;font-size:19px">我的</h2>
    <div class="me-head">
      ${avatarHTML(u.nickname, 'lg')}
      <div style="flex:1;min-width:0">
        <h2>${esc(u.nickname)}</h2>
        <div class="s">${esc(u.school || '')} · 学号 ${esc(u.studentNo || '')}</div>
        <div class="s">联系方式 ${esc(u.contactPhone || u.phone || '')}</div>
      </div>
      ${u.role === 'admin' ? '<span class="tag" style="background:rgba(255,255,255,.22);color:#fff">管理员</span>' : ''}
    </div>
    <div class="me-stats" id="meStats">
      ${['在售', '发布', '买到', '卖出'].map(t => `<div class="me-stat"><b class="mono">–</b><span>${t}</span></div>`).join('')}
    </div>
    <div class="list-card">
      ${row('/me/products', ICON.box, '我的发布', '查看审核状态、下架商品')}
      ${row('/orders', ICON.order, '我的订单', '买到的、卖出的都在这里')}
      ${row('/me/address', ICON.pin, '面交地址与联系方式', '下单时可以直接带出来')}
      ${row('/me/edit', ICON.edit, '编辑个人资料', '昵称、学校、学号、电话')}
      ${u.role === 'admin' ? row('/admin', ICON.shield, '管理员后台', '审核商品、下架违规内容') : ''}
    </div>
    <div class="list-card">
      <div class="list-row" id="logoutRow" style="cursor:pointer">
        <span class="lead" style="background:#fff1ec;color:#d9451f">${ICON.logout}</span>
        <div class="txt"><b style="color:#d9451f">退出登录</b></div>
      </div>
    </div>
    <p class="muted" style="font-size:12px;text-align:center;margin:20px 0 10px">
      ${IS_CLOUD ? '已连接云开发环境' : '当前为本地演示模式，数据只存在这台设备上'}
    </p>`

  root.querySelector('#logoutRow').onclick = async () => {
    const ok = await dialog({ title: '退出登录？', text: '退出后需要重新用手机号和密码登录。', okText: '退出', danger: true })
    if (!ok) return
    clearSession()
    toast('已退出登录')
    go('/login')
  }

  try {
    const [mine, buy, sell] = await Promise.all([
      call('product.mine'),
      call('order.list', { role: 'buy' }),
      call('order.list', { role: 'sell' })
    ])
    const stats = [
      mine.items.filter(p => p.status === 'on').length,
      mine.items.length,
      buy.items.filter(o => o.status === 'done').length,
      sell.items.filter(o => o.status === 'done').length
    ]
    root.querySelectorAll('#meStats .me-stat b').forEach((el, i) => { el.textContent = stats[i] })
  } catch (e) { /* 统计失败不影响页面 */ }

  refreshCartCount()
}

function row(href, icon, title, sub) {
  return `<a class="list-row" href="#${href}">
    <span class="lead">${icon}</span>
    <div class="txt"><b>${esc(title)}</b><small>${esc(sub)}</small></div>
    <span class="chev">›</span>
  </a>`
}

// ================= 编辑资料 =================
async function MeEdit(root) {
  document.title = '编辑资料 · 校园集市'
  const u = S.user
  root.innerHTML = `
    <div style="padding:22px 0 8px"><h2 style="margin:0;font-size:19px">编辑个人资料</h2></div>
    <div class="panel" style="max-width:560px">
      <div class="field"><label>昵称</label><input class="input" id="eNick" maxlength="16" value="${esc(u.nickname)}"></div>
      <div class="field"><label>学校</label><input class="input" id="eSchool" maxlength="30" value="${esc(u.school || '')}"></div>
      <div class="field"><label>学号</label><input class="input" id="eNo" maxlength="12" value="${esc(u.studentNo || '')}" inputmode="numeric">
        <div class="hint">6-12 位数字</div></div>
      <div class="field"><label>联系方式</label><input class="input" id="ePhone" maxlength="11" value="${esc(u.contactPhone || '')}" inputmode="tel">
        <div class="hint">买家会在商品页看到这个号码，请填常用的</div></div>
      <div id="editErr"></div>
      <div style="display:flex;gap:10px">
        <button class="btn" id="cancelBtn">取消</button>
        <button class="btn btn-primary" id="saveBtn" style="flex:1">保存</button>
      </div>
    </div>`

  root.querySelector('#cancelBtn').onclick = () => history.back()
  root.querySelector('#saveBtn').onclick = async e => {
    const btn = e.currentTarget
    const errBox = root.querySelector('#editErr')
    errBox.innerHTML = ''
    btn.disabled = true
    try {
      const r = await call('user.update', {
        nickname: root.querySelector('#eNick').value.trim(),
        school: root.querySelector('#eSchool').value.trim(),
        studentNo: root.querySelector('#eNo').value.trim(),
        contactPhone: root.querySelector('#ePhone').value.trim()
      })
      patchUser(r.user)
      toast('已保存', 'ok')
      go('/me')
    } catch (err) {
      errBox.innerHTML = `<div class="form-error">${esc(err.message)}</div>`
      btn.disabled = false
    }
  }
}

// ================= 面交地址 =================
async function AddressBook(root) {
  document.title = '面交地址 · 校园集市'
  root.innerHTML = `<div style="padding:22px 0 8px;display:flex;align-items:center;justify-content:space-between">
      <h2 style="margin:0;font-size:19px">面交地址</h2>
      <button class="btn btn-sm btn-primary" id="addBtn">新增</button>
    </div><div id="addrBody">${skeletonGrid(2)}</div>`
  const body = root.querySelector('#addrBody')

  async function load() {
    try {
      const items = (await call('address.list')).items
      body.innerHTML = items.length
        ? `<div class="list-card">${items.map(a => `
            <div class="list-row">
              <span class="lead">${ICON.pin}</span>
              <div class="txt">
                <b>${esc(a.place)} ${a.isDefault ? '<span class="tag tag-green" style="margin-left:6px">默认</span>' : ''}</b>
                <small>${esc(a.name)} · ${esc(a.phone)}</small>
              </div>
              <button class="btn btn-sm" data-edit="${esc(a.id)}">编辑</button>
              <button class="btn btn-sm" style="border:0;background:none;color:var(--ink-3)" data-del="${esc(a.id)}">删除</button>
            </div>`).join('')}</div>`
        : emptyHTML('📍', '还没有保存地点', '加一个常用的，下单时少填几步', '<button class="btn btn-primary" id="emptyAdd">新增地点</button>')
      const ea = body.querySelector('#emptyAdd')
      if (ea) ea.onclick = () => openForm()
      body.querySelectorAll('[data-edit]').forEach(b => {
        b.onclick = () => {
          const a = items.find(x => x.id === b.dataset.edit)
          if (a) openForm(a)
        }
      })
      body.querySelectorAll('[data-del]').forEach(b => {
        b.onclick = async () => {
          const ok = await dialog({ title: '删除这个地点？', text: '删除后下单时需要重新填写。', okText: '删除', danger: true })
          if (!ok) return
          try { await call('address.remove', { id: b.dataset.del }); toast('已删除'); load() }
          catch (e) { toast(e.message, 'err') }
        }
      })
    } catch (e) {
      body.innerHTML = emptyHTML('😵', '加载失败', e.message)
    }
  }

  async function openForm(a) {
    const data = await formDialog({
      title: a ? '编辑面交地点' : '新增面交地点',
      fields: [
        { name: 'name', label: '联系人', value: a ? a.name : (S.user.nickname || ''), max: 20 },
        { name: 'phone', label: '联系电话', value: a ? a.phone : (S.user.contactPhone || ''), max: 11 },
        { name: 'place', label: '面交地点', value: a ? a.place : '', max: 60, placeholder: '例如：东区 3 号宿舍楼下' }
      ],
      check: v => {
        if (!/^1\d{10}$/.test(v.phone || '')) return '联系电话请填 11 位手机号'
        if (!v.place || !v.place.trim()) return '请填写面交地点'
        return ''
      }
    })
    if (!data) return
    try {
      await call('address.save', Object.assign({ id: a ? a.id : undefined, isDefault: a ? a.isDefault : undefined }, data))
      toast('已保存', 'ok')
      load()
    } catch (e) { toast(e.message, 'err') }
  }

  root.querySelector('#addBtn').onclick = () => openForm()
  await load()
}

// 通用表单弹窗
function formDialog({ title, fields, check, okText = '保存' }) {
  return new Promise(resolve => {
    const host = document.getElementById('modalHost')
    const mask = document.createElement('div')
    mask.className = 'mask'
    mask.innerHTML = `<div class="dialog">
      <h3>${esc(title)}</h3>
      ${fields.map(f => `<div class="field">
        <label>${esc(f.label)}</label>
        <input class="input" data-f="${esc(f.name)}" maxlength="${f.max || 40}" value="${esc(f.value || '')}" placeholder="${esc(f.placeholder || '')}">
      </div>`).join('')}
      <div id="fdErr"></div>
      <div class="acts" style="margin-top:6px">
        <button class="btn" data-no>取消</button>
        <button class="btn btn-primary" data-yes>${esc(okText)}</button>
      </div>
    </div>`
    host.appendChild(mask)
    const close = v => { mask.remove(); resolve(v) }
    mask.querySelector('[data-no]').onclick = () => close(null)
    mask.querySelector('[data-yes]').onclick = () => {
      const out = {}
      mask.querySelectorAll('[data-f]').forEach(i => { out[i.dataset.f] = i.value.trim() })
      const msg = check ? check(out) : ''
      if (msg) { mask.querySelector('#fdErr').innerHTML = `<div class="form-error">${esc(msg)}</div>`; return }
      close(out)
    }
    mask.onclick = e => { if (e.target === mask) close(null) }
    const first = mask.querySelector('input')
    if (first) setTimeout(() => first.focus(), 60)
  })
}

// ================= 我的发布 =================
async function MyProducts(root) {
  document.title = '我的发布 · 校园集市'
  root.innerHTML = `<div style="padding:22px 0 8px;display:flex;align-items:center;justify-content:space-between">
      <h2 style="margin:0;font-size:19px">我的发布</h2>
      <a class="btn btn-sm btn-primary" href="#/publish">发布闲置</a>
    </div><div id="myBody">${skeletonGrid(2)}</div>`
  const body = root.querySelector('#myBody')

  async function load() {
    try {
      const items = (await call('product.mine')).items
      if (!items.length) {
        body.innerHTML = emptyHTML('📤', '还没有发布过东西', '闲置放出来，比扔掉强', '<a class="btn btn-primary" href="#/publish">发布闲置</a>')
        return
      }
      body.innerHTML = items.map(p => {
        const st = PRODUCT_STATUS[p.status] || { label: '', cls: 'tag-gray' }
        return `<div class="list-row" style="background:#fff;border-radius:14px;margin-bottom:10px;box-shadow:var(--shadow)">
          <img src="${esc(p.images[0] || '')}" alt="" style="width:66px;height:66px;border-radius:10px;object-fit:cover;background:#eef1f4">
          <div class="txt">
            <b>${esc(p.title)}</b>
            <small>${esc(timeAgo(p.createdAt))} · 浏览 ${esc(p.views)} · ${esc(p.stock)} 件</small>
            <div style="margin-top:5px"><span class="tag ${st.cls}">${esc(st.label)}</span>
              ${p.status === 'rejected' && p.rejectReason ? `<span class="muted" style="font-size:12px;margin-left:6px">${esc(p.rejectReason)}</span>` : ''}
            </div>
          </div>
          <div style="text-align:right">
            ${priceHTML(p.price)}
            <div style="display:flex;gap:6px;margin-top:8px;justify-content:flex-end">
              <a class="btn btn-sm" href="#/p/${esc(p.id)}">查看</a>
              ${['on', 'pending'].includes(p.status) ? `<button class="btn btn-sm" style="border:0;color:var(--ink-3)" data-off="${esc(p.id)}">下架</button>` : ''}
            </div>
          </div>
        </div>`
      }).join('')

      body.querySelectorAll('[data-off]').forEach(b => {
        b.onclick = async () => {
          const ok = await dialog({ title: '下架这件商品？', text: '下架后不再出现在首页，可以删掉重新发布。', okText: '下架', danger: true })
          if (!ok) return
          try { await call('product.off', { id: b.dataset.off }); toast('已下架'); load() }
          catch (e) { toast(e.message, 'err') }
        }
      })
    } catch (e) {
      body.innerHTML = emptyHTML('😵', '加载失败', e.message)
    }
  }
  await load()
}

// ================= 登录 / 注册 =================
function Login(root, params, qs) {
  document.title = '登录 · 校园集市'
  const next = qs.get('next') || '/'
  let mode = qs.get('mode') === 'reg' ? 'reg' : 'login'

  root.innerHTML = `
    <div style="max-width:430px;margin:34px auto 0">
      <div style="text-align:center;margin-bottom:22px">
        <div class="brand-mark" style="width:54px;height:54px;border-radius:17px;font-size:26px;margin:0 auto 14px">集</div>
        <h2 style="margin:0 0 6px;font-size:21px">欢迎来到校园集市</h2>
        <p class="muted" style="margin:0;font-size:13.5px">用手机号登录，注册时填写学校与学号</p>
      </div>
      <div class="panel">
        <div class="tabs" style="width:100%;margin-bottom:20px">
          <button data-mode="login" style="flex:1">登录</button>
          <button data-mode="reg" style="flex:1">注册</button>
        </div>
        <div class="field"><label>手机号</label><input class="input" id="lPhone" maxlength="11" inputmode="tel" placeholder="11 位手机号"></div>
        <div class="field"><label>密码</label><input class="input" id="lPwd" type="password" maxlength="32" placeholder="至少 6 位"></div>
        <div id="regFields" style="display:none">
          <div class="field"><label>昵称</label><input class="input" id="lNick" maxlength="16" placeholder="同学们怎么称呼你"></div>
          <div class="row-2">
            <div class="field"><label>学校</label><input class="input" id="lSchool" maxlength="30" placeholder="例如：示例大学"></div>
            <div class="field"><label>学号</label><input class="input" id="lNo" maxlength="12" inputmode="numeric" placeholder="6-12 位数字"></div>
          </div>
          <div class="field">
            <label>管理员注册码（选填）</label>
            <input class="input" id="lAdmin" maxlength="32" placeholder="普通用户留空即可">
            <div class="hint">只有要注册管理员才需要填。这个码由云函数环境变量 ADMIN_CODE 决定，没设置过就是 CAMPUS-ADMIN</div>
          </div>
        </div>
        <div id="loginErr"></div>
        <button class="btn btn-primary btn-lg btn-block" id="doBtn">登录</button>
        <p class="muted" style="font-size:12px;text-align:center;margin:14px 0 0;line-height:1.7">
          注册即表示同意：只发布真实、合法的闲置物品，线下面交时注意人身与财物安全。
        </p>
      </div>
      ${IS_CLOUD ? '' : `<div class="panel" style="background:#fffbeb;border:1px solid #fde68a;margin-top:14px">
        <b style="font-size:13.5px">本地演示账号</b>
        <p class="muted" style="font-size:12.5px;margin:6px 0 0;line-height:1.8">
          买家 13900000001 / 123456<br>
          卖家 13900000002 / 123456<br>
          管理员 13700000000 / 123456
        </p>
      </div>`}
    </div>`

  const regFields = root.querySelector('#regFields')
  const doBtn = root.querySelector('#doBtn')

  function setMode(m) {
    mode = m
    root.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.mode === m))
    regFields.style.display = m === 'reg' ? 'block' : 'none'
    doBtn.textContent = m === 'reg' ? '注册并登录' : '登录'
    root.querySelector('#loginErr').innerHTML = ''
  }
  root.querySelectorAll('.tabs button').forEach(b => { b.onclick = () => setMode(b.dataset.mode) })
  setMode(mode)

  doBtn.onclick = async () => {
    const errBox = root.querySelector('#loginErr')
    errBox.innerHTML = ''
    doBtn.disabled = true
    try {
      const phone = root.querySelector('#lPhone').value.trim()
      const password = root.querySelector('#lPwd').value
      let r
      if (mode === 'reg') {
        r = await call('auth.register', {
          phone, password,
          nickname: root.querySelector('#lNick').value.trim(),
          school: root.querySelector('#lSchool').value.trim(),
          studentNo: root.querySelector('#lNo').value.trim(),
          adminCode: root.querySelector('#lAdmin') ? root.querySelector('#lAdmin').value.trim() : ''
        })
      } else {
        r = await call('auth.login', { phone, password })
      }
      setSession(r.token, r.user)
      S.user = r.user
      refreshCartCount()
      if (mode === 'reg') toast(r.user.role === 'admin' ? '管理员账号已创建' : '注册成功，欢迎加入', 'ok')
      else toast('欢迎回来 ' + r.user.nickname, 'ok')
      go(next)
    } catch (e) {
      errBox.innerHTML = `<div class="form-error">${esc(e.message)}</div>`
      doBtn.disabled = false
    }
  }

  root.querySelector('#lPwd').onkeydown = e => { if (e.key === 'Enter') doBtn.click() }
}

// ================= 管理员 =================
async function Admin(root, params, qs) {
  document.title = '审核后台 · 校园集市'
  let tab = qs.get('tab') || 'pending'
  const TABS = [['pending', '待审核'], ['on', '在售中'], ['rejected', '已驳回'], ['off', '已下架']]

  root.innerHTML = `
    <div style="padding:22px 0 8px"><h2 style="margin:0;font-size:19px">审核后台</h2>
      <p class="muted" style="font-size:13px;margin:6px 0 0">发布的东西默认不进首页，通过审核才会上架。</p></div>
    <div class="admin-stat" id="adminStats">
      ${['待审核', '在售中', '注册用户', '累计订单'].map(t => `<div class="admin-card"><b class="mono">–</b><span>${t}</span></div>`).join('')}
    </div>
    <div class="tabs">${TABS.map(([k, l]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="list-card" id="adminBody">${skeletonGrid(2)}</div>
  `

  root.querySelectorAll('.tabs button').forEach(b => {
    b.onclick = () => go('/admin?tab=' + b.dataset.tab)
  })

  call('admin.stats').then(s => {
    const vals = [s.pending, s.onSale, s.users, s.orders]
    root.querySelectorAll('#adminStats .admin-card b').forEach((el, i) => { el.textContent = vals[i] })
  }).catch(() => {})

  const body = root.querySelector('#adminBody')
  let items
  try {
    items = (await call('admin.list', { status: tab })).items
  } catch (e) {
    body.innerHTML = emptyHTML('😵', '加载失败', e.message)
    return
  }

  if (!items.length) {
    body.innerHTML = emptyHTML('✅', '这个分类下没有商品', tab === 'pending' ? '暂时没有待审核的内容' : '')
    return
  }

  body.innerHTML = items.map(p => `<div class="mod-row">
    <img class="pic" src="${esc(p.images[0] || '')}" alt="">
    <div style="flex:1;min-width:0">
      <div style="font-weight:600">${esc(p.title)}</div>
      <div class="muted" style="font-size:12.5px;margin:3px 0">
        ${esc(p.seller ? p.seller.nickname : '')} · ${esc(p.category)} · ${esc(priceLabel(p.price))} · ${esc(timeAgo(p.createdAt))}
      </div>
      <div class="muted" style="font-size:12.5px;line-height:1.6;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(p.desc)}</div>
      ${p.rejectReason ? `<div class="tag tag-gray" style="margin-top:6px">驳回原因：${esc(p.rejectReason)}</div>` : ''}
    </div>
    <div style="display:flex;flex-direction:column;gap:6px">
      <a class="btn btn-sm" href="#/p/${esc(p.id)}">预览</a>
      ${tab === 'pending' ? `
        <button class="btn btn-sm btn-primary" data-pass="${esc(p.id)}">通过</button>
        <button class="btn btn-sm btn-danger" data-reject="${esc(p.id)}">驳回</button>` : ''}
      ${['on', 'pending'].includes(tab) ? `<button class="btn btn-sm" style="color:#d93a1c" data-take="${esc(p.id)}">下架</button>` : ''}
      ${tab === 'rejected' ? `<button class="btn btn-sm" data-pass="${esc(p.id)}">改判通过</button>` : ''}
      ${tab === 'off' ? `<button class="btn btn-sm" data-pass="${esc(p.id)}">重新上架</button>` : ''}
    </div>
  </div>`).join('')

  body.onclick = async e => {
    const pass = e.target.closest('[data-pass]')
    const rej = e.target.closest('[data-reject]')
    const take = e.target.closest('[data-take]')
    const btn = pass || rej || take
    if (!btn) return
    btn.disabled = true
    try {
      if (pass) {
        await call('admin.moderate', { id: pass.dataset.pass, pass: true })
        toast('已通过，商品已上架', 'ok')
      } else if (rej) {
        const reason = await dialog({
          title: '驳回这件商品', text: '写一句原因，卖家能在「我的发布」里看到。',
          input: { placeholder: '例如：图片与描述不符 / 疑似违禁品' }, okText: '确认驳回', danger: true
        })
        if (reason === null) { btn.disabled = false; return }
        await call('admin.moderate', { id: rej.dataset.reject, pass: false, reason: reason || '内容不符合规范' })
        toast('已驳回')
      } else {
        const ok = await dialog({ title: '下架这件商品？', text: '下架后买家看不到，卖家可以重新提交。', okText: '下架', danger: true })
        if (!ok) { btn.disabled = false; return }
        await call('admin.takedown', { id: take.dataset.take })
        toast('已下架')
      }
      render()
    } catch (err) {
      toast(err.message, 'err')
      btn.disabled = false
    }
  }
}

function priceLabel(fen) { return '¥' + money(fen) }

// ================= 启动 =================
function bindSearch() {
  const form = document.getElementById('topSearch')
  const input = document.getElementById('topSearchInput')
  if (!form || !input) return
  form.addEventListener('submit', e => {
    e.preventDefault()
    const q = input.value.trim()
    input.blur()
    go(q ? '/search?q=' + encodeURIComponent(q) : '/search')
  })
}

;(async function boot() {
  bindSearch()
  refreshShell()
  if (S.user) refreshCartCount()
  await render()
})()
