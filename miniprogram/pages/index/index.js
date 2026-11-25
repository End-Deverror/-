Page({
  data: {
    url: 'http://127.0.0.1:8765'
  },

  copyUrl() {
    wx.setClipboardData({
      data: this.data.url,
      success() {
        wx.showToast({ title: '已复制', icon: 'success' })
      }
    })
  }
})
