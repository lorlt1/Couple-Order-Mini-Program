const cloud = require('wx-server-sdk')
const https = require('https')
const { Jimp, JimpMime } = require('jimp')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const products = db.collection('products')
const orders = db.collection('orders')
const users = db.collection('users')
const admins = db.collection('admins')
const legacyAdmin = db.collection('admin')
const notificationSubscribers = db.collection('notificationSubscribers')
const DEFAULT_ORDER_NOTIFY_TEMPLATE_ID = 'q1YVZttT-GOLGr8-gwZgBt5IhWlCgOceD-dJ4yXg6ag'
const DEFAULT_ORDER_DONE_NOTIFY_TEMPLATE_ID = 'RX7VSZzttyoZdsOfLf26PHoxzdAL5CSYtvQb6dnDNSQ'

exports.main = async (event) => {
  const action = event.action

  try {
    if (action === 'deleteOrdersByItemName') {
      return ok(await deleteOrdersByItemName(event.itemName, event.adminCode, event.userId || event.account))
    }

    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    if (action === 'listProducts') {
      return ok(await listProducts(event.userId || event.account))
    }

    if (action === 'getProfile') {
      return ok(await getProfile(openid))
    }

    if (action === 'recognizeProductImage') {
      return ok(await recognizeProductImage(event.fileID))
    }

    if (action === 'recognizeMenuImages') {
      return ok(await recognizeMenuImages(event.fileIDs))
    }

    if (action === 'createSmartCover') {
      return ok(await createSmartCoverFromFileID(event.fileID))
    }

    if (action === 'testImageEditModel') {
      return ok(await testImageEditModel())
    }

    if (action === 'registerUser') {
      return ok(await registerUser(event.account, event.passwordHash))
    }

    if (action === 'loginUser') {
      return ok(await loginUser(event.account, event.passwordHash))
    }

    if (action === 'clearAllData') {
      await clearAllData(event.adminCode)
      return ok(true)
    }

    if (action === 'clearProducts') {
      await clearProducts(event.adminCode, event.userId || event.account)
      return ok(true)
    }

    if (action === 'registerOrderNotifier') {
      return ok(await registerOrderNotifier(openid, event.userId || event.account, event.templateId, event.adminCode))
    }

    if (action === 'addProduct') {
      return ok(await addProduct(event.product, openid))
    }

    if (action === 'updateProduct') {
      return ok(await updateProduct(event.product, openid))
    }

    if (action === 'deleteProduct') {
      await deleteProduct(event.productId, event.userId || event.account)
      return ok(true)
    }

    if (action === 'listOrders') {
      return ok(await listOrders(event.userId || event.account))
    }

    if (action === 'addOrder') {
      return ok(await addOrder(event.order, openid))
    }

    if (action === 'updateOrderStatus') {
      await updateOrderStatus(event.orderId, event.status, openid, event.adminCode)
      return ok(true)
    }

    if (action === 'remindOrder') {
      return ok(await remindOrder(event.orderId, event.userId || event.account, openid))
    }

    if (action === 'cancelOrder') {
      await cancelOrder(event.orderId, event.userId || event.account, openid)
      return ok(true)
    }

    if (action === 'deleteOrder') {
      await deleteOrder(event.orderId, event.userId || event.account, openid, event.adminCode)
      return ok(true)
    }

    return fail(`Unknown action: ${action}`, 'unknown-action')
  } catch (error) {
    return fail(error.message || 'server error', error.code || 'server-error')
  }
}

async function getProfile(openid) {
  return {
    openid,
    isAdmin: await isAdmin(openid)
  }
}

function normalizeAccount(account) {
  return String(account || '').trim()
}

function publicUser(user) {
  return {
    userId: user.userId,
    account: user.account,
    role: user.role || 'user',
    createdAt: user.createdAt || Date.now()
  }
}

async function registerUser(account, passwordHash) {
  await ensureUsersCollection()
  const accountText = normalizeAccount(account)
  const passwordText = String(passwordHash || '').trim()

  if (accountText.length < 3) {
    throw appError('账号至少 3 个字符', 'invalid-account')
  }

  if (!passwordText) {
    throw appError('密码无效', 'invalid-password')
  }

  const existed = await users.where({ account: accountText }).limit(1).get()
  if (existed.data.length) {
    throw appError('该账号已被注册', 'account-exists')
  }

  const now = Date.now()
  const user = {
    userId: `user-${now}-${Math.random().toString(36).slice(2)}`,
    account: accountText,
    passwordHash: passwordText,
    role: 'user',
    createdAt: now,
    updatedAt: now
  }

  await users.add({ data: user })
  return publicUser(user)
}

async function loginUser(account, passwordHash) {
  await ensureUsersCollection()
  const accountText = normalizeAccount(account)
  const passwordText = String(passwordHash || '').trim()

  const result = await users.where({ account: accountText }).limit(1).get()
  const user = result.data[0]
  if (!user) {
    throw appError('账号不存在', 'account-not-found')
  }

  if (user.passwordHash !== passwordText) {
    throw appError('密码错误', 'wrong-password')
  }

  return publicUser(user)
}

async function ensureUsersCollection() {
  try {
    await db.createCollection('users')
  } catch (error) {
  }
}

async function isAdmin(openid) {
  if (!openid) return false

  const envAdmins = String(process.env.ADMIN_OPENIDS || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)

  if (envAdmins.includes(openid)) {
    return true
  }

  try {
    const result = await admins.where({ openid, enabled: true }).limit(1).get()
    if (result.data.length > 0) return true
  } catch (error) {
  }

  try {
    const result = await legacyAdmin.where({ openid, enabled: true }).limit(1).get()
    return result.data.length > 0
  } catch (error) {
    return false
  }
}

async function hasAdminAccess(openid, adminCode) {
  return adminCode === 'admin' || await isAdmin(openid)
}

function appError(message, code) {
  const error = new Error(message)
  error.code = code
  return error
}

async function clearAllData(adminCode) {
  if (adminCode !== 'admin') {
    throw appError('无权限清空数据', 'permission-denied')
  }

  await clearCollection(products)
  await clearCollection(orders)
}

async function clearProducts(adminCode, userId) {
  if (adminCode !== 'admin') {
    throw appError('无权限清空商品', 'permission-denied')
  }

  const userIdText = String(userId || '').trim()
  if (userIdText) {
    await clearCollection(products.where({ userId: userIdText }), products)
    return
  }

  await clearCollection(products)
}

async function clearCollection(query, rootCollection = query) {
  while (true) {
    const result = await query.limit(100).get()
    if (!result.data.length) return

    await Promise.all(result.data.map(item => rootCollection.doc(item._id).remove()))
    if (result.data.length < 100) return
  }
}

async function listProducts(userId) {
  const userIdText = String(userId || '').trim()
  const query = userIdText
    ? products.where({ userId: userIdText })
    : products.where({ userId: '__none__' })

  const result = await query
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get()

  return result.data.map(normalizeDocId)
}

