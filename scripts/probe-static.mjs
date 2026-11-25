// 探测静态托管站点：文件是否在根目录、MIME 是否正确、前端是否指向了云端接口
// 用法：node scripts/probe-static.mjs [站点根地址]
const base = (process.argv[2] || 'https://cloud1-d5genhgf2b9f44de6-1538086108.tcloudbaseapp.com').replace(/\/+$/, '')
const paths = ['/', '/index.html', '/css/app.css', '/js/app.js', '/js/config.js']

console.log('站点：' + base + '\n')

let bad = 0
for (const p of paths) {
  try {
    const r = await fetch(base + p, { signal: AbortSignal.timeout(15000) })
    const ct = r.headers.get('content-type') || ''
    if (r.status !== 200) bad++
    const flag = r.status === 200 ? ' ' : '!'
    console.log(`${flag} ${String(r.status).padEnd(4)} ${p.padEnd(14)} ${ct}`)
  } catch (e) {
    bad++
    console.log(`! ERR  ${p.padEnd(14)} ${e.name}: ${e.message}`)
  }
}

// 入口页与云端地址
try {
  const html = await (await fetch(base + '/index.html', { signal: AbortSignal.timeout(15000) })).text()
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '(无标题)'
  console.log('\n标题：' + title)
  console.log('引用：' + ['css/app.css', 'js/app.js'].filter(f => html.includes(f)).join(' , '))

  const cfg = await (await fetch(base + '/js/config.js', { signal: AbortSignal.timeout(15000) })).text()
  const line = (cfg.split('\n').find(l => l.includes('CLOUD_ENDPOINT')) || '').trim()
  console.log('接口：' + (line || '(未找到 CLOUD_ENDPOINT)'))
  if (/CLOUD_ENDPOINT = ''/.test(cfg)) console.log('      注意：地址为空，站点会跑在本地演示模式')
} catch (e) {
  console.log('\n读取入口页失败：' + e.message)
  bad++
}

console.log('\n' + (bad ? `有 ${bad} 项异常，检查上传路径与索引文档设置` : '全部正常：直接在浏览器打开上面的站点即可'))
process.exit(bad ? 1 : 0)
