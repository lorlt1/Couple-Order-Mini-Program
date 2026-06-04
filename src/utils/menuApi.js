import { isCloudReady } from '../config/cloud'
import { getSession, isAdmin } from './auth'

const PRODUCT_STORAGE_KEY = 'cornMenuProducts'
const ORDER_STORAGE_KEY = 'cornMenuOrders'

function currentUserId() {
  const session = getSession()
  return session?.userId || session?.account || ''
}

function userKey(baseKey) {
  return `${baseKey}:${currentUserId() || 'guest'}`
}

function ensureUserId() {
  const userId = currentUserId()
  if (!userId) {
    const error = new Error('登录状态已失效，请重新登录')
    error.code = 'invalid-session'
    throw error
  }
  return userId
}

async function callCloud(action, payload = {}) {
  if (!isCloudReady()) {
    throw new Error('cloud-not-configured')
  }

  let result
  try {
    const response = await wx.cloud.callFunction({
      name: 'menuApi',
      data: {
        action,
        ...payload
      }
    })
    result = response.result
  } catch (error) {
    const wrapped = new Error(error?.errMsg || error?.message || 'cloud-function-failed')
    wrapped.code = 'cloud-function-failed'
    throw wrapped
  }

  if (!result || result.ok === false) {
    const error = new Error(result?.message || 'cloud-call-failed')
    error.code = result?.code || result?.message || 'cloud-call-failed'
    throw error
  }

  return result.data
}

export function getErrorMessage(error, fallback = '操作失败') {
  const message = error?.message || ''
  if (error?.code === 'vision-request-failed' && message) {
    return message
  }
  const map = {
    'invalid-image': '图片无效，请重新选择',
    'vision-not-configured': '识图服务未配置 API Key',
    'vision-empty-result': '没有识别到商品信息',
    'vision-invalid-result': '识图结果格式异常',
    'vision-request-failed': '识图服务调用失败',
    'cloud-not-configured': '云环境未配置',
    'cloud-call-failed': '云函数没有返回结果',
    'cloud-function-failed': '云函数调用失败',
    'permission-denied': '权限不足',
    'product-not-found': '商品不存在或已删除',
    'order-not-found': '订单不存在或已删除',
    'invalid-product-id': '商品 ID 无效',
    'invalid-order-id': '订单 ID 无效',
    'invalid-session': '登录状态已失效，请重新登录',
    'notify-template-not-configured': '请先配置订单通知模板 ID',
    'order-finished': '订单已完成，不能取消',
    'network request failed': '网络异常，请稍后重试'
  }
  return map[error?.code] || map[message] || message || fallback
}

export async function getCloudProfile() {
  try {
    return await callCloud('getProfile')
  } catch (error) {
    return {
      openid: '',
      isAdmin: false
    }
  }
}

export async function clearCloudData() {
  return callCloud('clearAllData', { adminCode: 'admin' })
}

export async function clearCloudProducts(userId = '') {
  return callCloud('clearProducts', {
    adminCode: 'admin',
    userId: userId || currentUserId()
  })
}

export async function registerOrderNotifier(templateId) {
  const id = String(templateId || '').trim()
  if (!id || id === 'YOUR_ORDER_NOTIFY_TEMPLATE_ID') {
    const error = new Error('请先配置订单通知模板 ID')
    error.code = 'notify-template-not-configured'
    throw error
  }

  return callCloud('registerOrderNotifier', {
    templateId: id,
    userId: ensureUserId(),
    adminCode: isAdmin() ? 'admin' : ''
  })
}