async function recognizeProductImage(fileID) {
  const fileIDText = String(fileID || '').trim()
  if (!fileIDText) {
    throw appError('invalid image', 'invalid-image')
  }

  const apiKey = String(process.env.VISION_API_KEY || process.env.OPENAI_API_KEY || '').trim()
  if (!apiKey) {
    throw appError('未配置识图 API Key', 'vision-not-configured')
  }

  const tempUrlResult = await cloud.getTempFileURL({
    fileList: [fileIDText]
  })
  const file = tempUrlResult.fileList && tempUrlResult.fileList[0]
  const imageUrl = file && (file.tempFileURL || file.download_url)
  if (!imageUrl) {
    throw appError('image temp url failed', 'invalid-image')
  }
  const imageBuffer = await downloadImageAsBuffer(imageUrl)
  const imageDataUrl = bufferToImageDataUrl(imageBuffer, resolveImageMimeType('', fileIDText))

  const baseUrl = String(process.env.VISION_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = String(process.env.VISION_MODEL || 'gpt-4o-mini').trim()
  const response = await callVisionWithFallback(`${baseUrl}/chat/completions`, {
    Authorization: `Bearer ${apiKey}`
  }, getVisionModels(model), [imageDataUrl])
  const content = response && response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content
  const parsed = parseJsonContent(content)
  const product = normalizeRecognizedProduct(parsed)
  const coverFileID = await createSmartCoverImage(fileIDText, imageBuffer, parsed.crop || parsed.coverCrop || parsed.bbox)
  if (coverFileID) {
    product.imageUrl = coverFileID
  }
  return product
}

async function createSmartCoverFromFileID(fileID) {
  const fileIDText = String(fileID || '').trim()
  if (!fileIDText) {
    throw appError('????', 'invalid-image')
  }

  const tempUrlResult = await cloud.getTempFileURL({
    fileList: [fileIDText]
  })
  const file = tempUrlResult.fileList && tempUrlResult.fileList[0]
  const imageUrl = file && (file.tempFileURL || file.download_url)
  if (!imageUrl) {
    throw appError('??????????', 'invalid-image')
  }

  const imageBuffer = await downloadImageAsBuffer(imageUrl)
  const coverFileID = await createSmartCoverImage(fileIDText, imageBuffer, null)
  return {
    ok: Boolean(coverFileID),
    fileID: coverFileID,
    isSmartCover: String(coverFileID || '').includes('smart-covers/')
  }
}

async function recognizeMenuImages(fileIDs) {
  const ids = (Array.isArray(fileIDs) ? fileIDs : [])
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 9)

  if (!ids.length) {
    throw appError('图片无效', 'invalid-image')
  }

  const apiKey = String(process.env.VISION_API_KEY || process.env.OPENAI_API_KEY || '').trim()
  if (!apiKey) {
    throw appError('未配置识图 API Key', 'vision-not-configured')
  }

  const tempUrlResult = await cloud.getTempFileURL({
    fileList: ids
  })
  const tempUrls = (tempUrlResult.fileList || [])
    .map(file => file && (file.tempFileURL || file.download_url))
    .filter(Boolean)

  if (!tempUrls.length) {
    throw appError('图片临时链接生成失败', 'invalid-image')
  }

  const imageBuffers = await Promise.all(tempUrls.map(url => downloadImageAsBuffer(url)))
  const baseUrl = String(process.env.VISION_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = String(process.env.VISION_MODEL || 'gpt-4o-mini').trim()
  const headers = {
    Authorization: `Bearer ${apiKey}`
  }
  const response = await callMenuVisionWithFallback(`${baseUrl}/chat/completions`, headers, getVisionModels(model), tempUrls)
  const content = response && response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content
  const recognized = normalizeRecognizedProducts(parseJsonContent(content))

  for (const product of recognized) {
    const sourceIndex = clampNumber(product.sourceIndex, 0, imageBuffers.length - 1, 0)
    const sourceBuffer = imageBuffers[sourceIndex]
    if (!sourceBuffer) continue

    const coverFileID = await createSmartCoverImage(ids[sourceIndex] || ids[0], sourceBuffer, product.crop)
    if (coverFileID) {
      product.imageUrl = coverFileID
    }
  }

  return recognized
}

function getVisionModels(primaryModel) {
  return [
    primaryModel,
    'gpt-5.4',
    'gpt-5.4-mini',
    'gpt-4o',
    'gpt-4.1-mini',
    'gpt-4.1',
    'gpt-4o-mini'
  ]
    .map(item => String(item || '').trim())
    .filter((item, index, list) => item && list.indexOf(item) === index)
}

async function callVisionWithFallback(url, headers, models, imageUrls, payloadBuilder = buildVisionPayload) {
  let lastError = null

  for (const model of models) {
    for (const imageUrl of imageUrls) {
      try {
        return await postJson(url, payloadBuilder(model, imageUrl), headers)
      } catch (error) {
        lastError = error
        if (!shouldTryNextVisionOption(error)) {
          throw error
        }
      }
    }
  }

  throw lastError || appError('识图服务调用失败', 'vision-request-failed')
}

async function callMenuVisionWithFallback(url, headers, models, imageUrls) {
  let lastError = null
  const urls = (Array.isArray(imageUrls) ? imageUrls : []).filter(Boolean).slice(0, 9)

  for (const model of models) {
    try {
      return await postJson(url, buildMenuVisionPayload(model, urls), headers)
    } catch (error) {
      lastError = error
      if (!shouldTryNextVisionOption(error)) {
        throw error
      }
    }
  }

  if (urls.length > 1) {
    const allProducts = []
    for (const imageUrl of urls) {
      for (const model of models) {
        try {
          const response = await postJson(url, buildMenuVisionPayload(model, [imageUrl]), headers)
          const content = response && response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content
          allProducts.push(...normalizeRecognizedProducts(parseJsonContent(content)))
          break
        } catch (error) {
          lastError = error
          if (!shouldTryNextVisionOption(error)) {
            throw error
          }
        }
      }
    }

    if (allProducts.length) {
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({ products: allProducts })
            }
          }
        ]
      }
    }
  }

  throw lastError || appError('菜单识别服务调用失败', 'vision-request-failed')
}

async function callTextWithFallback(url, headers, models, payloadBuilder) {
  let lastError = null

  for (const model of models) {
    try {
      return await postJson(url, payloadBuilder(model), headers)
    } catch (error) {
      lastError = error
      if (!shouldTryNextVisionOption(error)) {
        throw error
      }
    }
  }

  throw lastError || appError('文本解析失败', 'text-request-failed')
}

function shouldTryNextVisionOption(error) {
  const message = String(error && error.message || '').toLowerCase()
  return [
    'model',
    'channel',
    'not support',
    'unsupported',
    'no available',
    'image',
    'response_format',
    'invalid'
  ].some(keyword => message.includes(keyword))
}

function buildVisionPayload(model, imageUrl) {
  return {
    model,
    temperature: 0.1,
    max_tokens: 500,
    messages: [
      {
        role: 'system',
        content: 'You extract menu product data. Return only one valid JSON object. No markdown. No explanation.'
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              'Extract one drink/snack product from the image.',
              'Return only JSON with fields: name, brand, category, price, defaultSugar, flavor, toppings, size, desc, icon, confidence.',
              'Also return crop:{x,y,width,height} for the main visible product/drink/snack body, using normalized coordinates from 0 to 1000 relative to the full image.',
              'The crop should exclude phone UI, black bars, text-only areas, menus, and background as much as possible while keeping the whole product visible.',
              'All text fields must be strings. Do not return objects, arrays, or booleans inside these fields.',
              'category must be number: 0 coffee, 1 fruit tea, 2 milk tea, 3 convenience/snack, 4 other.',
              'If price is unclear, use 0. icon must be one Chinese char from: 咖,果,奶,便,其,茶,甜.',
              'desc should be short, max 28 Chinese chars.',
              'Example: {"name":"冰美式","brand":"瑞幸","category":0,"price":0,"defaultSugar":"无糖","flavor":"咖啡","toppings":"","size":"大杯","desc":"无糖 大杯","icon":"咖","confidence":0.8,"crop":{"x":320,"y":240,"width":360,"height":430}}'
            ].join('\n')
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl
            }
          }
        ]
      }
    ]
  }
}

function buildMenuVisionPayload(model, imageUrls) {
  const imageContent = (Array.isArray(imageUrls) ? imageUrls : [imageUrls])
    .filter(Boolean)
    .slice(0, 9)
    .map((url, index) => ({
      type: 'image_url',
      image_url: {
        url,
        detail: index === 0 ? 'high' : 'auto'
      }
    }))

  return {
    model,
    temperature: 0.1,
    max_tokens: 3000,
    messages: [
      {
        role: 'system',
        content: 'You extract menu products from one or more images. Return only one valid JSON object. No markdown. No explanation.'
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              'Extract all sellable drink/snack products from all provided menu/order/option screenshots.',
              'Return JSON: {"products":[...]}',
              'Each product has fields: name, brand, category, price, defaultSugar, flavor, toppings, size, desc, icon, confidence, sourceIndex.',
              'Also return crop:{x,y,width,height} for each product if there is a main visible product image, using normalized coordinates from 0 to 1000 relative to sourceIndex image.',
              'The crop should contain the drink/snack/product body, excluding phone UI, black bars, text-only areas, and background when possible.',
              'All text fields must be strings. Do not return objects, arrays, or booleans inside these fields.',
              'category must be number: 0 coffee, 1 fruit tea, 2 milk tea, 3 convenience/snack, 4 other.',
              'If it is a single product option page, return one product only.',
              'If a package/combo contains multiple clear items, return each clear item as a separate product, and put the combo/package name in desc.',
              'If a package/combo components are unclear or generic, return the package/combo itself as one product and summarize included items in desc.',
              'If one image has many products, return as many distinct product names as visible, but skip prices-only add-ons, delivery fees, ads, tabs, and duplicate option rows.',
              'For option pages, do not create separate products for sugar/ice/topping/size options unless they are actual named sellable products.',
              'If price is unclear, use 0. Do not use add-on price, crossed price, delivery fee, or discount as product price.',
              'icon must be one Chinese char from: 咖,果,奶,便,其,茶,甜. desc max 28 Chinese chars.',
              'Deduplicate same products across images. Prefer concise Chinese names.',
              'sourceIndex is the zero-based index of the image where this product is most visible.',
              'Example: {"products":[{"name":"冰美式","brand":"瑞幸","category":0,"price":9.9,"defaultSugar":"无糖","flavor":"咖啡","toppings":"","size":"大杯","desc":"无糖 大杯","icon":"咖","confidence":0.8}]}'
            ].join('\n')
          }
        ].concat(imageContent)
      }
    ]
  }
}

