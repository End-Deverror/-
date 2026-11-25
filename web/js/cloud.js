// ===== 云端适配层 =====
// 通过「云函数 HTTP 访问服务」通信，不依赖任何第三方 CDN，也不需要前端装 SDK。
// 请求用 text/plain 发出，避免浏览器的 CORS 预检（OPTIONS），只需要服务端回一个允许跨域的头。
import { compressImage } from './image.js'

export function createCloudAdapter(endpoint, getToken = () => '') {
  const url = String(endpoint).replace(/\/+$/, '')

  async function post(action, data, token) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 20000)
    let res
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ action, data: data || {}, token: token || '' }),
        signal: ctrl.signal
      })
    } catch (e) {
      throw new Error('连不上服务器，请检查网络，或确认云函数地址是否正确')
    } finally {
      clearTimeout(timer)
    }
    if (!res.ok) throw new Error('服务异常（HTTP ' + res.status + '），请稍后再试')
    let body
    try {
      body = await res.json()
    } catch (e) {
      throw new Error('服务返回的内容无法解析，请检查云函数是否部署成功')
    }
    if (body && body.ok === false) throw new Error(body.error || '操作失败')
    return body && body.data !== undefined ? body.data : body
  }

  async function uploadImage(file) {
    const { dataUrl } = await compressImage(file)
    const base64 = dataUrl.split(',')[1] || ''
    const ext = (file.name && file.name.split('.').pop()) || 'jpg'
    const out = await post('storage.upload', { base64, ext: String(ext).slice(0, 5) }, getToken())
    return { ref: out.ref, url: out.url || out.ref }
  }

  return { call: post, uploadImage }
}
