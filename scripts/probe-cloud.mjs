// 探测云端接口是否已经部署成功（只做只读调用，不写数据）
const url = 'https://cloud1-d5genhgf2b9f44de6-1538086108.ap-shanghai.app.tcloudbase.com/api'

async function probe(action, data = {}, label = action) {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ action, data }),
      signal: AbortSignal.timeout(25000)
    })
    const text = await r.text()
    let body
    try { body = JSON.parse(text) } catch (e) { body = null }
    console.log(`\n[${label}] HTTP ${r.status}  CORS=${r.headers.get('access-control-allow-origin')}`)
    if (!body) {
      console.log('  非 JSON 响应：' + text.slice(0, 300))
      return
    }
    if (body.ok) {
      const d = body.data || {}
      if (Array.isArray(d.items)) console.log(`  ok  items=${d.items.length} total=${d.total}`)
      else console.log('  ok  ' + JSON.stringify(d).slice(0, 200))
    } else {
      console.log('  ok:false  error=' + body.error)
    }
  } catch (e) {
    console.log(`\n[${label}] 请求失败：${e.name}: ${e.message}`)
    if (e.cause) console.log('  cause: ' + e.cause.message)
  }
}

await probe('product.list', { pageSize: 3 })
await probe('admin.stats', {}, 'admin.stats(无令牌，应报需要登录)')