function parseJsonContent(content) {
  const text = String(content || '').trim()
  if (!text) {
    throw appError('没有识别到商品信息', 'vision-empty-result')
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      throw appError('识别结果格式错误', 'vision-invalid-result')
    }
    return JSON.parse(match[0])
  }
}

function normalizeRecognizedProduct(data = {}) {
  const category = normalizeCategory(data.category)
  const iconMap = ['咖', '果', '奶', '便', '其']
  const defaultIcon = iconMap[category] || '其'
  const descParts = [data.flavor, data.defaultSugar, data.toppings, data.size]
    .map(item => String(item || '').trim())
    .filter(Boolean)
  const desc = String(data.desc || descParts.join(' · ') || '识图自动填入').trim()

  return {
    name: limitText(data.name, 16),
    brand: limitText(data.brand, 16),
    category,
    price: Number(data.price || 0),
    defaultSugar: limitText(data.defaultSugar, 8),
    flavor: limitText(data.flavor, 16),
    toppings: limitText(data.toppings, 18),
    size: limitText(data.size, 16),
    desc: limitText(desc, 28),
    icon: limitText(data.icon, 1) || defaultIcon,
    confidence: Number(data.confidence || 0),
    sourceIndex: clampNumber(data.sourceIndex, 0, 99, 0),
    crop: normalizeCrop(data.crop || data.coverCrop || data.bbox)
  }
}

function normalizeRecognizedProducts(data = {}) {
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data.products)
      ? data.products
      : Array.isArray(data.items)
        ? data.items
        : []

  const seen = new Set()
  return list
    .map(item => normalizeRecognizedProduct(item))
    .filter(item => item.name)
    .filter(item => {
      const key = [item.name, item.brand, item.category].map(value => String(value || '').replace(/\s/g, '')).join('|')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 50)
}

function normalizeCategory(value) {
  const text = String(value || '').trim()
  const categoryMap = {
    咖啡: 0,
    果茶: 1,
    奶茶: 2,
    便利店: 3,
    小零食: 3,
    零食: 3,
    其他: 4
  }
  if (Object.prototype.hasOwnProperty.call(categoryMap, text)) {
    return categoryMap[text]
  }
  return clampNumber(value, 0, 4, 4)
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, Math.round(number)))
}

function limitText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength)
}

async function createSmartCoverImage(fileID, imageBuffer, crop) {
  const rect = normalizeCrop(crop)

  try {
    const image = await Jimp.read(imageBuffer)
    const width = image.bitmap.width
    const height = image.bitmap.height
    if (!width || !height) return ''

    if (rect) {
      const padding = 0.10
      const x = Math.max(0, Math.round((rect.x - rect.width * padding) * width / 1000))
      const y = Math.max(0, Math.round((rect.y - rect.height * padding) * height / 1000))
      const right = Math.min(width, Math.round((rect.x + rect.width * (1 + padding)) * width / 1000))
      const bottom = Math.min(height, Math.round((rect.y + rect.height * (1 + padding)) * height / 1000))
      const cropWidth = Math.max(1, right - x)
      const cropHeight = Math.max(1, bottom - y)

      if (cropWidth < width * 0.98 || cropHeight < height * 0.98) {
        image.crop({ x, y, w: cropWidth, h: cropHeight })
      }
    } else {
      cropToLikelySubject(image)
    }

    const sourceBuffer = await getJimpBuffer(image, JimpMime.png)
    const removeBgBuffer = await removeBgImageAsSticker(sourceBuffer)
    if (removeBgBuffer) {
      const stickerImage = await Jimp.read(removeBgBuffer)
      cleanupRemoveBgSticker(stickerImage)
      trimTransparentPixels(stickerImage)
      return await uploadCoverBuffer(await getJimpBuffer(stickerImage, JimpMime.png))
    }

    const buffer = await createTransparentStickerBuffer(image)
    const stickerBuffer = process.env.IMAGE_EDIT_ENABLED === 'true'
      ? await editImageAsSticker(buffer)
      : null
    return await uploadCoverBuffer(stickerBuffer || buffer)
  } catch (error) {
    console.error('createSmartCoverImage failed:', error && (error.stack || error.message || error))
    return ''
  }
}

function cropToLikelySubject(image) {
  const width = image.bitmap.width
  const height = image.bitmap.height
  const data = image.bitmap.data
  const bounds = findCenteredSubjectBounds(data, width, height) || findLikelySubjectBounds(data, width, height)
  if (!bounds) return

  const subjectWidth = bounds.maxX - bounds.minX + 1
  const subjectHeight = bounds.maxY - bounds.minY + 1
  if (subjectWidth < width * 0.04 || subjectHeight < height * 0.04) return

  const padX = Math.max(12, Math.round(subjectWidth * (bounds.centered ? 0.055 : 0.14)))
  const padY = Math.max(14, Math.round(subjectHeight * 0.075))
  const x = Math.max(0, bounds.minX - padX)
  const y = Math.max(0, bounds.minY - padY)
  const right = Math.min(width - 1, bounds.maxX + padX)
  const bottom = Math.min(height - 1, bounds.maxY + padY)
  const cropWidth = right - x + 1
  const cropHeight = bottom - y + 1

  if (cropWidth < width * 0.98 || cropHeight < height * 0.98) {
    image.crop({ x, y, w: cropWidth, h: cropHeight })
  }
}

function findCenteredSubjectBounds(data, width, height) {
  const x0 = Math.round(width * 0.25)
  const x1 = Math.round(width * 0.75)
  const y0 = Math.round(height * 0.16)
  const y1 = Math.round(height * 0.92)
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  let count = 0

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const offset = (y * width + x) * 4
      if (!isLikelySubjectPixel(data[offset], data[offset + 1], data[offset + 2])) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
      count += 1
    }
  }

  if (count < Math.max(120, width * height * 0.01)) return null
  return { minX, minY, maxX, maxY, count, centered: true }
}

function findLikelySubjectBounds(data, width, height) {
  const total = width * height
  const visited = new Uint8Array(total)
  const queue = []
  let best = null

  for (let index = 0; index < total; index += 1) {
    if (visited[index]) continue
    visited[index] = 1

    const offset = index * 4
    if (!isLikelySubjectPixel(data[offset], data[offset + 1], data[offset + 2])) continue

    queue.length = 0
    queue.push(index)
    let area = 0
    let minX = width
    let minY = height
    let maxX = -1
    let maxY = -1

    for (let head = 0; head < queue.length; head += 1) {
      const current = queue[head]
      area += 1
      const x = current % width
      const y = Math.floor(current / width)
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)

      enqueueSubjectNeighbor(data, width, height, visited, queue, x + 1, y)
      enqueueSubjectNeighbor(data, width, height, visited, queue, x - 1, y)
      enqueueSubjectNeighbor(data, width, height, visited, queue, x, y + 1)
      enqueueSubjectNeighbor(data, width, height, visited, queue, x, y - 1)
    }

    const subjectWidth = maxX - minX + 1
    const subjectHeight = maxY - minY + 1
    if (area < Math.max(80, total * 0.001) || subjectWidth < width * 0.04 || subjectHeight < height * 0.04) {
      continue
    }

    const centerX = (minX + maxX) / 2
    const centerPenalty = Math.abs(centerX - width / 2) / Math.max(1, width / 2)
    const score = area * (1.15 - Math.min(0.75, centerPenalty))
    if (!best || score > best.score) {
      best = { minX, minY, maxX, maxY, area, score }
    }
  }

  return best
}

function enqueueSubjectNeighbor(data, width, height, visited, queue, x, y) {
  if (x < 0 || y < 0 || x >= width || y >= height) return
  const index = y * width + x
  if (visited[index]) return
  visited[index] = 1
  const offset = index * 4
  if (isLikelySubjectPixel(data[offset], data[offset + 1], data[offset + 2])) {
    queue.push(index)
  }
}

