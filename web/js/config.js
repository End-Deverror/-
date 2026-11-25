// ===== 运行配置 =====

// —— 云端模式 ——
// 部署好云函数、开启「HTTP 访问服务」之后，把控制台给出的完整地址粘到这里。
// 形如：https://campus-market-8g9x0xyz.service.tcloudbase.com/api
// 留空 = 本地演示模式：数据存在浏览器本地，用来快速看效果、走通全部流程。
export const CLOUD_ENDPOINT = 'https://cloud1-d5genhgf2b9f44de6-1538086108.ap-shanghai.app.tcloudbase.com/api'

export const IS_CLOUD = !!CLOUD_ENDPOINT

// 商品分类
export const CATEGORIES = ['数码电子', '图书教材', '生活用品', '运动户外', '服饰鞋包', '乐器文娱', '其他']

// 商品状态
export const PRODUCT_STATUS = {
  pending: { label: '待审核', cls: 'tag-orange' },
  on: { label: '在售', cls: 'tag-green' },
  reserved: { label: '已预订', cls: 'tag-orange' },
  sold: { label: '已售出', cls: 'tag-gray' },
  off: { label: '已下架', cls: 'tag-gray' },
  rejected: { label: '未通过', cls: 'tag-gray' }
}

// 订单状态
export const ORDER_STATUS = {
  pending: { label: '待面交', cls: 'tag-orange' },
  done: { label: '已完成', cls: 'tag-green' },
  canceled: { label: '已取消', cls: 'tag-gray' }
}
