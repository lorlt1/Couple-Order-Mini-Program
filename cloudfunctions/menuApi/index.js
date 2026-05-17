const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const products = db.collection('products')
const orders = db.collection('orders')

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const action = event.action

  try {
    if (action === 'listProducts') {
      return ok(await listProducts())
    }

    if (action === 'addProduct') {
      return ok(await addProduct(event.product, openid))
    }

    if (action === 'updateProduct') {
      return ok(await updateProduct(event.product, openid))
    }

    if (action === 'deleteProduct') {
      await deleteProduct(event.productId)
      return ok(true)
    }

    if (action === 'listOrders') {
      return ok(await listOrders())
    }

    if (action === 'addOrder') {
      return ok(await addOrder(event.order, openid))
    }

    if (action === 'updateOrderStatus') {
      await updateOrderStatus(event.orderId, event.status)
      return ok(true)
    }

    return fail(`Unknown action: ${action}`)
  } catch (error) {
    return fail(error.message || 'server error')
  }
}

async function listProducts() {
  const result = await products
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get()

  return result.data.map(normalizeDocId)
}

async function addProduct(product = {}, openid) {
  const now = Date.now()
  const data = {
    id: product.id || `goods-${now}`,
    category: Number(product.category || 0),
    icon: String(product.icon || '其'),
    name: String(product.name || '').trim(),
    price: Number(product.price || 0),
    desc: String(product.desc || '暂无描述').trim(),
    createdBy: openid,
    createdAt: now,
    updatedAt: now
  }

  if (!data.name) {
    throw new Error('商品名称不能为空')
  }

  if (!Number.isFinite(data.price) || data.price <= 0) {
    throw new Error('商品价格无效')
  }

  await products.add({ data })
  return data
}

async function updateProduct(product = {}, openid) {
  const id = String(product.id || '').trim()
  const now = Date.now()
  const data = {
    id,
    category: Number(product.category || 0),
    icon: String(product.icon || '其'),
    name: String(product.name || '').trim(),
    price: Number(product.price || 0),
    desc: String(product.desc || '暂无描述').trim(),
    updatedBy: openid,
    updatedAt: now
  }

  if (!data.id) {
    throw new Error('商品不存在')
  }

  if (!data.name) {
    throw new Error('商品名称不能为空')
  }

  if (!Number.isFinite(data.price) || data.price <= 0) {
    throw new Error('商品价格无效')
  }

  const result = await products.where({ id: data.id }).get()
  const doc = result.data[0]

  if (!doc) {
    throw new Error('商品不存在')
  }

  await products.doc(doc._id).update({ data })
  return normalizeDocId({
    ...doc,
    ...data
  })
}

async function deleteProduct(productId) {
  const id = String(productId || '').trim()

  if (!id) {
    throw new Error('商品不存在')
  }

  const result = await products.where({ id }).get()
  const doc = result.data[0]

  if (!doc) {
    return
  }

  await products.doc(doc._id).remove()
}

async function listOrders() {
  const result = await orders
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get()

  return result.data.map(normalizeDocId)
}

async function addOrder(order = {}, openid) {
  const now = Date.now()
  const items = Array.isArray(order.items) ? order.items : []
  const totalPrice = Number(order.totalPrice || 0)
  const totalCount = Number(order.totalCount || 0)

  if (!items.length) {
    throw new Error('订单商品不能为空')
  }

  const data = {
    id: order.id || `order-${now}`,
    items: items.map(item => ({
      id: String(item.id || ''),
      name: String(item.name || ''),
      icon: String(item.icon || '其'),
      price: Number(item.price || 0),
      count: Number(item.count || 0)
    })),
    totalPrice,
    totalCount,
    note: String(order.note || '').trim(),
    status: 'pending',
    createdBy: openid,
    createdAt: now,
    updatedAt: now
  }

  await orders.add({ data })
  return data
}

async function updateOrderStatus(orderId, status) {
  const allowed = ['pending', 'done']
  const nextStatus = allowed.includes(status) ? status : 'pending'
  const result = await orders.where({ id: orderId }).get()
  const doc = result.data[0]

  if (!doc) {
    throw new Error('订单不存在')
  }

  await orders.doc(doc._id).update({
    data: {
      status: nextStatus,
      updatedAt: Date.now()
    }
  })
}

function normalizeDocId(item) {
  const { _id, ...rest } = item
  return rest
}

function ok(data) {
  return {
    ok: true,
    data
  }
}

function fail(message) {
  return {
    ok: false,
    message
  }
}