function isLikelySubjectPixel(r, g, b) {
  const bright = (r + g + b) / 3
  const sat = Math.max(r, g, b) - Math.min(r, g, b)
  if (bright < 42 || bright > 248) return false
  if (sat >= 30) return true
  return bright < 170 && sat >= 16
}

async function createTransparentStickerBuffer(image) {
  const width = image.bitmap.width
  const height = image.bitmap.height
  if (!width || !height) {
    return getJimpBuffer(image, JimpMime.png)
  }

  const data = image.bitmap.data
  const background = sampleBorderColor(data, width, height)
  const subjectRows = buildSubjectRowBounds(data, width, height)
  const removeMask = findConnectedBackground(data, width, height, background, subjectRows)

  for (let i = 0; i < removeMask.length; i += 1) {
    if (!removeMask[i]) continue
    const offset = i * 4
    const softness = backgroundSoftness(data[offset], data[offset + 1], data[offset + 2], background)
    data[offset + 3] = Math.max(0, Math.min(42, Math.round(42 * (1 - softness))))
  }

  removeDarkUiBands(data, width, height)
  removeDarkUiBlocks(data, width, height)
  removeDarkEdgePixels(data, width, height)
  removeSideAnnotations(data, width, height)
  removePlainEdgeBackground(data, width, height)
  removeDistantLightBackground(data, width, height)
  featherTransparentEdge(data, width, height, removeMask)
  trimTransparentPixels(image)
  return getJimpBuffer(image, JimpMime.png)
}

function removeDistantLightBackground(data, width, height) {
  const total = width * height
  const far = 1000000
  const distances = new Int32Array(total)
  distances.fill(far)

  for (let i = 0; i < total; i += 1) {
    const offset = i * 4
    if (data[offset + 3] < 80) continue
    const r = data[offset]
    const g = data[offset + 1]
    const b = data[offset + 2]
    if (isSubjectSeedPixel(r, g, b)) {
      distances[i] = 0
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      let distance = distances[index]
      if (x > 0) distance = Math.min(distance, distances[index - 1] + 1)
      if (y > 0) distance = Math.min(distance, distances[index - width] + 1)
      distances[index] = distance
    }
  }

  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const index = y * width + x
      let distance = distances[index]
      if (x < width - 1) distance = Math.min(distance, distances[index + 1] + 1)
      if (y < height - 1) distance = Math.min(distance, distances[index + width] + 1)
      distances[index] = distance
    }
  }

  const keepRadius = Math.max(22, Math.round(Math.min(width, height) * 0.055))
  for (let i = 0; i < total; i += 1) {
    const offset = i * 4
    if (data[offset + 3] < 80) continue
    if (distances[i] <= keepRadius) continue
    if (isPlainLightPixel(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) {
      data[offset + 3] = 0
    }
  }
}

function isSubjectSeedPixel(r, g, b) {
  const bright = (r + g + b) / 3
  const sat = Math.max(r, g, b) - Math.min(r, g, b)
  return (sat > 42 && bright < 248) || bright < 170
}

function removeSideAnnotations(data, width, height) {
  const bottomStart = Math.round(height * 0.68)
  const sideWidth = Math.round(width * 0.18)
  for (let y = bottomStart; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inSide = x < sideWidth || x > width - sideWidth
      if (!inSide) continue
      const offset = (y * width + x) * 4
      const alpha = data[offset + 3]
      if (alpha < 80) continue
      const r = data[offset]
      const g = data[offset + 1]
      const b = data[offset + 2]
      const bright = (r + g + b) / 3
      const sat = Math.max(r, g, b) - Math.min(r, g, b)
      if (bright < 225 || sat > 28) {
        data[offset + 3] = 0
      }
    }
  }
}

function removePlainEdgeBackground(data, width, height) {
  const topLimit = Math.round(height * 0.18)
  const bottomStart = Math.round(height * 0.70)
  for (let y = 0; y < height; y += 1) {
    if (y > topLimit && y < bottomStart) continue

    let colorCount = 0
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const alpha = data[offset + 3]
      if (alpha < 80) continue
      const r = data[offset]
      const g = data[offset + 1]
      const b = data[offset + 2]
      const bright = (r + g + b) / 3
      const sat = Math.max(r, g, b) - Math.min(r, g, b)
      if ((sat > 34 && bright < 248) || bright < 190) {
        colorCount += 1
      }
    }

    if (colorCount > width * 0.10) continue

    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      if (isPlainLightPixel(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) {
        data[offset + 3] = 0
      }
    }
  }
}

function isPlainLightPixel(r, g, b, alpha) {
  if (alpha < 80) return false
  const bright = (r + g + b) / 3
  const sat = Math.max(r, g, b) - Math.min(r, g, b)
  return bright > 226 && sat < 44
}

function removeDarkEdgePixels(data, width, height) {
  const topLimit = Math.round(height * 0.16)
  const bottomStart = Math.round(height * 0.72)
  for (let y = 0; y < height; y += 1) {
    if (y > topLimit && y < bottomStart) continue
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      if (isDarkUiPixel(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) {
        data[offset + 3] = 0
      }
    }
  }
}

function removeDarkUiBands(data, width, height) {
  const rowStats = []
  for (let y = 0; y < height; y += 1) {
    let count = 0
    let minX = width
    let maxX = -1
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      if (!isDarkUiPixel(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) continue
      count += 1
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
    }
    rowStats.push({ count, minX, maxX })
  }

  const minDarkPixels = Math.max(18, Math.round(width * 0.16))
  let y = 0
  while (y < height) {
    if (rowStats[y].count < minDarkPixels) {
      y += 1
      continue
    }

    const startY = y
    let endY = y
    let minX = rowStats[y].minX
    let maxX = rowStats[y].maxX
    let darkTotal = rowStats[y].count

    y += 1
    while (y < height && rowStats[y].count >= minDarkPixels) {
      endY = y
      minX = Math.min(minX, rowStats[y].minX)
      maxX = Math.max(maxX, rowStats[y].maxX)
      darkTotal += rowStats[y].count
      y += 1
    }

    const bandHeight = endY - startY + 1
    const bandWidth = maxX - minX + 1
    const fillRatio = darkTotal / Math.max(1, bandWidth * bandHeight)
    const isTopOrBottom = endY < height * 0.38 || startY > height * 0.48
    const looksLikeUiBand =
      isTopOrBottom &&
      bandHeight >= Math.max(6, Math.round(height * 0.018)) &&
      bandWidth >= Math.max(34, Math.round(width * 0.18)) &&
      fillRatio > 0.36

    if (!looksLikeUiBand) continue

    const padX = Math.max(3, Math.round(width * 0.018))
    const padY = Math.max(2, Math.round(height * 0.012))
    clearRectAlpha(
      data,
      width,
      height,
      Math.max(0, minX - padX),
      Math.max(0, startY - padY),
      Math.min(width - 1, maxX + padX),
      Math.min(height - 1, endY + padY)
    )
  }
}

function clearRectAlpha(data, width, height, minX, minY, maxX, maxY) {
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      data[(y * width + x) * 4 + 3] = 0
    }
  }
}

function removeDarkUiBlocks(data, width, height) {
  const total = width * height
  const visited = new Uint8Array(total)
  const queue = []

  for (let index = 0; index < total; index += 1) {
    if (visited[index]) continue
    visited[index] = 1

    const offset = index * 4
    if (!isDarkUiPixel(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) continue

    queue.length = 0
    queue.push(index)
    const component = []
    let minX = width
    let minY = height
    let maxX = -1
    let maxY = -1

    for (let head = 0; head < queue.length; head += 1) {
      const current = queue[head]
      component.push(current)

      const x = current % width
      const y = Math.floor(current / width)
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)

      enqueueDarkNeighbor(data, width, height, visited, queue, x + 1, y)
      enqueueDarkNeighbor(data, width, height, visited, queue, x - 1, y)
      enqueueDarkNeighbor(data, width, height, visited, queue, x, y + 1)
      enqueueDarkNeighbor(data, width, height, visited, queue, x, y - 1)
    }

    const blockWidth = maxX - minX + 1
    const blockHeight = maxY - minY + 1
    const area = component.length
    const fillRatio = area / Math.max(1, blockWidth * blockHeight)
    const looksLikeUiBlock =
      area > Math.max(40, total * 0.0008) &&
      blockWidth > width * 0.07 &&
      blockHeight > height * 0.012 &&
      fillRatio > 0.42

    if (!looksLikeUiBlock) continue

    component.forEach(pixelIndex => {
      data[pixelIndex * 4 + 3] = 0
    })
  }
}

