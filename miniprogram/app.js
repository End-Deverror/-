// 这里是小程序端的空壳，只用来在微信开发者工具里挂载「云开发」面板。
// 真正的页面在 web/ 目录，用浏览器打开 http://127.0.0.1:8765
App({
  onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({ traceUser: true })
    }
  }
})