async function uploadCloudFile(tempFilePath, folder) {
  if (!isCloudReady()) {
    return tempFilePath
  }

  const ext = String(tempFilePath || '').split('.').pop() || 'jpg'
  const cloudPath = `${folder}/${currentUserId()}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const result = await wx.cloud.uploadFile({
    cloudPath,
    filePath: tempFilePath
  })
  return result.fileID
}

export async function uploadProductImage(tempFilePath) {
  return uploadCloudFile(tempFilePath, 'product-images')
}

export async function recognizeProductImage(fileID) {
  if (!isCloudReady()) {
    const error = new Error('cloud-not-configured')
    error.code = 'cloud-not-configured'
    throw error
  }

  return callCloud('recognizeProductImage', {
    fileID,
    userId: ensureUserId()
  })
}

export async function createSmartCover(fileID) {
  if (!isCloudReady()) {
    const error = new Error('cloud-not-configured')
    error.code = 'cloud-not-configured'
    throw error
  }

  return callCloud('createSmartCover', {
    fileID
  })
}

export async function recognizeMenuImages(fileIDs) {
  if (!isCloudReady()) {
    const error = new Error('cloud-not-configured')
    error.code = 'cloud-not-configured'
    throw error
  }

  return callCloud('recognizeMenuImages', {
    fileIDs,
    userId: ensureUserId()
  })
}

export async function listProducts() {
  const userId = ensureUserId()
  try {
    const products = await callCloud('listProducts', { userId })
    uni.setStorageSync(userKey(PRODUCT_STORAGE_KEY), products)
    return products
  } catch (error) {
    console.error('listProducts cloud failed:', error)
    return uni.getStorageSync(userKey(PRODUCT_STORAGE_KEY)) || []
  }
}

export async function addProduct(product) {
  const userId = ensureUserId()
  try {
    const saved = await callCloud('addProduct', {
      product: {
        ...product,
        userId
      }
    })
    const local = uni.getStorageSync(userKey(PRODUCT_STORAGE_KEY)) || []
    uni.setStorageSync(userKey(PRODUCT_STORAGE_KEY), [saved, ...local.filter(item => item.id !== saved.id)])
    return saved
  } catch (error) {
    if (isCloudReady()) {
      console.error('addProduct cloud failed:', error)
      throw error
    }

    const localProduct = {
      ...product,
      id: product.id || `goods-${Date.now()}`,
      userId,
      createdAt: Date.now()
    }
    const local = uni.getStorageSync(userKey(PRODUCT_STORAGE_KEY)) || []
    uni.setStorageSync(userKey(PRODUCT_STORAGE_KEY), [localProduct, ...local])
    return localProduct
  }
}

export async function updateProduct(product) {
  const userId = ensureUserId()
  try {
    const saved = await callCloud('updateProduct', {
      product: {
        ...product,
        userId
      }
    })
    const local = uni.getStorageSync(userKey(PRODUCT_STORAGE_KEY)) || []
    uni.setStorageSync(
      userKey(PRODUCT_STORAGE_KEY),
      local.map(item => item.id === saved.id ? saved : item)
    )
    return saved
  } catch (error) {
    if (isCloudReady()) {
      console.error('updateProduct cloud failed:', error)
      throw error
    }

    const local = uni.getStorageSync(userKey(PRODUCT_STORAGE_KEY)) || []
    const saved = {
      ...product,
      userId,
      updatedAt: Date.now()
    }
    uni.setStorageSync(
      userKey(PRODUCT_STORAGE_KEY),
      local.map(item => item.id === saved.id ? saved : item)
    )
    return saved
  }
}

export async function deleteProduct(productId) {
  const id = String(productId || '').trim()
  const userId = ensureUserId()
  try {
    await callCloud('deleteProduct', {
      productId: id,
      userId
    })
  } catch (error) {
    if (isCloudReady()) {
      console.error('deleteProduct cloud failed:', error)
      throw error
    }
  }

  const local = uni.getStorageSync(userKey(PRODUCT_STORAGE_KEY)) || []
  uni.setStorageSync(userKey(PRODUCT_STORAGE_KEY), local.filter(item => item.id !== productId))
}

export async function listOrders(options = {}) {
  const userId = ensureUserId()
  try {
    const orders = await callCloud('listOrders', {
      userId
    })
    const enrichedOrders = await enrichOrdersWithProductDesc(orders)
    uni.setStorageSync(userKey(ORDER_STORAGE_KEY), enrichedOrders)
    return enrichedOrders
  } catch (error) {
    if (isCloudReady()) {
      uni.setStorageSync(userKey(ORDER_STORAGE_KEY), [])
      throw error
    }
    return enrichOrdersWithProductDesc(uni.getStorageSync(userKey(ORDER_STORAGE_KEY)) || [])
  }
}

async function enrichOrdersWithProductDesc(orders = []) {
  const orderList = Array.isArray(orders) ? orders : []
  if (!orderList.length) return []

  let productList = []
  try {
    productList = await listProducts()
  } catch (error) {
    productList = uni.getStorageSync(userKey(PRODUCT_STORAGE_KEY)) || []
  }

  const productMap = new Map((Array.isArray(productList) ? productList : [])
    .filter(item => item && item.id)
    .map(item => [String(item.id), item]))

  return orderList.map(order => ({
    ...order,
    items: (Array.isArray(order.items) ? order.items : []).map(item => {
      const product = productMap.get(String(item && item.id || ''))
      if (!product) return item
      const desc = String(item.desc || item.note || item.remark || product.desc || '').trim()
      return {
        ...item,
        desc,
        note: String(item.note || desc || '').trim(),
        remark: String(item.remark || desc || '').trim()
      }
    })
  }))
}

export async function addOrder(order) {
  const userId = ensureUserId()
  try {
    const saved = await callCloud('addOrder', {
      order: {
        ...order,
        userId
      }
    })
    const local = uni.getStorageSync(userKey(ORDER_STORAGE_KEY)) || []
    uni.setStorageSync(userKey(ORDER_STORAGE_KEY), [saved, ...local.filter(item => item.id !== saved.id)])
    return saved
  } catch (error) {
    if (isCloudReady()) {
      console.error('addOrder cloud failed:', error)
      throw error
    }

    const localOrder = {
      ...order,
      id: order.id || `order-${Date.now()}`,
      userId,
      createdAt: Date.now()
    }
    const local = uni.getStorageSync(userKey(ORDER_STORAGE_KEY)) || []
    uni.setStorageSync(userKey(ORDER_STORAGE_KEY), [localOrder, ...local])
    return localOrder
  }
}

export async function updateOrderStatus(orderId, status) {
  try {
    await callCloud('updateOrderStatus', {
      orderId,
      status,
      adminCode: isAdmin() ? 'admin' : ''
    })
  } catch (error) {
    if (isCloudReady()) {
      console.error('updateOrderStatus cloud failed:', error)
      throw error
    }

    const local = uni.getStorageSync(userKey(ORDER_STORAGE_KEY)) || []
    uni.setStorageSync(
      userKey(ORDER_STORAGE_KEY),
      local.map(order => order.id === orderId ? { ...order, status } : order)
    )
  }
}

export async function remindOrder(orderId) {
  const userId = ensureUserId()
  try {
    const saved = await callCloud('remindOrder', { orderId, userId })
    const local = uni.getStorageSync(userKey(ORDER_STORAGE_KEY)) || []
    uni.setStorageSync(
      userKey(ORDER_STORAGE_KEY),
      local.map(order => order.id === orderId ? { ...order, ...saved } : order)
    )
    return saved
  } catch (error) {
    if (isCloudReady()) {
      console.error('remindOrder cloud failed:', error)
      throw error
    }

    const local = uni.getStorageSync(userKey(ORDER_STORAGE_KEY)) || []
    const now = Date.now()
    const saved = local.map(order => (
      order.id === orderId
        ? { ...order, remindCount: Number(order.remindCount || 0) + 1, remindedAt: now }
        : order
    ))
    uni.setStorageSync(userKey(ORDER_STORAGE_KEY), saved)
    return saved.find(order => order.id === orderId)
  }
}

export async function cancelOrder(orderId) {
  const userId = ensureUserId()
  try {
    await callCloud('cancelOrder', { orderId, userId })
  } catch (error) {
    if (isCloudReady()) {
      console.error('cancelOrder cloud failed:', error)
      throw error
    }
  }

  const local = uni.getStorageSync(userKey(ORDER_STORAGE_KEY)) || []
  uni.setStorageSync(
    userKey(ORDER_STORAGE_KEY),
    local.map(order => order.id === orderId ? { ...order, status: 'cancelled' } : order)
  )
}

export async function deleteOrder(orderId) {
  const userId = ensureUserId()
  try {
    await callCloud('deleteOrder', {
      orderId,
      userId,
      adminCode: isAdmin() ? 'admin' : ''
    })
  } catch (error) {
    if (isCloudReady()) {
      console.error('deleteOrder cloud failed:', error)
      throw error
    }
  }

  const local = uni.getStorageSync(userKey(ORDER_STORAGE_KEY)) || []
  uni.setStorageSync(userKey(ORDER_STORAGE_KEY), local.filter(order => order.id !== orderId))
}