function enqueueDarkNeighbor(data, width, height, visited, queue, x, y) {
  if (x < 0 || y < 0 || x >= width || y >= height) return
  const index = y * width + x
  if (visited[index]) return
  visited[index] = 1
  const offset = index * 4
  if (isDarkUiPixel(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) {
    queue.push(index)
  }
}

function isDarkUiPixel(r, g, b, alpha) {
  if (alpha < 80) return false
  const bright = (r + g + b) / 3
  const sat = Math.max(r, g, b) - Math.min(r, g, b)
  return bright < 58 && sat < 42
}

function sampleBorderColor(data, width, height) {
  const samples = []
  const stepX = Math.max(1, Math.floor(width / 18))
  const stepY = Math.max(1, Math.floor(height / 18))

  for (let x = 0; x < width; x += stepX) {
    samples.push(readRgb(data, x, 0, width))
    samples.push(readRgb(data, x, height - 1, width))
  }

  for (let y = 0; y < height; y += stepY) {
    samples.push(readRgb(data, 0, y, width))
    samples.push(readRgb(data, width - 1, y, width))
  }

  samples.sort((a, b) => brightness(b) - brightness(a))
  const brightSamples = samples.slice(0, Math.max(1, Math.ceil(samples.length * 0.45)))
  return averageRgb(brightSamples)
}

function buildSubjectRowBounds(data, width, height) {
  const seedsByRow = Array.from({ length: height }, () => ({ min: width, max: -1 }))
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const r = data[offset]
      const g = data[offset + 1]
      const b = data[offset + 2]
      const bright = (r + g + b) / 3
      const sat = Math.max(r, g, b) - Math.min(r, g, b)
      if ((sat > 34 && bright < 248) || bright < 190) {
        seedsByRow[y].min = Math.min(seedsByRow[y].min, x)
        seedsByRow[y].max = Math.max(seedsByRow[y].max, x)
      }
    }
  }

  const rowBounds = Array.from({ length: height }, () => ({ min: width, max: -1 }))
  const verticalRadius = Math.max(12, Math.round(height * 0.09))
  const horizontalPad = Math.max(18, Math.round(width * 0.12))

  for (let y = 0; y < height; y += 1) {
    const from = Math.max(0, y - verticalRadius)
    const to = Math.min(height - 1, y + verticalRadius)
    let min = width
    let max = -1
    for (let row = from; row <= to; row += 1) {
      min = Math.min(min, seedsByRow[row].min)
      max = Math.max(max, seedsByRow[row].max)
    }
    if (max >= min) {
      rowBounds[y] = {
        min: Math.max(0, min - horizontalPad),
        max: Math.min(width - 1, max + horizontalPad)
      }
    }
  }

  return rowBounds
}

function findConnectedBackground(data, width, height, background, subjectRows) {
  const total = width * height
  const visited = new Uint8Array(total)
  const removeMask = new Uint8Array(total)
  const queue = []

  function enqueue(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const index = y * width + x
    if (visited[index]) return
    visited[index] = 1
    const row = subjectRows && subjectRows[y]
    if (row && row.max >= row.min && x >= row.min && x <= row.max) return
    const offset = index * 4
    if (!isBackgroundPixel(data[offset], data[offset + 1], data[offset + 2], background)) return
    removeMask[index] = 1
    queue.push(index)
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0)
    enqueue(x, height - 1)
  }

  for (let y = 0; y < height; y += 1) {
    enqueue(0, y)
    enqueue(width - 1, y)
  }

  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head]
    const x = index % width
    const y = Math.floor(index / width)
    enqueue(x + 1, y)
    enqueue(x - 1, y)
    enqueue(x, y + 1)
    enqueue(x, y - 1)
  }

  return removeMask
}

function featherTransparentEdge(data, width, height, removeMask) {
  const alphaUpdates = []
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x
      if (removeMask[index]) continue
      const nearBackground =
        removeMask[index - 1] ||
        removeMask[index + 1] ||
        removeMask[index - width] ||
        removeMask[index + width]
      if (nearBackground) alphaUpdates.push(index)
    }
  }

  alphaUpdates.forEach(index => {
    const offset = index * 4
    data[offset + 3] = Math.max(168, Math.round(data[offset + 3] * 0.88))
  })
}

function trimTransparentPixels(image) {
  const width = image.bitmap.width
  const height = image.bitmap.height
  const data = image.bitmap.data
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha <= 70) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  if (maxX < minX || maxY < minY) return

  const padX = Math.round((maxX - minX + 1) * 0.06)
  const padY = Math.round((maxY - minY + 1) * 0.06)
  const x = Math.max(0, minX - padX)
  const y = Math.max(0, minY - padY)
  const right = Math.min(width - 1, maxX + padX)
  const bottom = Math.min(height - 1, maxY + padY)
  image.crop({ x, y, w: Math.max(1, right - x + 1), h: Math.max(1, bottom - y + 1) })
}

function isBackgroundPixel(r, g, b, background) {
  const colorDistance = rgbDistance({ r, g, b }, background)
  const whiteDistance = rgbDistance({ r, g, b }, { r: 255, g: 255, b: 255 })
  const pixelBrightness = (r + g + b) / 3
  const saturation = Math.max(r, g, b) - Math.min(r, g, b)
  return colorDistance < 36 ||
    (pixelBrightness < 28 && saturation < 24) ||
    (whiteDistance < 30 && saturation < 20) ||
    (pixelBrightness > 250 && saturation < 18)
}

function backgroundSoftness(r, g, b, background) {
  const distance = Math.min(
    rgbDistance({ r, g, b }, background),
    rgbDistance({ r, g, b }, { r: 255, g: 255, b: 255 })
  )
  return Math.max(0, Math.min(1, (88 - distance) / 88))
}

function readRgb(data, x, y, width) {
  const offset = (y * width + x) * 4
  return {
    r: data[offset],
    g: data[offset + 1],
    b: data[offset + 2]
  }
}

function averageRgb(colors) {
  const sum = colors.reduce((acc, color) => ({
    r: acc.r + color.r,
    g: acc.g + color.g,
    b: acc.b + color.b
  }), { r: 0, g: 0, b: 0 })
  const count = Math.max(1, colors.length)
  return {
    r: Math.round(sum.r / count),
    g: Math.round(sum.g / count),
    b: Math.round(sum.b / count)
  }
}

function brightness(color) {
  return color.r + color.g + color.b
}

function rgbDistance(a, b) {
  return Math.sqrt(
    Math.pow(a.r - b.r, 2) +
    Math.pow(a.g - b.g, 2) +
    Math.pow(a.b - b.b, 2)
  )
}

function cleanupRemoveBgSticker(image) {
  const width = image.bitmap.width
  const height = image.bitmap.height
  const data = image.bitmap.data
  const total = width * height
  const visited = new Uint8Array(total)
  const queue = []
  const components = []

  for (let index = 0; index < total; index += 1) {
    if (visited[index]) continue
    visited[index] = 1
    if (data[index * 4 + 3] < 48) continue

    queue.length = 0
    queue.push(index)
    const pixels = []
    let minX = width
    let minY = height
    let maxX = -1
    let maxY = -1
    let colorPixels = 0
    let darkPixels = 0

    for (let head = 0; head < queue.length; head += 1) {
      const current = queue[head]
      pixels.push(current)
      const x = current % width
      const y = Math.floor(current / width)
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)

      const offset = current * 4
      const r = data[offset]
      const g = data[offset + 1]
      const b = data[offset + 2]
      const bright = (r + g + b) / 3
      const sat = Math.max(r, g, b) - Math.min(r, g, b)
      if ((sat > 28 && bright > 42 && bright < 252) || (r > g + 18 && r > b + 18 && bright > 60)) {
        colorPixels += 1
      }
      if (bright < 60 && sat < 50) {
        darkPixels += 1
      }

      enqueueAlphaNeighbor(data, width, height, visited, queue, x + 1, y)
      enqueueAlphaNeighbor(data, width, height, visited, queue, x - 1, y)
      enqueueAlphaNeighbor(data, width, height, visited, queue, x, y + 1)
      enqueueAlphaNeighbor(data, width, height, visited, queue, x, y - 1)
    }

    const area = pixels.length
    const boxWidth = maxX - minX + 1
    const boxHeight = maxY - minY + 1
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const centerPenalty =
      Math.abs(centerX - width / 2) / Math.max(1, width / 2) +
      Math.abs(centerY - height / 2) / Math.max(1, height / 2) * 0.35
    const score = (colorPixels * 4 + area * 0.08) * (1.2 - Math.min(0.8, centerPenalty))

    components.push({
      pixels,
      area,
      minX,
      minY,
      maxX,
      maxY,
      boxWidth,
      boxHeight,
      colorPixels,
      darkRatio: darkPixels / Math.max(1, area),
      score
    })
  }

  const best = components
    .filter(component => component.colorPixels > Math.max(12, component.area * 0.015))
    .sort((a, b) => b.score - a.score)[0]
  if (!best) return

  const keepPad = Math.max(12, Math.round(Math.min(width, height) * 0.05))
  for (const component of components) {
    const darkUiBlock =
      component.darkRatio > 0.82 &&
      (component.boxWidth > width * 0.18 || component.boxHeight > height * 0.045)
    const closeToBest =
      component.maxX >= best.minX - keepPad &&
      component.minX <= best.maxX + keepPad &&
      component.maxY >= best.minY - keepPad &&
      component.minY <= best.maxY + keepPad
    const usefulFragment =
      closeToBest &&
      component.colorPixels > 0 &&
      component.area > Math.max(4, total * 0.00002)

    if (component === best || (usefulFragment && !darkUiBlock)) continue
    component.pixels.forEach(pixelIndex => {
      data[pixelIndex * 4 + 3] = 0
    })
  }
}

