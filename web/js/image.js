// ===== 图片压缩：上传前统一缩到 900px 以内，转 JPEG =====
export function compressImage(file, max = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('请选择图片文件'))
    if (file.size > 8 * 1024 * 1024) return reject(new Error('图片不要超过 8MB'))
    const fr = new FileReader()
    fr.onerror = () => reject(new Error('图片读取失败'))
    fr.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('图片格式不支持'))
      img.onload = () => {
        let { width: w, height: h } = img
        if (w > h && w > max) { h = Math.round(h * max / w); w = max }
        else if (h >= w && h > max) { w = Math.round(w * max / h); h = max }
        const cv = document.createElement('canvas')
        cv.width = w
        cv.height = h
        cv.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve({
          dataUrl: cv.toDataURL('image/jpeg', quality),
          width: w,
          height: h,
          bytes: Math.round(cv.toDataURL('image/jpeg', quality).length * 0.75)
        })
      }
      img.src = fr.result
    }
    fr.readAsDataURL(file)
  })
}
