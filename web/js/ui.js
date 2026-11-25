// ===== 通用 UI 工具 =====
import { CATEGORIES } from './config.js'

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ESC[c])
}

export function money(fen) {
  const n = Number(fen) || 0
  return n % 100 === 0 ? String(n / 100) : (n / 100).toFixed(2)
}

export function priceHTML(fen, cls = '') {
  const s = money(fen)
  const [i, d] = s.split('.')
  return `<span class="price ${cls}"><span class="cur">¥</span>${i}${d ? `<span class="dec">.${d}</span>` : ''}</span>`
}

export function timeAgo(ts) {
  const diff = Date.now() - Number(ts || 0)
  if (diff < 60e3) return '刚刚'
  if (diff < 3600e3) return Math.floor(diff / 60e3) + '分钟前'
  if (diff < 86400e3) return Math.floor(diff / 3600e3) + '小时前'
  if (diff < 30 * 86400e3) return Math.floor(diff / 86400e3) + '天前'
  const d = new Date(Number(ts))
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export function dateTime(ts) {
  const d = new Date(Number(ts || 0))
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function avatarHTML(name, cls = '') {
  const n = String(name || '同').trim() || '同'
  let hash = 0
  for (let i = 0; i < n.length; i++) hash = (hash * 31 + n.charCodeAt(i)) % 360
  const bg = `linear-gradient(140deg, hsl(${hash} 46% 62%), hsl(${(hash + 26) % 360} 44% 50%))`
  return `<span class="avatar ${cls}" style="background:${bg}">${esc(n.slice(0, 1))}</span>`
}

export function maskPhone(p) {
  const s = String(p || '')
  return s.length >= 7 ? s.slice(0, 3) + '****' + s.slice(-4) : s
}

export function categoryLabel(c) {
  return CATEGORIES.includes(c) ? c : '其他'
}

// ---------- 提示条 ----------
export function toast(msg, type = '') {
  const host = document.getElementById('toastHost')
  const el = document.createElement('div')
  el.className = 'toast ' + type
  el.textContent = msg
  host.appendChild(el)
  setTimeout(() => {
    el.style.transition = 'opacity .25s, transform .25s'
    el.style.opacity = '0'
    el.style.transform = 'translateY(-6px)'
    setTimeout(() => el.remove(), 260)
  }, 2200)
}

// ---------- 弹窗 ----------
export function dialog({ title, text = '', okText = '确定', cancelText = '取消', danger = false, input = null }) {
  return new Promise(resolve => {
    const host = document.getElementById('modalHost')
    const mask = document.createElement('div')
    mask.className = 'mask'
    mask.innerHTML = `
      <div class="dialog" role="dialog" aria-modal="true">
        <h3>${esc(title)}</h3>
        ${text ? `<p>${esc(text)}</p>` : ''}
        ${input ? `<input class="input" id="dlgInput" placeholder="${esc(input.placeholder || '')}" value="${esc(input.value || '')}" style="margin-bottom:18px">` : ''}
        <div class="acts">
          <button class="btn" data-no>${esc(cancelText)}</button>
          <button class="btn ${danger ? 'btn-accent' : 'btn-primary'}" data-yes>${esc(okText)}</button>
        </div>
      </div>`
    host.appendChild(mask)
    const close = val => { mask.remove(); resolve(val) }
    const inp = mask.querySelector('#dlgInput')
    mask.querySelector('[data-no]').onclick = () => close(null)
    mask.querySelector('[data-yes]').onclick = () => close(inp ? inp.value.trim() : true)
    mask.onclick = e => { if (e.target === mask) close(null) }
    if (inp) setTimeout(() => inp.focus(), 60)
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(null) }
    })
  })
}

// ---------- 空状态 ----------
export function emptyHTML(icon, title, desc = '', action = '') {
  return `<div class="empty">
    <div class="ico">${icon}</div>
    <h3>${esc(title)}</h3>
    ${desc ? `<p>${esc(desc)}</p>` : ''}
    ${action}
  </div>`
}

export function skeletonGrid(n = 8) {
  return `<div class="grid">${Array.from({ length: n }, () => `
    <div class="card"><div class="skeleton" style="aspect-ratio:1/1;border-radius:0"></div>
    <div class="card-body"><div class="skeleton" style="height:14px"></div>
    <div class="skeleton" style="height:14px;width:60%"></div></div></div>`).join('')}</div>`
}

export function qs(name, search = location.search) {
  return new URLSearchParams(search).get(name) || ''
}

// ---------- 图标 ----------
export const ICON = {
  home: `<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>`,
  plus: `<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>`,
  cart: `<svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L21 8H6"/><circle cx="10" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/></svg>`,
  order: `<svg viewBox="0 0 24 24"><path d="M8 3h8a2 2 0 0 1 2 2v16l-6-3-6 3V5a2 2 0 0 1 2-2Z"/><path d="M9 8h6M9 12h6"/></svg>`,
  user: `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>`,
  shield: `<svg viewBox="0 0 24 24"><path d="M12 3l7.5 3v6c0 5-3.2 8-7.5 9.5C7.7 20 4.5 17 4.5 12V6L12 3Z"/><path d="m9 12 2 2 4-4"/></svg>`,
  pin: `<svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>`,
  edit: `<svg viewBox="0 0 24 24"><path d="M4 20h4L20 8l-4-4L4 16v4Z"/><path d="m14 6 4 4"/></svg>`,
  logout: `<svg viewBox="0 0 24 24"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 8 6 12l4 4"/><path d="M6 12h9"/></svg>`,
  box: `<svg viewBox="0 0 24 24"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.2 7.6 7.8 4.4 7.8-4.4M12 12v9"/></svg>`,
  search: `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>`,
  back: `<svg viewBox="0 0 24 24"><path d="m14 6-6 6 6 6"/></svg>`,
  check: `<svg viewBox="0 0 24 24"><path d="m5 13 4 4L19 7"/></svg>`,
  chat: `<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12Z"/></svg>`
}
