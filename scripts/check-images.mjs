// 检查云端商品图片地址是 fileID 还是临时链接，以及临时链接是否已过期
const url = 'https://cloud1-d5genhgf2b9f44de6-1538086108.ap-shanghai.app.tcloudbase.com/api'

const r = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
  body: JSON.stringify({ action: 'product.list', data: { pageSize: 30 } }),
  signal: AbortSignal.timeout(25000)
})
const body = await r.json()
if (!body.ok) {
  console.log('接口失败：' + body.error)
  process.exit(1)
}

const items = body.data.items || []
console.log('在售商品 ' + items.length + ' 件\n')

for (const p of items) {
  const img = (p.images || [])[0] || ''
  let kind = '空'
  if (img.startsWith('cloud://')) kind = '原始 fileID（没换成临时链接）'
  else if (img.startsWith('data:')) kind = 'dataURL'
  else if (img.startsWith('http')) kind = 'HTTP 链接'

  let note = ''
  if (kind === 'HTTP 链接') {
    // 试着取一下这张图，看是否还能访问
    try {
      const ir = await fetch(img, { method: 'GET', signal: AbortSignal.timeout(15000) })
      note = `  取图 HTTP ${ir.status} ${ir.headers.get('content-type') || ''}`
      if (ir.status !== 200) note += '  ← 图片地址失效'
    } catch (e) {
      note = '  取图失败：' + e.name
    }
  }

  console.log(`· ${p.title}`)
  console.log(`  类型：${kind}`)
  console.log(`  地址：${img.slice(0, 110)}${img.length > 110 ? '…' : ''}${note}`)
  // 带签名的 URL 里通常有 sign / q-sign-time 之类的过期参数
  const m = img.match(/[?&](?:q-sign-time|sign|expires?)=([^&]{0,40})/)
  if (m) console.log('  签名参数：' + m[0].slice(0, 60))
  console.log('')
}