function enqueueAlphaNeighbor(data, width, height, visited, queue, x, y) {
  if (x < 0 || y < 0 || x >= width || y >= height) return
  const index = y * width + x
  if (visited[index]) return
  visited[index] = 1
  if (data[index * 4 + 3] >= 48) {
    queue.push(index)
  }
}

async function removeBgImageAsSticker(imageBuffer) {
  const apiKey = String(
    process.env.REMOVE_BG_API_KEY ||
    process.env.REMOVEBG_API_KEY ||
    process.env.REMOVE_BG_KEY ||
    ''
  ).trim()
  if (!apiKey) return null

  try {
    const result = await postMultipartBuffer('https://api.remove.bg/v1.0/removebg', {
      size: 'preview',
      format: 'png'
    }, {
      fieldName: 'image_file',
      filename: 'product.png',
      contentType: 'image/png',
      buffer: imageBuffer
    }, {
      'X-Api-Key': apiKey,
      Accept: 'image/png'
    }, 20000)

    return result && result.length ? result : null
  } catch (error) {
    console.error('remove.bg failed:', error && (error.message || error))
    return null
  }
}

async function editImageAsSticker(imageBuffer) {
  const apiKey = String(process.env.VISION_API_KEY || process.env.OPENAI_API_KEY || '').trim()
  const model = String(process.env.IMAGE_EDIT_MODEL || '').trim()
  if (!apiKey || !model) return null

  const baseUrl = String(process.env.VISION_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  try {
    const result = await postMultipart(`${baseUrl}/images/edits`, {
      model,
      prompt: 'Turn the product in this image into a clean cutout sticker for a drink ordering app. Remove the background completely. Keep the actual drink/snack/product accurate. Output transparent PNG.',
      size: '1024x1024',
      background: 'transparent',
      output_format: 'png'
    }, {
      fieldName: 'image',
      filename: 'product.png',
      contentType: 'image/png',
      buffer: imageBuffer
    }, {
      Authorization: `Bearer ${apiKey}`
    }, 12000)
    return imageEditResultToBuffer(result)
  } catch (error) {
    return null
  }
}

function imageEditResultToBuffer(result) {
  const item = result && Array.isArray(result.data) && result.data[0]
  if (!item) return null
  if (item.b64_json) {
    return Buffer.from(item.b64_json, 'base64')
  }
  return null
}

async function uploadCoverBuffer(buffer) {
  const cloudPath = `smart-covers/${Date.now()}-${Math.random().toString(36).slice(2)}.png`
  const result = await cloud.uploadFile({
    cloudPath,
    fileContent: buffer
  })
  return result.fileID || ''
}

async function testImageEditModel() {
  const image = new Jimp({ width: 64, height: 64, color: 0xffffffff })
  for (let y = 16; y < 52; y += 1) {
    for (let x = 20; x < 44; x += 1) {
      image.setPixelColor(0xff9f0aff, x, y)
    }
  }
  const buffer = await getJimpBuffer(image, JimpMime.png)
  const edited = await editImageAsSticker(buffer)
  return {
    model: String(process.env.IMAGE_EDIT_MODEL || ''),
    ok: Boolean(edited && edited.length),
    bytes: edited ? edited.length : 0
  }
}

function normalizeCrop(crop) {
  if (!crop || typeof crop !== 'object') return null
  const x = Number(crop.x ?? crop.left)
  const y = Number(crop.y ?? crop.top)
  const width = Number(crop.width ?? crop.w)
  const height = Number(crop.height ?? crop.h)
  if (![x, y, width, height].every(Number.isFinite)) return null
  if (width < 80 || height < 80) return null
  return {
    x: clampNumber(x, 0, 1000, 0),
    y: clampNumber(y, 0, 1000, 0),
    width: clampNumber(width, 1, 1000, 1000),
    height: clampNumber(height, 1, 1000, 1000)
  }
}

function getJimpBuffer(image, mimeType) {
  const result = image.getBuffer(mimeType)
  if (result && typeof result.then === 'function') {
    return result
  }

  return new Promise((resolve, reject) => {
    image.getBuffer(mimeType, (error, buffer) => {
      if (error) {
        reject(error)
        return
      }
      resolve(buffer)
    })
  })
}

function bufferToImageDataUrl(buffer, mimeType) {
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

function downloadImageAsBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(appError('图片下载失败', 'invalid-image'))
        response.resume()
        return
      }

      const chunks = []
      response.on('data', chunk => {
        chunks.push(chunk)
      })
      response.on('end', () => {
        const buffer = Buffer.concat(chunks)
        if (!buffer.length) {
          reject(appError('图片为空', 'invalid-image'))
          return
        }

        resolve(buffer)
      })
    }).on('error', () => {
      reject(appError('图片下载失败', 'invalid-image'))
    })
  })
}

function resolveImageMimeType(contentType, fileID) {
  const type = String(contentType || '').split(';')[0].trim().toLowerCase()
  if (type.startsWith('image/')) return type

  const ext = String(fileID || '').split('?')[0].split('.').pop().toLowerCase()
  const map = {
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg'
  }
  return map[ext] || 'image/jpeg'
}

function postJson(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data)
    const request = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers
      }
    }, (response) => {
      let responseBody = ''
      response.setEncoding('utf8')
      response.on('data', chunk => {
        responseBody += chunk
      })
      response.on('end', () => {
        let parsed
        try {
          parsed = JSON.parse(responseBody || '{}')
        } catch (error) {
          reject(appError('识图服务返回异常', 'vision-request-failed'))
          return
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          const errorMessage = parsed.error && parsed.error.message
          reject(appError(errorMessage || '识图服务调用失败', 'vision-request-failed'))
          return
        }

        resolve(parsed)
      })
    })

    request.on('error', () => {
      reject(appError('识图服务网络异常', 'vision-request-failed'))
    })
    request.write(body)
    request.end()
  })
}

function postMultipart(url, fields, file, headers = {}, timeoutMs = 0) {
  return new Promise((resolve, reject) => {
    const boundary = `----corn-menu-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const parts = []

    Object.entries(fields || {}).forEach(([key, value]) => {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`))
    })
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldName}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`))
    parts.push(file.buffer)
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`))

    const body = Buffer.concat(parts)
    const request = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        ...headers
      }
    }, (response) => {
      let responseBody = ''
      response.setEncoding('utf8')
      response.on('data', chunk => {
        responseBody += chunk
      })
      response.on('end', () => {
        let parsed
        try {
          parsed = JSON.parse(responseBody || '{}')
        } catch (error) {
          reject(appError('图片编辑服务返回异常', 'image-edit-request-failed'))
          return
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          const errorMessage = parsed.error && parsed.error.message
          reject(appError(errorMessage || '图片编辑服务调用失败', 'image-edit-request-failed'))
          return
        }

        resolve(parsed)
      })
    })

    if (timeoutMs > 0) {
      request.setTimeout(timeoutMs, () => {
        request.destroy(appError('图片编辑服务超时', 'image-edit-timeout'))
      })
    }

    request.on('error', () => {
      reject(appError('图片编辑服务网络异常', 'image-edit-request-failed'))
    })
    request.write(body)
    request.end()
  })
}

