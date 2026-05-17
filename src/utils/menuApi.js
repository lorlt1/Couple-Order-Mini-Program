import { isCloudReady } from '../config/cloud'

const PRODUCT_STORAGE_KEY = 'cornMenuProducts'
const ORDER_STORAGE_KEY = 'cornMenuOrders'

async function callCloud(action, payload = {}) {
  if (!isCloudReady()) {
    throw new Error('cloud-not-configured')
  }

  const { result } = await wx.cloud.callFunction({
    name: 'menuApi',
    data: {
      action,
      ...payload
    }
  })

  if (!result || result.ok === false) {
    throw new Error(result?.message || 'cloud-call-failed')
  }

  return result.data
}

export async function listProducts() {
  try {
    const products = await callCloud('listProducts')
    uni.setStorageSync(PRODUCT_STORAGE_KEY, products)
    return products
  } catch (error) {
    return uni.getStorageSync(PRODUCT_STORAGE_KEY) || []
  }
}

export async function addProduct(product) {
  try {
    const saved = await callCloud('addProduct', { product })
    const local = uni.getStorageSync(PRODUCT_STORAGE_KEY) || []
    uni.setStorageSync(PRODUCT_STORAGE_KEY, [saved, ...local.filter(item => item.id !== saved.id)])
    return saved
  } catch (error) {
    if (isCloudReady()) {
      console.error('addProduct cloud failed:', error)
      throw error
    }

    const localProduct = {
      ...product,
      id: product.id || `goods-${Date.now()}`,
      createdAt: Date.now()
    }
    const local = uni.getStorageSync(PRODUCT_STORAGE_KEY) || []
    uni.setStorageSync(PRODUCT_STORAGE_KEY, [localProduct, ...local])
    return localProduct
  }
}

export async function updateProduct(product) {
  try {
    const saved = await callCloud('updateProduct', { product })
    const local = uni.getStorageSync(PRODUCT_STORAGE_KEY) || []
    uni.setStorageSync(
      PRODUCT_STORAGE_KEY,
      local.map(item => item.id === saved.id ? saved : item)
    )
    return saved
  } catch (error) {
    if (isCloudReady()) {
      console.error('updateProduct cloud failed:', error)
      throw error
    }

    const local = uni.getStorageSync(PRODUCT_STORAGE_KEY) || []
    const saved = {
      ...product,
      updatedAt: Date.now()
    }
    uni.setStorageSync(
      PRODUCT_STORAGE_KEY,
      local.map(item => item.id === saved.id ? saved : item)
    )
    return saved
  }
}

export async function deleteProduct(productId) {
  try {
    await callCloud('deleteProduct', { productId })
  } catch (error) {
    if (isCloudReady()) {
      console.error('deleteProduct cloud failed:', error)
      throw error
    }
  }

  const local = uni.getStorageSync(PRODUCT_STORAGE_KEY) || []
  uni.setStorageSync(PRODUCT_STORAGE_KEY, local.filter(item => item.id !== productId))
}

export async function listOrders() {
  try {
    const orders = await callCloud('listOrders')
    uni.setStorageSync(ORDER_STORAGE_KEY, orders)
    return orders
  } catch (error) {
    return uni.getStorageSync(ORDER_STORAGE_KEY) || []
  }
}

export async function addOrder(order) {
  try {
    const saved = await callCloud('addOrder', { order })
    const local = uni.getStorageSync(ORDER_STORAGE_KEY) || []
    uni.setStorageSync(ORDER_STORAGE_KEY, [saved, ...local.filter(item => item.id !== saved.id)])
    return saved
  } catch (error) {
    if (isCloudReady()) {
      console.error('addOrder cloud failed:', error)
      throw error
    }

    const localOrder = {
      ...order,
      id: order.id || `order-${Date.now()}`,
      createdAt: Date.now()
    }
    const local = uni.getStorageSync(ORDER_STORAGE_KEY) || []
    uni.setStorageSync(ORDER_STORAGE_KEY, [localOrder, ...local])
    return localOrder
  }
}

export async function updateOrderStatus(orderId, status) {
  try {
    await callCloud('updateOrderStatus', { orderId, status })
  } catch (error) {
    const local = uni.getStorageSync(ORDER_STORAGE_KEY) || []
    uni.setStorageSync(
      ORDER_STORAGE_KEY,
      local.map(order => order.id === orderId ? { ...order, status } : order)
    )
  }
}
