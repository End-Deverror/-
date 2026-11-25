// 用线上接口测试关键词匹配行为
const url = 'https://cloud1-d5genhgf2b9f44de6-1538086108.ap-shanghai.app.tcloudbase.com/api'

async function search(kw) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ action: 'product.list', data: { keyword: kw, pageSize: 20 } }),
    signal: AbortSignal.timeout(25000)
  })
  const b = await r.json()
  if (!b.ok) return `接口报错：${b.error}`
  const titles = (b.data.items || []).map(p => p.title)
  return `命中 ${b.data.total} 条  ${titles.length ? '→ ' + titles.join(' / ') : ''}`
}

for (const kw of ['九成新牛奶', '牛奶', '牛', '活页', '九成新 牛奶', '牛奶 杯子', 'ＩＰＡＤ', '不存在的东西']) {
  console.log(`关键词「${kw}」  ${await search(kw)}`)
}