function postMultipartBuffer(url, fields, file, headers = {}, timeoutMs = 0) {
  return new Promise((resolve, reject) => {
    const boundary = `----corn-menu-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const parts = []

    Object.entries(fields || {}).forEach(([key, value]) => {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`))
    })
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldName}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`))
    parts.push(file.buffer)
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`))

    const body = Buffer.concat(parts)
    const request = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        ...headers
      }
    }, (response) => {
      const chunks = []
      response.on('data', chunk => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      })
      response.on('end', () => {
        const buffer = Buffer.concat(chunks)
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(appError(buffer.toString('utf8') || 'remove.bg failed', 'image-edit-request-failed'))
          return
        }

        resolve(buffer)
      })
    })

    if (timeoutMs > 0) {
      request.setTimeout(timeoutMs, () => {
        request.destroy(appError('remove.bg timeout', 'image-edit-timeout'))
      })
    }

    request.on('error', () => {
      reject(appError('remove.bg network failed', 'image-edit-request-failed'))
    })
    request.write(body)
    request.end()
  })
}

async function addProduct(product = {}, openid) {
  const now = Date.now()
  const data = {
    id: product.id || `goods-${now}`,
    userId: String(product.userId || product.account || '').trim(),
    category: Number(product.category || 0),
    icon: String(product.icon || '其'),
    imageUrl: String(product.imageUrl || ''),
    brand: String(product.brand || ''),
    defaultSugar: String(product.defaultSugar || ''),
    name: String(product.name || '').trim(),
    price: Number(product.price || 0),
    desc: String(product.desc || '暂无描述').trim(),
    createdBy: openid,
    createdAt: now,
    updatedAt: now
  }

  validateProduct(data)
  await products.add({ data })
  return data
}

async function updateProduct(product = {}, openid) {
  const id = String(product.id || '').trim()
  const userId = String(product.userId || product.account || '').trim()
  if (!id) {
    throw appError('商品 ID 无效', 'invalid-product-id')
  }

  const result = await products.where({ id, userId }).limit(1).get()
  const doc = result.data[0]
  if (!doc) {
    throw appError('商品不存在或已被删除', 'product-not-found')
  }

  const data = {
    id,
    userId,
    category: Number(product.category || 0),
    icon: String(product.icon || '其'),
    imageUrl: String(product.imageUrl || ''),
    brand: String(product.brand || ''),
    defaultSugar: String(product.defaultSugar || ''),
    name: String(product.name || '').trim(),
    price: Number(product.price || 0),
    desc: String(product.desc || '暂无描述').trim(),
    updatedBy: openid,
    updatedAt: Date.now()
  }

  validateProduct(data)
  await products.doc(doc._id).update({ data })
  return normalizeDocId({
    ...doc,
    ...data
  })
}

function validateProduct(data) {
  if (!data.userId) {
    throw appError('账号信息无效', 'invalid-account')
  }

  if (!data.name) {
    throw appError('商品名称不能为空', 'invalid-product-name')
  }

  if (!Number.isFinite(data.price) || data.price <= 0) {
    throw appError('商品价格无效', 'invalid-product-price')
  }
}

async function deleteProduct(productId, userId) {
  const id = String(productId || '').trim()
  const userIdText = String(userId || '').trim()

  if (!id) {
    throw appError('商品 ID 无效', 'invalid-product-id')
  }

  const result = await products.where({ id, userId: userIdText }).limit(1).get()
  const doc = result.data[0]

  if (!doc) {
    throw appError('商品不存在或已被删除', 'product-not-found')
  }

  const removeResult = await products.doc(doc._id).remove()
  if (removeResult.stats && removeResult.stats.removed === 0) {
    throw appError('商品不存在或已被删除', 'product-not-found')
  }
}

async function listOrders(userId) {
  const userIdText = String(userId || '').trim()
  const query = userIdText
    ? orders.where({ userId: userIdText })
    : orders.where({ userId: '__none__' })

  const result = await query
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
    throw appError('订单商品不能为空', 'invalid-order-items')
  }

  const data = {
    id: order.id || `order-${now}`,
    items: items.map(item => ({
      id: String(item.id || ''),
      name: String(item.name || ''),
      icon: String(item.icon || '其'),
      imageUrl: String(item.imageUrl || ''),
      brand: String(item.brand || ''),
      desc: String(item.desc || item.note || item.remark || '').trim(),
      note: String(item.note || item.remark || item.desc || '').trim(),
      remark: String(item.remark || item.note || item.desc || '').trim(),
      category: Number(item.category || 0),
      sugar: String(item.sugar || ''),
      price: Number(item.price || 0),
      count: Number(item.count || 0)
    })),
    totalPrice,
    totalCount,
    note: String(order.note || '').trim(),
    doneNotifyTemplateId: String(order.doneNotifyTemplateId || '').trim(),
    userId: String(order.userId || order.account || '').trim(),
    status: 'pending',
    remindCount: 0,
    remindedAt: 0,
    createdBy: openid,
    createdAt: now,
    updatedAt: now
  }

  await orders.add({ data })
  await notifyOrderCreated(data)
  return data
}

async function registerOrderNotifier(openid, userId, templateId, adminCode) {
  if (!(await hasAdminAccess(openid, adminCode))) {
    throw appError('无权限开启订单通知', 'permission-denied')
  }

  const openidText = String(openid || '').trim()
  const templateIdText = String(templateId || '').trim()
  if (!openidText) {
    throw appError('微信身份无效', 'invalid-openid')
  }
  if (!templateIdText || templateIdText === 'YOUR_ORDER_NOTIFY_TEMPLATE_ID') {
    throw appError('订单通知模板未配置', 'notify-template-not-configured')
  }

  await ensureNotificationSubscribersCollection()

  const now = Date.now()
  const data = {
    openid: openidText,
    userId: String(userId || '').trim(),
    templateId: templateIdText,
    type: 'order-created',
    enabled: true,
    updatedAt: now
  }
  const existed = await notificationSubscribers
    .where({ openid: openidText, type: 'order-created' })
    .limit(1)
    .get()
  const doc = existed.data[0]

  if (doc) {
    await notificationSubscribers.doc(doc._id).update({ data })
    return normalizeDocId({ ...doc, ...data })
  }

  const saved = {
    ...data,
    createdAt: now
  }
  await notificationSubscribers.add({ data: saved })
  return saved
}

async function ensureNotificationSubscribersCollection() {
  try {
    await db.createCollection('notificationSubscribers')
  } catch (error) {
  }
}

async function notifyOrderCreated(order) {
  await ensureNotificationSubscribersCollection()

  const configuredTemplateId = String(process.env.ORDER_NOTIFY_TEMPLATE_ID || DEFAULT_ORDER_NOTIFY_TEMPLATE_ID).trim()
  let subscribers = []
  try {
    const query = configuredTemplateId && configuredTemplateId !== 'YOUR_ORDER_NOTIFY_TEMPLATE_ID'
      ? notificationSubscribers.where({ type: 'order-created', enabled: true, templateId: configuredTemplateId })
      : notificationSubscribers.where({ type: 'order-created', enabled: true })
    const result = await query.limit(20).get()
    subscribers = result.data || []
  } catch (error) {
    console.error('load order notification subscribers failed:', error)
    return
  }

  if (!subscribers.length) return

  const data = buildOrderNotificationData(order)
  await Promise.all(subscribers.map(async subscriber => {
    const templateId = String(subscriber.templateId || configuredTemplateId || '').trim()
    if (!templateId || templateId === 'YOUR_ORDER_NOTIFY_TEMPLATE_ID') return

    try {
      await cloud.openapi.subscribeMessage.send({
        touser: subscriber.openid,
        templateId,
        page: process.env.ORDER_NOTIFY_PAGE || 'pages/orders/orders',
        data
      })
    } catch (error) {
      console.error('send order notification failed:', subscriber.openid, error && (error.errCode || error.errMsg || error.message || error))
    }
  }))
}

function buildOrderNotificationData(order = {}) {
  return {
    character_string3: {
      value: limitNotifyText(order.id || '新订单', 32)
    },
    thing6: {
      value: limitNotifyText(orderItemsTitle(order), 20)
    },
    time7: {
      value: formatNotifyTime(order.createdAt || Date.now())
    },
    thing5: {
      value: limitNotifyText(order.note || firstItemDesc(order) || '有新订单待处理', 20)
    }
  }
}

