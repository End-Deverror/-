// ===== 数据访问层 =====
// 对外只暴露 call() / uploadImage()，内部根据配置选择「本地演示」或「云端」实现。
import { CLOUD_ENDPOINT } from './config.js'
import { mockCall, mockUploadImage } from './mock.js'

const TOKEN_KEY = 'cm_token'
const USER_KEY = 'cm_user'

let impl = null
let uploadImpl = null
const listeners = new Set()

const state = {
  token: localStorage.getItem(TOKEN_KEY) || '',
  user: readJSON(USER_KEY),
  cartCount: 0
}

function readJSON(k) {
  try { return JSON.parse(localStorage.getItem(k) || 'null') } catch (e) { return null }
}

// 调试开关：配置了云端地址后，仍然想用本地演示数据时，
// 在浏览器控制台执行 localStorage.setItem('cm_force_local', '1') 再刷新即可；删掉这条则恢复云端。
function forceLocal() {
  try { return localStorage.getItem('cm_force_local') === '1' } catch (e) { return false }
}

async function resolve() {
  if (impl) return impl
  if (CLOUD_ENDPOINT && !forceLocal()) {
    const { createCloudAdapter } = await import('./cloud.js')
    const a = createCloudAdapter(CLOUD_ENDPOINT, () => state.token)
    impl = a.call
    uploadImpl = a.uploadImage
  } else {
    impl = mockCall
    uploadImpl = mockUploadImage
  }
  return impl
}

export async function call(action, data = {}) {
  const fn = await resolve()
  try {
    return await fn(action, data, state.token)
  } catch (err) {
    const msg = String(err && err.message || err)
    if (/登录已过期|请重新登录|未登录/.test(msg)) clearSession()
    throw new Error(msg)
  }
}

export async function uploadImage(file) {
  await resolve()
  return uploadImpl(file)
}

// ---------- 会话 ----------
export function getToken() { return state.token }
export function getUser() { return state.user }
export function getCartCount() { return state.cartCount }

export function setSession(token, user) {
  state.token = token || ''
  state.user = user || null
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  else localStorage.removeItem(USER_KEY)
  emit()
}

export function patchUser(patch) {
  state.user = { ...(state.user || {}), ...patch }
  localStorage.setItem(USER_KEY, JSON.stringify(state.user))
  emit()
}

export function clearSession() {
  setSession('', null)
  state.cartCount = 0
}

export function setCartCount(n) {
  state.cartCount = Number(n) || 0
  emit('cart')
}

export function refreshCartCount() {
  if (!state.token) { setCartCount(0); return }
  call('cart.count').then(r => setCartCount(r.count)).catch(() => {})
}

export function onChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function emit(kind) {
  listeners.forEach(fn => { try { fn(kind) } catch (e) { /* 忽略单个订阅者的异常 */ } })
}