function orderItemsTitle(order = {}) {
  const items = Array.isArray(order.items) ? order.items : []
  return items
    .map(item => `${item.name || '商品'}x${Number(item.count || 1)}`)
    .slice(0, 3)
    .join('、') || '新订单'
}

function firstItemDesc(order = {}) {
  const item = (Array.isArray(order.items) ? order.items : []).find(current => current && (current.desc || current.sugar))
  return item ? String(item.desc || item.sugar || '').trim() : ''
}

function formatNotifyTime(timestamp) {
  const date = new Date(Number(timestamp || Date.now()))
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

function limitNotifyText(value, maxLength) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > maxLength ? text.slice(0, maxLength) : text
}

async function remindOrder(orderId, userId, openid) {
  const id = String(orderId || '').trim()
  if (!id) {
    throw appError('订单 ID 无效', 'invalid-order-id')
  }

  const result = await orders.where({ id }).limit(1).get()
  const doc = result.data[0]
  if (!doc) {
    throw appError('订单不存在或已被删除', 'order-not-found')
  }

  if (doc.status === 'done' || doc.status === 'cancelled') {
    throw appError('订单已结束，不能催单', 'order-finished')
  }

  const userIdText = String(userId || '').trim()
  const allowed = await isAdmin(openid) || !doc.userId || doc.userId === userIdText
  if (!allowed) {
    throw appError('无权限提醒该订单', 'permission-denied')
  }

  const now = Date.now()
  const data = {
    remindCount: Number(doc.remindCount || 0) + 1,
    remindedAt: now,
    updatedAt: now
  }

  await orders.doc(doc._id).update({ data })
  return normalizeDocId({
    ...doc,
    ...data
  })
}

async function cancelOrder(orderId, userId, openid) {
  const id = String(orderId || '').trim()
  if (!id) {
    throw appError('订单 ID 无效', 'invalid-order-id')
  }

  const result = await orders.where({ id }).limit(1).get()
  const doc = result.data[0]
  if (!doc) {
    throw appError('订单不存在或已被删除', 'order-not-found')
  }

  if (doc.status === 'done') {
    throw appError('订单已完成，不能取消', 'order-finished')
  }

  const userIdText = String(userId || '').trim()
  const allowed = await isAdmin(openid) || !doc.userId || doc.userId === userIdText
  if (!allowed) {
    throw appError('无权限取消该订单', 'permission-denied')
  }

  await orders.doc(doc._id).update({
    data: {
      status: 'cancelled',
      updatedAt: Date.now()
    }
  })
}

async function deleteOrder(orderId, userId, openid, adminCode) {
  const id = String(orderId || '').trim()
  if (!id) {
    throw appError('订单 ID 无效', 'invalid-order-id')
  }

  const result = await orders.where({ id }).limit(1).get()
  const doc = result.data[0]
  if (!doc) {
    throw appError('订单不存在或已被删除', 'order-not-found')
  }

  const userIdText = String(userId || '').trim()
  const allowed = await hasAdminAccess(openid, adminCode) || !doc.userId || doc.userId === userIdText
  if (!allowed) {
    throw appError('无权限删除该订单', 'permission-denied')
  }

  const removeResult = await orders.doc(doc._id).remove()
  if (removeResult.stats && removeResult.stats.removed === 0) {
    throw appError('订单不存在或已被删除', 'order-not-found')
  }
}

async function deleteOrdersByItemName(itemName, adminCode, userId) {
  if (adminCode !== 'admin') {
    throw appError('无权限删除订单', 'permission-denied')
  }

  const name = String(itemName || '').trim()
  if (!name) {
    throw appError('商品名称无效', 'invalid-product-name')
  }

  const userIdText = String(userId || '').trim()
  let removed = 0

  while (true) {
    const query = userIdText ? orders.where({ userId: userIdText }) : orders
    const result = await query.limit(100).get()
    const matched = result.data.filter(order => {
      return (order.items || []).some(item => String(item.name || '').trim() === name)
    })

    if (!matched.length) break

    await Promise.all(matched.map(order => orders.doc(order._id).remove()))
    removed += matched.length

    if (result.data.length < 100) break
  }

  return { removed }
}

async function updateOrderStatus(orderId, status, openid, adminCode) {
  if (!(await hasAdminAccess(openid, adminCode))) {
    throw appError('无权限完成订单', 'permission-denied')
  }

  const allowed = ['pending', 'done']
  const nextStatus = allowed.includes(status) ? status : 'pending'
  const id = String(orderId || '').trim()
  if (!id) {
    throw appError('订单 ID 无效', 'invalid-order-id')
  }

  const result = await orders.where({ id }).limit(1).get()
  const doc = result.data[0]

  if (!doc) {
    throw appError('订单不存在或已被删除', 'order-not-found')
  }

  const updateData = {
    status: nextStatus,
    remindCount: nextStatus === 'done' ? 0 : Number(doc.remindCount || 0),
    remindedAt: nextStatus === 'done' ? 0 : Number(doc.remindedAt || 0),
    updatedAt: Date.now()
  }

  await orders.doc(doc._id).update({ data: updateData })

  if (nextStatus === 'done' && doc.status !== 'done') {
    const notifyResult = await notifyOrderDone({
      ...doc,
      ...updateData
    })
    await orders.doc(doc._id).update({
      data: {
        doneNotifyStatus: notifyResult.ok ? 'sent' : 'failed',
        doneNotifyError: notifyResult.ok ? '' : notifyResult.error,
        doneNotifyTemplateId: notifyResult.templateId || String(doc.doneNotifyTemplateId || ''),
        doneNotifiedAt: Date.now()
      }
    })
  }
}

async function notifyOrderDone(order) {
  const templateId = String(order.doneNotifyTemplateId || process.env.ORDER_DONE_NOTIFY_TEMPLATE_ID || DEFAULT_ORDER_DONE_NOTIFY_TEMPLATE_ID).trim()
  if (!templateId || templateId === 'YOUR_ORDER_DONE_NOTIFY_TEMPLATE_ID') {
    return { ok: false, templateId, error: '订单完成通知模板未配置' }
  }

  const touser = String(order.createdBy || '').trim()
  if (!touser) {
    return { ok: false, templateId, error: '订单缺少用户 openid' }
  }

  const candidates = buildOrderDoneNotificationCandidates(order)
  let lastError = ''
  let lastData = null

  for (const data of candidates) {
    lastData = data
    try {
      await cloud.openapi.subscribeMessage.send({
        touser,
        templateId,
        page: process.env.ORDER_DONE_NOTIFY_PAGE || 'pages/orders/orders',
        data
      })
      return { ok: true, templateId, data }
    } catch (error) {
      lastError = String(error && (error.errCode || error.errMsg || error.message || error))
      console.error('send order done notification failed:', {
        touser,
        templateId,
        orderId: order.id,
        data,
        error: lastError
      })
      if (!lastError.includes('47003')) break
    }
  }

  return { ok: false, templateId, data: lastData, error: lastError || '发送完成通知失败' }
}

function buildOrderDoneNotificationCandidates(order = {}) {
  const orderNo = limitNotifyText(order.id || '订单', 32)
  const createdAt = formatNotifyTime(order.createdAt || Date.now())
  const doneAt = formatNotifyTime(order.updatedAt || Date.now())
  const title = limitNotifyText(orderItemsTitle(order), 20)

  return [
    {
      character_string1: {
        value: orderNo
      },
      time2: {
        value: createdAt
      },
      time3: {
        value: doneAt
      },
      thing4: {
        value: title
      }
    },
    {
      character_string2: {
        value: orderNo
      },
      time4: {
        value: createdAt
      },
      date7: {
        value: doneAt
      },
      thing6: {
        value: title
      }
    },
    {
      character_string3: {
        value: orderNo
      },
      time7: {
        value: createdAt
      },
      time8: {
        value: doneAt
      },
      thing6: {
        value: title
      }
    }
  ]
}

function buildOrderDoneNotificationData(order = {}) {
  return buildOrderDoneNotificationCandidates(order)[0]
}

function normalizeDocId(item) {
  const { _id, ...rest } = item
  return {
    ...rest,
    id: rest.id || _id
  }
}

function ok(data) {
  return {
    ok: true,
    data
  }
}

function fail(message, code = 'server-error') {
  return {
    ok: false,
    code,
    message
  }
}
