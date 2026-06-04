<template>
  <view class="page" :class="{ manager: isManager }">
    <view class="top-bar">
      <view class="home-mini" v-if="!isManager" @click="goHome">‹ 首页</view>
      <view>
        <text class="store-label">Corn's Menu</text>
        <text class="top-title">{{ isManager ? '商品管理' : '今天想喝什么' }}</text>
        <text class="top-subtitle">{{ isManager ? '添加、编辑和整理常点商品。' : '选好喜欢的，放进购物车。' }}</text>
      </view>
    </view>

    <view class="search-bar">
      <text class="search-icon">⌕</text>
      <input
        class="search-input"
        v-model="search"
        placeholder="搜索商品名称"
        placeholder-class="placeholder"
        maxlength="20"
      />
      <text class="clear-search" v-if="search" @click="clearSearch">×</text>
    </view>

    <scroll-view class="tabs" scroll-x :show-scrollbar="false">
      <view
        v-for="(tab, index) in categories"
        :key="tab"
        class="tab-item"
        :class="{ active: activeTab === index }"
        @click="activeTab = index"
      >
        <text>{{ tab }}</text>
      </view>
    </scroll-view>

    <view class="product-list">
      <view class="product-grid" v-if="filteredList.length">
        <view
          class="product-card"
          :class="[`theme-${item.category}`, { flipping: flippingProductId === item.id }]"
          v-for="item in filteredList"
          :key="item.id"
          :data-id="item.id"
          @tap="handleProductTap"
        >
          <view class="product-flip">
            <view class="product-face product-front">
              <view class="stamp-ring">
                <view class="stamp-mark">
                  <text>Corn's Menu</text>
                  <text>{{ stampCategoryText(item) }}</text>
                </view>
                <view class="product-cutout">
                  <image class="product-image" v-if="item.imageUrl" :src="item.imageUrl" mode="aspectFit" />
                  <text class="product-icon" v-else>{{ productFallbackText(item) }}</text>
                </view>
              </view>
              <text class="product-name">{{ item.name }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="empty-state" v-else-if="searchKeyword">
        <view class="empty-icon">⌕</view>
        <text class="empty-title">没有找到商品</text>
        <text class="empty-desc">换个关键词，或者清空搜索看看。</text>
        <view class="empty-add-btn" @tap="clearSearch">清空搜索</view>
      </view>

      <view class="empty-state" v-else>
        <view class="empty-icon">+</view>
        <text class="empty-title">这个分类还没有商品</text>
        <text class="empty-desc">点击右下角按钮，添加第一件商品。</text>
      </view>
    </view>

    <view class="floating-add" @click="openAddModal">+</view>

    <view class="cart-bar" v-if="canOrder && cart.length">
      <view class="cart-left" @click="showCartDetail = !showCartDetail">
        <view class="cart-icon-wrap">
          <text class="cart-icon">单</text>
          <text class="cart-badge">{{ cartCount }}</text>
        </view>
        <view class="cart-total">
          <text class="total-price">{{ cartCount }} 件</text>
          <text class="total-label">查看已选商品</text>
        </view>
      </view>
      <view class="checkout-btn" :class="{ disabled: isCheckingOut }" @click="handleCheckout">
        {{ isCheckingOut ? '提交中' : '下单' }}
      </view>
    </view>

    <view class="empty-cart" v-if="canOrder && !isManager && !cart.length">
      <text class="empty-text">购物车为空</text>
    </view>

    <view class="cart-detail-overlay show" v-if="canOrder && showCartDetail" @tap="showCartDetail = false">
      <view class="cart-detail" @tap.stop>
        <view class="cart-detail-header">
          <view>
            <text class="cart-detail-title">购物车</text>
            <text class="cart-detail-sub">{{ cartCount }} 件已选</text>
          </view>
          <view class="cart-header-actions">
            <text class="clear-btn" @tap="clearCart">清空</text>
            <text class="cart-close-btn" @tap="showCartDetail = false">×</text>
          </view>
        </view>
        <scroll-view class="cart-items" scroll-y>
          <view class="cart-item" v-for="item in cart" :key="cartItemKey(item)">
            <image class="cart-item-image" v-if="item.imageUrl" :src="item.imageUrl" mode="aspectFill" />
            <text class="cart-item-icon" v-else>{{ productFallbackText(item) }}</text>
            <view class="cart-item-info">
              <text class="cart-item-name">{{ displayCartName(item) }}</text>
              <text class="cart-item-price">{{ displayCartMeta(item) }}</text>
            </view>
            <view class="cart-item-qty">
              <view class="qty-btn" @click="decrease(item)">−</view>
              <text class="qty-num">{{ displayCartCount(item) }}</text>
              <view class="qty-btn plus" @click="addToCart(item)">+</view>
            </view>
          </view>
        </scroll-view>
        <view class="note-field">
          <text class="note-label">备注</text>
          <input
            class="note-input"
            v-model="orderNote"
            placeholder="例：少冰、今天想喝热的"
            placeholder-class="placeholder"
            maxlength="32"
            always-embed="true"
          />
        </view>
      </view>
    </view>

    <block v-if="showAddModal">
    <view class="add-overlay show" @tap="closeAddModal">
      <view class="add-modal" @tap.stop>
        <view class="add-modal-header">
          <view>
            <text class="add-modal-title">{{ editingProductId ? '编辑商品' : '添加商品' }}</text>
            <text class="add-modal-sub">{{ editingProductId ? '把信息改准确一点。' : '拍照识别后确认，再保存入库。' }}</text>
          </view>
          <view class="add-header-actions">
            <text class="scan-btn cover" @tap="chooseProductImage">封面</text>
            <text class="scan-btn" :class="{ loading: isRecognizing || isBatchRecognizing }" @tap="chooseAndRecognizeAny">
              {{ isRecognizing || isBatchRecognizing ? '识别中' : '识图' }}
            </text>
            <text class="add-modal-close" @tap="closeAddModal">×</text>
          </view>
        </view>

        <view class="add-form">
          <view class="recognition-card" v-if="recognitionText">
            <text class="recognition-title">识别结果</text>
            <text class="recognition-desc">{{ recognitionText }}</text>
          </view>

          <view class="add-field">
            <text class="add-label">分类</text>
            <view class="category-picker">
              <text
                v-for="(category, index) in categories"
                :key="category"
                class="category-option"
                :class="{ selected: addCategory === index }"
                @click="selectAddCategory(index)"
              >{{ category }}</text>
            </view>
          </view>

          <view class="add-field">
            <text class="add-label">商品名称</text>
            <input class="add-input" v-model="addName" placeholder="例：冰美式" placeholder-class="placeholder" maxlength="16" always-embed="true" />
          </view>
          <view class="add-field">
            <text class="add-label">品牌</text>
            <scroll-view class="brand-scroll" scroll-x :show-scrollbar="false">
              <view class="brand-row">
                <text
                  v-for="brand in brandOptions"
                  :key="brand"
                  class="brand-option"
                  :class="{ selected: addBrand === brand }"
                  @click="addBrand = brand"
                >{{ brand }}</text>
              </view>
            </scroll-view>
            <input
              v-if="addBrand === '自定义'"
              class="add-input brand-input"
              v-model="customBrand"
              placeholder="输入品牌名称"
              placeholder-class="placeholder"
              maxlength="16"
              always-embed="true"
            />
          </view>
          <view class="add-field" v-if="showSugarField">
            <text class="add-label">默认糖度</text>
            <view class="sugar-picker">
              <text
                v-for="sugar in sugarOptions"
                :key="sugar"
                class="sugar-option"
                :class="{ selected: addDefaultSugar === sugar }"
                @click="addDefaultSugar = sugar"
              >{{ sugar }}</text>
            </view>
          </view>
          <view class="add-field">
            <text class="add-label">描述</text>
            <input class="add-input" v-model="addDesc" placeholder="例：少冰、三分糖" placeholder-class="placeholder" maxlength="28" always-embed="true" />
          </view>

          <view class="cover-chip" v-if="addImageUrl" @click="chooseProductImage">
            <image class="cover-chip-image" :src="addImageUrl" mode="aspectFill" />
            <text class="cover-chip-text">已设置封面</text>
          </view>

          <view class="add-actions">
            <view class="add-cancel" @click="closeAddModal">取消</view>
            <view class="add-confirm" v-if="editingProductId" @click="saveGoods">保存修改</view>
            <view class="add-confirm" v-else @click="saveGoods">确认添加</view>
          </view>
        </view>
      </view>
    </view>
    </block>

    <block v-if="showDetailModal && detailItem">
    <view class="detail-overlay" :class="{ show: detailModalReady }" @tap="closeDetail">
      <view class="detail-modal" @tap.stop>
        <view class="detail-modal-header">
          <text class="detail-modal-close" @tap="closeDetail">×</text>
        </view>
        <view class="detail-body" v-if="detailItem">
          <text class="detail-name">{{ detailItem.name }}</text>
          <text class="detail-brand" v-if="detailItem.brand && detailItem.brand !== '自定义'">{{ detailItem.brand }}</text>
          <text class="detail-desc">{{ detailItem.desc }}</text>
          <view class="detail-options" v-if="!isManager && detailNeedsOptions">
            <view class="detail-option-group">
              <text class="detail-option-title">甜度</text>
              <view class="detail-option-row">
                <text
                  v-for="sugar in sugarOptions"
                  :key="sugar"
                  class="detail-option"
                  :class="{ selected: detailSugar === sugar }"
                @tap="detailSugar = sugar"
                >{{ sugar }}</text>
              </view>
            </view>
            <view class="detail-option-group">
              <text class="detail-option-title">大小杯</text>
              <view class="detail-option-row">
                <text
                  v-for="size in sizeOptions"
                  :key="size"
                  class="detail-option"
                  :class="{ selected: detailSize === size }"
                @tap="detailSize = size"
                >{{ size }}</text>
              </view>
            </view>
            <view class="detail-option-group">
              <text class="detail-option-title">小料</text>
              <view class="detail-option-row">
                <text
                  v-for="topping in toppingOptions"
                  :key="topping"
                  class="detail-option"
                  :class="{ selected: detailTopping === topping }"
                  @tap="detailTopping = topping"
                >{{ topping }}</text>
              </view>
              <input
                class="detail-custom-input"
                v-if="detailTopping === '自定义'"
                v-model="detailCustomTopping"
                placeholder="输入想加的小料"
                placeholder-class="placeholder"
                maxlength="12"
                always-embed="true"
              />
            </view>
          </view>
          <view class="detail-actions">
            <view class="detail-delete-btn" @tap="deleteDetailProduct">删除</view>
            <view class="detail-edit-btn" @tap="editDetailProduct">编辑</view>
            <view class="detail-cart-btn" v-if="!isManager" @tap="addDetailToCart">加入购物车</view>
          </view>
        </view>
      </view>
    </view>
    </block>
    <BottomNav active="order" />
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import BottomNav from '../../components/BottomNav.vue'
import { ORDER_DONE_NOTIFY_TEMPLATE_ID } from '../../config/cloud'
import {
  addOrder,
  addProduct,
  createSmartCover,
  deleteProduct,
  getErrorMessage,
  listProducts,
  recognizeMenuImages,
  recognizeProductImage,
  uploadProductImage,
  updateProduct
} from '../../utils/menuApi'
import { getSession, isAdmin } from '../../utils/auth'

const categories = ['咖啡', '果茶', '奶茶', '便利店', '其他']

const icons = ['咖', '果', '奶', '便', '其', '茶', '甜']
const search = ref('')
const activeTab = ref(0)
const showCartDetail = ref(false)
const showAddModal = ref(false)
const showDetailModal = ref(false)
const detailModalReady = ref(false)
const flippingProductId = ref('')
const cart = ref([])
const menuItems = ref([])
const detailItem = ref(null)
const detailSugar = ref('')
const detailSize = ref('')
const detailTopping = ref('无小料')
const detailCustomTopping = ref('')
const orderNote = ref('')
const isCheckingOut = ref(false)

const addName = ref('')
const addPrice = ref('')
const addDesc = ref('')
const addIcon = ref('咖')
const addImageUrl = ref('')
const addBrand = ref('自定义')
const customBrand = ref('')
const addDefaultSugar = ref('五分糖')
const addCategory = ref(0)
const editingProductId = ref('')
const isRecognizing = ref(false)
const isBatchRecognizing = ref(false)
const recognitionText = ref('')
const recognitionTaskId = ref(0)
const isManager = ref(false)
const activeAccount = ref('')
const canOrder = computed(() => !isManager.value)

const searchKeyword = computed(() => cleanRecognizedText(search.value, 20).toLowerCase())

onShow(() => {
  const session = getSession()
  if (!session) {
    uni.reLaunch({ url: '/pages/index/index' })
    return
  }
  const accountKey = session.userId || session.account
  if (activeAccount.value && activeAccount.value !== accountKey) {
    resetRuntimeState()
  }
  activeAccount.value = accountKey
  isManager.value = isAdmin()
  if (!canOrder.value) {
    cart.value = []
    orderNote.value = ''
    showCartDetail.value = false
  }
  loadProducts()
})

const filteredList = computed(() => {
  const keyword = searchKeyword.value
  return normalizeProductList(menuItems.value).filter(item => {
    const matchedCategory = keyword || item.category === activeTab.value
    const searchable = [
      item.name,
      item.desc,
      item.brand,
      stampCategoryText(item)
    ].map(value => cleanRecognizedText(value, 40).toLowerCase()).join(' ')
    const matchedKeyword = !keyword || searchable.includes(keyword)
    return matchedCategory && matchedKeyword
  })
})

const cartCount = computed(() => cart.value.reduce((sum, item) => sum + safeCount(item && item.count), 0))
function safeCount(value) {
  const count = Number(value)
  return Number.isFinite(count) && count > 0 ? Math.max(1, Math.round(count)) : 1
}

function normalizeCartItem(item = {}, productMap = null) {
  if (!item || typeof item !== 'object') return null
  const id = cleanRecognizedText(item.id, 80)
  if (!id) return null

  const matched = productMap && productMap.get(id)
  const source = matched ? { ...item, ...matched, sugar: item.sugar, count: item.count } : item
  const name = cleanRecognizedText(source.name, 24)
  if (!name) return null

  return {
    ...source,
    id,
    name,
    brand: cleanRecognizedText(source.brand, 16) || '自定义',
    desc: cleanRecognizedText(source.desc, 28) || '暂无描述',
    icon: cleanRecognizedText(source.icon, 1) || icons[clampCategory(source.category)] || '其',
    imageUrl: normalizeCoverUrl(source.imageUrl),
    sugar: cleanRecognizedText(source.sugar, 40),
    category: clampCategory(source.category),
    price: Number(source.price || 0),
    count: safeCount(source.count)
  }
}

function displayCartName(item) {
  return cleanRecognizedText(item && item.name, 24) || '未命名商品'
}

function displayCartMeta(item) {
  return cleanRecognizedText(item && item.sugar, 40) ||
    cleanRecognizedText(item && item.brand, 16) ||
    '已选'
}

function displayCartCount(item) {
  return safeCount(item && item.count)
}

function productFallbackText(item = {}) {
  const text = String(
    (item.brand && item.brand !== '自定义' ? item.brand : '') ||
    item.name ||
    item.icon ||
    '饮'
  ).trim()
  return text.slice(0, 2)
}

function stampBrand(item = {}) {
  const brand = String(item.brand && item.brand !== '自定义' ? item.brand : 'Corn Menu').trim()
  return brand.toUpperCase().slice(0, 18)
}

function stampCategoryText(item = {}) {
  const category = categories[Number(item.category || 0)]
  return category || '想喝'
}

async function loadProducts() {
  try {
    menuItems.value = normalizeProductList(await listProducts())
    pruneCartItems()
    applyPendingReorder()
  } catch (error) {
    cart.value = []
    uni.showToast({ title: getErrorMessage(error, '商品加载失败'), icon: 'none' })
  }
}

function normalizeProductList(products = []) {
  const seen = new Set()
  return (Array.isArray(products) ? products : [])
    .map(raw => {
      const item = raw && typeof raw === 'object' ? raw : {}
      const category = clampCategory(item.category)
      return {
        ...item,
        id: cleanRecognizedText(item.id, 80) || `local-${cleanRecognizedText(item.name, 24)}-${category}`,
        name: cleanRecognizedText(item.name, 24),
        brand: cleanRecognizedText(item.brand, 16) || '自定义',
        desc: cleanRecognizedText(item.desc, 28) || '暂无描述',
        icon: cleanRecognizedText(item.icon, 1) || icons[category] || '其',
        imageUrl: normalizeCoverUrl(item.imageUrl),
        category,
        price: Number(item.price || 0) > 0 ? Number(item.price) : 1
      }
    })
    .filter(item => item.id && item.name)
    .filter(item => {
      const key = item.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function pruneCartItems() {
  const productMap = new Map(menuItems.value.map(item => [item.id, item]))
  cart.value = cart.value
    .map(item => normalizeCartItem(item, productMap))
    .filter(item => item && productMap.has(item.id))
  if (!cart.value.length) {
    showCartDetail.value = false
  }
}

function reorderKey() {
  const session = getSession()
  return `cornMenuPendingReorder:${session?.userId || session?.account || 'guest'}`
}

function applyPendingReorder() {
  if (!canOrder.value) return
  const pendingItems = uni.getStorageSync(reorderKey()) || []
  if (!Array.isArray(pendingItems) || !pendingItems.length) return

  const productMap = new Map(menuItems.value.map(item => [item.id, item]))
  pendingItems.forEach(item => {
    const product = normalizeCartItem(item, productMap)
    if (!product || !productMap.has(product.id)) return
    const count = safeCount(item.count)
    const found = cart.value.find(cartItem => cartItemKey(cartItem) === cartItemKey(product))
    if (found) {
      found.count = safeCount(found.count) + count
    } else {
      cart.value.push({
        ...product,
        count
      })
    }
  })
  uni.removeStorageSync(reorderKey())
  uni.showToast({ title: '已加入购物车', icon: 'none' })
}

const brandOptions = ['自定义', '瑞幸', '星巴克', '喜茶', '奈雪的茶', '古茗', '茶百道', '霸王茶姬', '沪上阿姨', '蜜雪冰城', 'CoCo', '一点点', '乐事', '奥利奥', '可口可乐']
const sugarOptions = ['正常糖', '七分糖', '五分糖', '三分糖', '无糖']
const sizeOptions = ['中杯', '大杯', '小杯']
const toppingOptions = ['无小料', '珍珠', '椰果', '奶盖', '芋圆', '自定义']
const sugarCategorySet = new Set([0, 1, 2])
const showSugarField = computed(() => sugarCategorySet.has(Number(addCategory.value || 0)))
const detailNeedsOptions = computed(() => detailItem.value && sugarCategorySet.has(Number(detailItem.value.category || 0)))

function cartItemKey(item) {
  return `${cleanRecognizedText(item && item.id, 80)}:${cleanRecognizedText(item && item.sugar, 40)}`
}

function needSugar(item) {
  return sugarCategorySet.has(Number(item.category || 0))
}

function selectSugar() {
  return new Promise((resolve, reject) => {
    uni.showActionSheet({
      itemList: sugarOptions,
      success: (res) => resolve(sugarOptions[res.tapIndex] || sugarOptions[0]),
      fail: reject
    })
  })
}

async function addToCart(item) {
  if (!canOrder.value) {
    uni.showToast({ title: '管理员不需要下单', icon: 'none' })
    return
  }
  const normalized = normalizeCartItem(item && typeof item === 'object' ? { ...item, count: 1 } : null)
  if (!normalized) {
    uni.showToast({ title: '这个商品信息不完整，请重新添加', icon: 'none' })
    return
  }

  let sugar = normalized.sugar || ''
  if (needSugar(normalized) && !sugar) {
    try {
      sugar = await selectSugar()
    } catch (error) {
      return
    }
  }

  const nextItem = {
    ...normalized,
    sugar
  }
  const key = cartItemKey(nextItem)
  const found = cart.value.find(cartItem => cartItemKey(cartItem) === key)
  if (found) {
    found.count = safeCount(found.count) + 1
  } else {
    cart.value.push({ ...nextItem, count: 1 })
  }
}

function decrease(item) {
  const found = cart.value.find(cartItem => cartItemKey(cartItem) === cartItemKey(item))
  if (!found) return
  found.count = safeCount(found.count) - 1
  if (found.count <= 0) {
    cart.value = cart.value.filter(cartItem => cartItemKey(cartItem) !== cartItemKey(item))
  }
}

function clearCart() {
  cart.value = []
  showCartDetail.value = false
}

async function handleCheckout() {
  if (!canOrder.value) {
    uni.showToast({ title: '管理员不需要下单', icon: 'none' })
    return
  }
  if (isCheckingOut.value) return
  pruneCartItems()
  if (!cart.value.length) return
  isCheckingOut.value = true

  const order = {
    id: `order-${Date.now()}`,
    items: cart.value
      .map(item => normalizeCartItem(item))
      .filter(Boolean)
      .map(item => ({
        id: item.id,
        name: item.name,
        icon: item.icon,
        imageUrl: item.imageUrl || '',
        brand: item.brand || '',
        desc: item.desc || '',
        note: item.note || '',
        remark: item.remark || '',
        category: item.category,
        sugar: item.sugar || '',
        price: Number(item.price || 0),
        count: item.count
      })),
    totalPrice: 0,
    totalCount: cartCount.value,
    note: cleanOrderNote(orderNote.value),
    doneNotifyTemplateId: ORDER_DONE_NOTIFY_TEMPLATE_ID,
    status: 'pending',
    createdAt: Date.now()
  }

  try {
    const acceptedDoneNotify = await requestOrderDoneSubscribe()
    if (!acceptedDoneNotify) {
      uni.showToast({ title: '未开启完成通知，订单仍会提交', icon: 'none' })
    }
    await addOrder(order)
    cart.value = []
    orderNote.value = ''
    showCartDetail.value = false
    uni.showToast({ title: '下单成功', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: getErrorMessage(error, '下单失败，请稍后重试'), icon: 'none' })
  } finally {
    isCheckingOut.value = false
  }
}

async function requestOrderDoneSubscribe() {
  if (
    !ORDER_DONE_NOTIFY_TEMPLATE_ID ||
    ORDER_DONE_NOTIFY_TEMPLATE_ID === 'YOUR_ORDER_DONE_NOTIFY_TEMPLATE_ID' ||
    typeof wx === 'undefined' ||
    !wx.requestSubscribeMessage
  ) {
    return
  }

  try {
    const requestSubscribeMessage = uni.requestSubscribeMessage || wx.requestSubscribeMessage
    return await withTimeout(new Promise((resolve, reject) => {
      requestSubscribeMessage({
        tmplIds: [ORDER_DONE_NOTIFY_TEMPLATE_ID],
        success: (res) => resolve(res[ORDER_DONE_NOTIFY_TEMPLATE_ID] === 'accept'),
        fail: reject
      })
    }), 8000, '订单完成通知授权超时')
  } catch (error) {
    console.error('request order done subscribe failed:', error)
    return false
  }
}

function openAddModal() {
  dismissInputs()
  showCartDetail.value = false
  showDetailModal.value = false
  detailItem.value = null
  editingProductId.value = ''
  addCategory.value = activeTab.value
  addName.value = ''
  addPrice.value = ''
  addDesc.value = ''
  addImageUrl.value = ''
  addBrand.value = '自定义'
  customBrand.value = ''
  addDefaultSugar.value = sugarOptions[2]
  addIcon.value = icons[addCategory.value] || '其'
  recognitionText.value = ''
  showAddModal.value = true
}

function closeAddModal() {
  dismissInputs()
  recognitionTaskId.value += 1
  showAddModal.value = false
  isRecognizing.value = false
  isBatchRecognizing.value = false
  uni.hideLoading()
}

function clearSearch() {
  search.value = ''
  dismissInputs()
}

function goHome() {
  uni.redirectTo({ url: '/pages/home/home' })
}

function openEditModal(item) {
  editingProductId.value = item.id
  addCategory.value = Number(item.category || 0)
  activeTab.value = addCategory.value
  addName.value = item.name
  addPrice.value = String(item.price)
  addDesc.value = item.desc
  addIcon.value = item.icon
  addImageUrl.value = item.imageUrl || ''
  setBrandForEdit(item.brand || '')
  addDefaultSugar.value = item.defaultSugar || sugarOptions[2]
  showAddModal.value = true
}

function setBrandForEdit(brand) {
  if (brand && brandOptions.includes(brand)) {
    addBrand.value = brand
    customBrand.value = ''
    return
  }
  addBrand.value = '自定义'
  customBrand.value = brand === '自定义' ? '' : brand
}

function resolveBrand() {
  if (addBrand.value !== '自定义') {
    return addBrand.value
  }
  return cleanRecognizedText(customBrand.value, 16) || '自定义'
}

function chooseProductImage() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      addImageUrl.value = res.tempFilePaths[0] || ''
    }
  })
}

function chooseAndRecognizeProduct() {
  if (isRecognizing.value) return

  uni.showActionSheet({
    itemList: ['拍照识别', '从相册识别'],
    success: (action) => {
      const sourceType = action.tapIndex === 0 ? ['camera'] : ['album']
      chooseImageForRecognition(sourceType)
    }
  })
}

function chooseAndRecognizeAny() {
  if (isBatchRecognizing.value || isRecognizing.value) return

  uni.chooseImage({
    count: 9,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const filePaths = res.tempFilePaths || []
      if (!filePaths.length) return
      if (filePaths.length === 1) {
        await recognizeSingleFile(filePaths[0])
        return
      }

      const taskId = recognitionTaskId.value + 1
      recognitionTaskId.value = taskId
      isBatchRecognizing.value = true
      recognitionText.value = ''
      uni.showLoading({ title: '批量识别中' })

      try {
        const fileIDs = []
        for (const filePath of filePaths) {
          fileIDs.push(await withTimeout(uploadProductImage(filePath), 20000, '图片上传超时，请重试'))
        }
        const products = await withTimeout(recognizeMenuImagesInChunks(fileIDs, 3), 60000, '批量识别超时，请减少图片数量')
        if (taskId !== recognitionTaskId.value || !showAddModal.value) return
        await confirmAndSaveRecognizedProducts(products)
      } catch (error) {
        uni.showToast({ title: getErrorMessage(error, '批量识别失败'), icon: 'none' })
      } finally {
        if (taskId === recognitionTaskId.value) {
          isBatchRecognizing.value = false
        }
        uni.hideLoading()
      }
    }
  })
}

function chooseAndRecognizeMenuImages() {
  chooseAndRecognizeAny()
}

async function recognizeSingleFile(filePath) {
  const taskId = recognitionTaskId.value + 1
  recognitionTaskId.value = taskId
  recognitionText.value = ''
  isRecognizing.value = true
  uni.showLoading({ title: '识别商品' })

  try {
    const cloudFileID = await withTimeout(uploadProductImage(filePath), 20000, '图片上传超时，请重试')
    const result = await withTimeout(recognizeProductImage(cloudFileID), 45000, '识别超时，请换一张更清晰的图')
    if (taskId !== recognitionTaskId.value || !showAddModal.value) return
    const applied = applyRecognizedProduct(result)
    if (applied) {
      uni.showToast({ title: '已自动填写', icon: 'success' })
    } else {
      recognitionText.value = ''
      uni.showToast({ title: '没识别到商品，请换图或手动填写', icon: 'none' })
    }
  } catch (error) {
    uni.showToast({ title: getErrorMessage(error, '识别失败，请手动填写'), icon: 'none' })
  } finally {
    if (taskId === recognitionTaskId.value) {
      isRecognizing.value = false
    }
    uni.hideLoading()
  }
}

function withTimeout(promise, duration, message) {
  return Promise.race([
    promise,
    new Promise((resolve, reject) => {
      setTimeout(() => reject(new Error(message)), duration)
    })
  ])
}

async function recognizeMenuImagesInChunks(fileIDs = [], chunkSize = 3) {
  const allProducts = []
  for (let index = 0; index < fileIDs.length; index += chunkSize) {
    const chunk = fileIDs.slice(index, index + chunkSize)
    const products = await recognizeMenuImages(chunk)
    allProducts.push(...products.map(product => ({
      ...product,
      imageUrl: product.imageUrl || ''
    })))
  }
  return dedupeRecognizedProducts(allProducts)
}

function dedupeRecognizedProducts(products = []) {
  const seen = new Set()
  return products.filter(item => {
    const key = [
      cleanRecognizedText(item.name, 24),
      cleanRecognizedText(item.brand, 16),
      Number(item.category || 0)
    ].join('|')
    if (!key.trim() || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function confirmAndSaveRecognizedProducts(products = []) {
  const normalized = products
    .map(item => normalizeBatchProduct(item))
    .filter(item => item.name)

  if (!normalized.length) {
    uni.showToast({ title: '未识别到可添加商品', icon: 'none' })
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    uni.showModal({
      title: '批量添加商品',
      content: `识别到 ${products.length} 个，${normalized.length} 个可直接添加。是否确认入库？`,
      confirmText: '添加',
      success: async (res) => {
        if (!res.confirm) {
          resolve()
          return
        }

        uni.showLoading({ title: '正在添加' })
        let successCount = 0
        for (const product of normalized) {
          try {
            const saved = await addProduct({
              ...product,
              id: `goods-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              createdAt: Date.now()
            })
            const normalizedSaved = normalizeProductList([saved])[0]
            menuItems.value = [normalizedSaved || saved, ...menuItems.value.filter(item => item.id !== saved.id)]
            successCount += 1
          } catch (error) {
          }
        }
        uni.hideLoading()
        if (successCount > 0) {
          activeTab.value = Number(normalized[0].category || 0)
          showAddModal.value = false
          uni.showToast({ title: `已添加 ${successCount} 个`, icon: 'success' })
        } else {
          uni.showToast({ title: '添加失败，请重试', icon: 'none' })
        }
        resolve()
      },
      fail: () => resolve()
    })
  })
}

function normalizeBatchProduct(item = {}) {
  const category = clampCategory(item.category)
  const desc = cleanRecognizedText(item.desc, 28) ||
    [item.flavor, item.defaultSugar, item.toppings, item.size]
      .map(value => cleanRecognizedText(value, 12))
      .filter(Boolean)
      .join('、') ||
    '暂无描述'
  return {
    category,
    icon: cleanRecognizedText(item.icon, 1) || icons[category] || '其',
    imageUrl: normalizeCoverUrl(item.imageUrl),
    brand: cleanRecognizedText(item.brand, 16) || '自定义',
    defaultSugar: sugarCategorySet.has(category) ? cleanRecognizedText(item.defaultSugar, 8) : '',
    name: cleanRecognizedText(item.name, 16),
    price: Number(item.price || 0) > 0 ? Number(item.price) : 1,
    desc: desc.slice(0, 28) || '暂无描述'
  }
}

function chooseImageForRecognition(sourceType) {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType,
    success: async (res) => {
      const filePath = res.tempFilePaths[0] || ''
      if (!filePath) return
      await recognizeSingleFile(filePath)
    }
  })
}

function clampCategory(category) {
  const index = Number(category)
  if (!Number.isFinite(index)) return addCategory.value
  return Math.max(0, Math.min(categories.length - 1, Math.round(index)))
}

function setBrandValue(brand) {
  const brandText = cleanRecognizedText(brand, 16)
  if (!brandText) return
  if (brandOptions.includes(brandText)) {
    addBrand.value = brandText
    customBrand.value = ''
  } else {
    addBrand.value = '自定义'
    customBrand.value = brandText
  }
}

function cleanRecognizedText(value, maxLength = 28) {
  if (value === null || value === undefined || typeof value === 'boolean') return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (Array.isArray(value)) {
    return value
      .map(item => cleanRecognizedText(item, maxLength))
      .filter(Boolean)
      .join('、')
      .slice(0, maxLength)
  }
  if (typeof value === 'object') {
    const keys = ['name', 'brand', 'text', 'value', 'label', 'title', 'desc', 'description']
    for (const key of keys) {
      const text = cleanRecognizedText(value[key], maxLength)
      if (text) return text
    }
    return ''
  }
  const text = String(value)
    .replace(/\[object Object\]/g, '')
    .replace(/^(true|false|null|undefined)$/i, '')
    .trim()
  if (isMachineToken(text)) return ''
  return text.slice(0, maxLength)
}

function normalizeCoverUrl(value) {
  const text = cleanRecognizedText(value, 300)
  if (!text) return ''
  return text.includes('smart-covers/') ? text : ''
}

function isMachineToken(text) {
  const value = String(text || '').trim()
  return /^[a-z]\d{1,3}_[a-z0-9]{1,8}$/i.test(value) ||
    /^e[0-9a-f]{1,4}_[0-9a-f]{1,6}$/i.test(value) ||
    /^[a-z]{1,3}_[a-z0-9]{1,8}$/i.test(value)
}

function cleanOrderNote(value) {
  const text = cleanRecognizedText(value, 32)
  if (!text) return ''
  if (/^[a-z]\d{1,3}_[a-z0-9]{1,8}$/i.test(text)) return ''
  if (/^[a-f0-9]{6,}$/i.test(text)) return ''
  return text
}

function applyRecognizedProduct(result = {}) {
  addCategory.value = clampCategory(result.category)
  activeTab.value = addCategory.value
  addIcon.value = cleanRecognizedText(result.icon, 1) || icons[addCategory.value] || '其'

  const name = cleanRecognizedText(result.name, 16)
  if (!name) return false
  addName.value = name.slice(0, 16)

  addPrice.value = Number(result.price || 0) > 0 ? String(result.price) : '1'
  const imageUrl = normalizeCoverUrl(result.imageUrl)
  if (imageUrl) addImageUrl.value = imageUrl

  const desc = cleanRecognizedText(result.desc, 28) ||
    [result.flavor, result.defaultSugar, result.toppings, result.size]
      .map(item => cleanRecognizedText(item, 12))
      .filter(Boolean)
      .join('、')
  if (desc) addDesc.value = desc.slice(0, 28)

  setBrandValue(result.brand)

  const sugar = cleanRecognizedText(result.defaultSugar, 8)
  if (sugar && sugarOptions.includes(sugar)) {
    addDefaultSugar.value = sugar
  }

  const specs = [result.brand, result.flavor, result.defaultSugar, result.toppings, result.size]
    .map(item => cleanRecognizedText(item, 16))
    .filter(Boolean)
  recognitionText.value = specs.length ? specs.join(' · ') : '已根据图片填入商品信息，请确认后保存。'
  return true
}

function cycleIcon() {
  const index = icons.indexOf(addIcon.value)
  addIcon.value = icons[(index + 1) % icons.length]
}

function selectAddCategory(index) {
  addCategory.value = index
  if (!editingProductId.value) {
    addIcon.value = icons[index] || '其'
  }
}

async function saveGoods() {
  const name = cleanRecognizedText(addName.value, 16)
  const price = Number(addPrice.value) || 1

  if (!name) {
    uni.showToast({ title: '请输入商品名称', icon: 'none' })
    return
  }

  try {
    const imageUrl = await resolveSmartCoverForSave(addImageUrl.value)
    if (addImageUrl.value && !imageUrl) {
      uni.showToast({ title: '封面抠图失败，请换张图重试', icon: 'none' })
      return
    }
    const payload = {
      id: editingProductId.value || `goods-${Date.now()}`,
      category: addCategory.value,
      icon: addIcon.value,
      imageUrl,
      brand: resolveBrand(),
      defaultSugar: showSugarField.value ? addDefaultSugar.value : '',
      name,
      price,
      desc: cleanRecognizedText(addDesc.value, 28) || '暂无描述',
      createdAt: Date.now()
    }
    const product = editingProductId.value
      ? await updateProduct(payload)
      : await addProduct(payload)
    const normalizedProduct = normalizeProductList([product])[0]

    menuItems.value = editingProductId.value
      ? menuItems.value.map(item => item.id === product.id ? (normalizedProduct || product) : item)
      : [normalizedProduct || product, ...menuItems.value.filter(item => item.id !== product.id)]
    cart.value = cart.value.map(item => item.id === product.id ? { ...(normalizedProduct || product), sugar: item.sugar, count: item.count } : item)
    activeTab.value = Number(product.category || 0)
    showAddModal.value = false
    editingProductId.value = ''
    addImageUrl.value = ''
    uni.showToast({ title: '保存成功', icon: 'success' })
  } catch (error) {
    uni.hideLoading()
    uni.showToast({ title: getErrorMessage(error, '保存失败，请稍后重试'), icon: 'none' })
  }
}

async function resolveSmartCoverForSave(value) {
  const source = String(value || '').trim()
  if (!source) return ''

  const existingCover = normalizeCoverUrl(source)
  if (existingCover) return existingCover

  uni.showLoading({ title: '生成封面' })
  try {
    const fileID = source.startsWith('cloud://') ? source : await uploadProductImage(source)
    const result = await createSmartCover(fileID)
    return normalizeCoverUrl(result && result.fileID)
  } finally {
    uni.hideLoading()
  }
}

function removeGoods(item) {
  uni.showModal({
    title: '删除商品',
    content: `确定删除「${item.name}」吗？`,
    confirmText: '删除',
    confirmColor: '#d95745',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await deleteProduct(item.id)
        menuItems.value = menuItems.value.filter(product => product.id !== item.id)
        cart.value = cart.value.filter(product => product.id !== item.id)
        uni.showToast({ title: '已删除', icon: 'none' })
      } catch (error) {
        uni.showToast({ title: getErrorMessage(error, '删除失败，请稍后重试'), icon: 'none' })
      }
    }
  })
}

function handleProductTap(event) {
  const productId = cleanRecognizedText(event?.currentTarget?.dataset?.id, 80)
  const item = menuItems.value.find(product => cleanRecognizedText(product.id, 80) === productId)
  showDetail(item)
}

function showDetail(item) {
  if (!item) return
  dismissInputs()
  showAddModal.value = false
  showCartDetail.value = false
  detailModalReady.value = false
  const productId = cleanRecognizedText(item && item.id, 80)
  flippingProductId.value = productId
  detailItem.value = item
  detailSugar.value = item.defaultSugar || sugarOptions[2]
  detailSize.value = '中杯'
  detailTopping.value = '无小料'
  detailCustomTopping.value = ''
  showDetailModal.value = true
  setTimeout(() => {
    detailModalReady.value = true
  }, 30)
  setTimeout(() => {
    flippingProductId.value = ''
  }, 260)
}

async function addDetailToCart() {
  if (!canOrder.value) return
  if (!detailItem.value) return
  const topping = detailTopping.value === '自定义'
    ? cleanRecognizedText(detailCustomTopping.value, 12)
    : detailTopping.value
  const specs = detailNeedsOptions.value
    ? [detailSugar.value, detailSize.value, topping === '无小料' ? '' : topping].filter(Boolean)
    : []
  await addToCart({
    ...detailItem.value,
    sugar: specs.join(' · ')
  })
  closeDetail()
}

function editDetailProduct() {
  if (!detailItem.value) return
  const item = detailItem.value
  closeDetail(true)
  openEditModal(item)
}

function deleteDetailProduct() {
  if (!detailItem.value) return
  const item = detailItem.value
  closeDetail(true)
  removeGoods(item)
}

function closeDetail(immediate = false) {
  dismissInputs()
  detailModalReady.value = false
  if (immediate) {
    showDetailModal.value = false
    detailItem.value = null
    detailSugar.value = ''
    detailSize.value = ''
    detailTopping.value = '无小料'
    detailCustomTopping.value = ''
    return
  }
  setTimeout(() => {
    showDetailModal.value = false
    detailItem.value = null
    detailSugar.value = ''
    detailSize.value = ''
    detailTopping.value = '无小料'
    detailCustomTopping.value = ''
  }, 180)
}

function resetRuntimeState() {
  search.value = ''
  activeTab.value = 0
  showCartDetail.value = false
  showAddModal.value = false
  showDetailModal.value = false
  detailModalReady.value = false
  flippingProductId.value = ''
  cart.value = []
  detailItem.value = null
  detailSugar.value = ''
  detailSize.value = ''
  detailTopping.value = '无小料'
  detailCustomTopping.value = ''
  orderNote.value = ''
  editingProductId.value = ''
  addImageUrl.value = ''
  addBrand.value = '自定义'
  customBrand.value = ''
  addDefaultSugar.value = sugarOptions[2]
  isRecognizing.value = false
  isBatchRecognizing.value = false
  recognitionText.value = ''
}

function dismissInputs() {
  try {
    uni.hideKeyboard()
  } catch (error) {
    // 某些运行时没有暴露 hideKeyboard，忽略即可。
  }
}
</script>

<style>
page {
  background: #F7F6F1;
}
</style>

<style scoped>
.page {
  min-height: 100vh;
  padding: 0 0 calc(210rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background: #F7F6F1;
  overflow: visible;
}

.page.manager {
  padding-bottom: calc(180rpx + env(safe-area-inset-bottom));
}

.top-bar {
  padding: 124rpx 32rpx 40rpx;
  background:
    radial-gradient(circle at 82% 0%, rgba(255, 214, 10, 0.18), transparent 34%),
    linear-gradient(180deg, #FAF9F4 0%, #F7F6F1 100%);
  display: flex;
  align-items: flex-start;
  color: #1D1D1F;
  position: relative;
}

.home-mini {
  position: absolute;
  left: 32rpx;
  top: 76rpx;
  height: 48rpx;
  padding: 0 18rpx;
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(60, 60, 67, 0.10);
  color: #A85F00;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 900;
  box-shadow: 0 8rpx 20rpx rgba(60, 60, 67, 0.08);
}

.store-label {
  display: block;
  font-size: 24rpx;
  font-weight: 800;
  color: #8E8E93;
  margin-bottom: 16rpx;
  line-height: 1.45;
}

.top-title {
  display: block;
  font-size: 48rpx;
  font-weight: 900;
  line-height: 1.26;
}

.top-subtitle {
  display: block;
  margin-top: 16rpx;
  font-size: 25rpx;
  color: #6E6E73;
  line-height: 1.6;
}

.search-bar {
  margin: -20rpx 32rpx 22rpx;
  min-height: 88rpx;
  border-radius: 26rpx;
  background: rgba(255, 255, 255, 0.86);
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  box-sizing: border-box;
  border: 1px solid rgba(60, 60, 67, 0.10);
  box-shadow: 0 12rpx 30rpx rgba(60, 60, 67, 0.10);
  backdrop-filter: blur(24rpx);
}

.search-icon {
  width: 42rpx;
  font-size: 34rpx;
  color: #8E8E93;
}

.search-input {
  flex: 1;
  height: 86rpx;
  font-size: 27rpx;
  color: #1D1D1F;
}

.placeholder {
  color: #AEAEB2;
}

.clear-search {
  width: 46rpx;
  height: 46rpx;
  border-radius: 50%;
  background: rgba(242, 242, 247, 0.92);
  color: #6E6E73;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
}

.tabs {
  white-space: nowrap;
  padding: 0 32rpx;
  margin-bottom: 22rpx;
  box-sizing: border-box;
}

.tab-item {
  display: inline-flex;
  align-items: center;
  height: 64rpx;
  padding: 0 28rpx;
  margin-right: 14rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.78);
  color: #6E6E73;
  border: 1px solid rgba(60, 60, 67, 0.10);
  font-size: 25rpx;
  font-weight: 800;
}

.tab-item.active {
  background: rgba(255, 179, 64, 0.20);
  color: #1D1D1F;
  border-color: rgba(255, 159, 10, 0.24);
}

.product-list {
  padding: 0 32rpx;
  box-sizing: border-box;
  min-height: 520rpx;
}

.product-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18rpx;
  padding-bottom: 34rpx;
}

.page.manager .product-grid {
  padding-bottom: 34rpx;
}

.product-card {
  height: 292rpx;
  perspective: 1200rpx;
  background: transparent;
  border: 0;
  box-shadow: none;
  overflow: visible;
  position: relative;
  z-index: 1;
}

.product-flip {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: flat;
  transition: opacity 0.18s ease;
  pointer-events: none;
}

.product-card.flipping .product-flip {
  opacity: 0.92;
}

.product-face {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 28rpx;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  box-sizing: border-box;
  overflow: visible;
}

.product-front {
  padding: 12rpx 12rpx 14rpx;
  background: rgba(255, 253, 246, 0.92);
  border: 1px solid rgba(176, 136, 78, 0.12);
  box-shadow: 0 12rpx 26rpx rgba(87, 69, 42, 0.08);
}

.stamp-ring {
  position: relative;
  height: 212rpx;
  border-radius: 48% 42% 52% 45% / 43% 54% 44% 51%;
  border: 6rpx solid #B98746;
  background: rgba(255, 253, 245, 0.58);
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  margin-bottom: 10rpx;
  overflow: visible;
}

.stamp-ring::after {
  content: "";
  position: absolute;
  inset: 14rpx 16rpx 12rpx 20rpx;
  border-radius: 44% 53% 46% 51% / 52% 42% 55% 45%;
  border: 2rpx solid rgba(185, 135, 70, 0.16);
  pointer-events: none;
}

.stamp-mark {
  position: absolute;
  left: 22rpx;
  right: 22rpx;
  top: 36rpx;
  z-index: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  color: rgba(120, 86, 48, 0.54);
  pointer-events: none;
}

.stamp-mark text {
  font-size: 20rpx;
  font-weight: 900;
  line-height: 1.2;
}

.stamp-mark text:last-child {
  display: none;
}

.product-cutout {
  position: relative;
  z-index: 1;
  width: 78%;
  height: 84%;
  border-radius: 22rpx;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  overflow: hidden;
}

.product-icon {
  width: 112rpx;
  height: 112rpx;
  border-radius: 34rpx;
  background: rgba(255, 244, 203, 0.88);
  color: #1D1D1F;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 42rpx;
  font-weight: 900;
}

.product-image {
  width: 100%;
  height: 100%;
  display: block;
  filter: drop-shadow(0 10rpx 12rpx rgba(60, 60, 67, 0.16));
}

.product-name {
  display: block;
  font-size: 26rpx;
  font-weight: 900;
  color: #1D1D1F;
  line-height: 1.35;
  text-align: center;
}

.card-manage-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
  margin-top: 14rpx;
}

.card-edit-btn,
.card-delete-btn {
  height: 54rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 23rpx;
  font-weight: 900;
}

.card-edit-btn {
  background: rgba(242, 242, 247, 0.90);
  color: #6E6E73;
}

.card-delete-btn {
  background: rgba(217, 87, 69, 0.12);
  color: #d95745;
}

.product-brand {
  display: inline-block;
  max-width: 100%;
  height: 36rpx;
  line-height: 36rpx;
  padding: 0 14rpx;
  border-radius: 14rpx;
  background: rgba(255, 179, 64, 0.16);
  color: #A85F00;
  font-size: 20rpx;
  font-weight: 900;
  margin-bottom: 10rpx;
}

.product-desc {
  display: block;
  height: 60rpx;
  font-size: 22rpx;
  color: #6E6E73;
  line-height: 1.62;
  overflow: hidden;
}

.empty-state {
  min-height: 520rpx;
  border-radius: 28rpx;
  border: 1px dashed rgba(60, 60, 67, 0.18);
  background: rgba(255, 255, 255, 0.72);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14rpx;
  padding: 44rpx 28rpx;
}

.empty-icon {
  width: 96rpx;
  height: 96rpx;
  border-radius: 28rpx;
  background: #FFE6A7;
  color: #1D1D1F;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  font-weight: 900;
}

.empty-title {
  font-size: 31rpx;
  font-weight: 900;
  color: #1D1D1F;
}

.empty-desc {
  font-size: 25rpx;
  color: #6E6E73;
}

.empty-add-btn {
  height: 72rpx;
  padding: 0 34rpx;
  border-radius: 22rpx;
  background: #FFB340;
  color: #1D1D1F;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 27rpx;
  font-weight: 900;
  margin-top: 12rpx;
}

.floating-add {
  position: fixed;
  right: 34rpx;
  bottom: calc(254rpx + env(safe-area-inset-bottom));
  z-index: 920;
  width: 86rpx;
  height: 86rpx;
  border-radius: 50%;
  background: #FF9F0A;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 46rpx;
  font-weight: 900;
  box-shadow: 0 16rpx 34rpx rgba(255, 159, 10, 0.30);
}

.page.manager .floating-add {
  bottom: calc(150rpx + env(safe-area-inset-bottom));
}

.cart-bar,
.empty-cart {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(136rpx + env(safe-area-inset-bottom));
  min-height: 98rpx;
  border-radius: 34rpx;
  z-index: 850;
  box-shadow: 0 18rpx 42rpx rgba(60, 60, 67, 0.22);
}

.cart-bar {
  background: rgba(29, 29, 31, 0.92);
  backdrop-filter: blur(24rpx);
  padding: 14rpx 16rpx 14rpx 22rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
}

.cart-left {
  display: flex;
  align-items: center;
  gap: 18rpx;
  flex: 1;
}

.cart-icon-wrap {
  position: relative;
  width: 62rpx;
  height: 62rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cart-icon {
  color: #fff;
  font-size: 24rpx;
  font-weight: 900;
}

.cart-badge {
  position: absolute;
  top: -10rpx;
  right: -12rpx;
  min-width: 32rpx;
  height: 32rpx;
  border-radius: 18rpx;
  background: #D7E58D;
  color: #1D1D1F;
  font-size: 20rpx;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6rpx;
}

.cart-total {
  display: flex;
  flex-direction: column;
}

.total-price {
  font-size: 34rpx;
  font-weight: 900;
  color: #fff;
}

.total-label {
  font-size: 21rpx;
  color: rgba(255, 255, 255, 0.56);
}

.checkout-btn {
  width: 150rpx;
  height: 70rpx;
  border-radius: 22rpx;
  background: #FFB340;
  color: #1D1D1F;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 900;
}

.checkout-btn.disabled {
  opacity: 0.68;
}

.empty-cart {
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(24rpx);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14rpx;
  color: #8E8E93;
  border: 1px solid rgba(60, 60, 67, 0.10);
}

.empty-text {
  font-size: 25rpx;
  font-weight: 900;
}

.cart-detail-overlay,
.add-overlay,
.detail-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.32);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s;
}

.cart-detail-overlay.show,
.add-overlay.show,
.detail-overlay.show {
  opacity: 1;
  pointer-events: all;
}

.cart-detail-overlay {
  z-index: 950;
}

.cart-detail,
.add-modal {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.96);
  border-radius: 38rpx 38rpx 0 0;
  padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.cart-detail {
  max-height: 66vh;
}

.cart-detail-header,
.add-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 26rpx;
}

.add-header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10rpx;
  flex-shrink: 0;
  max-width: 330rpx;
  flex-wrap: wrap;
}

.scan-btn {
  min-width: 76rpx;
  height: 48rpx;
  padding: 0 16rpx;
  border-radius: 16rpx;
  background: rgba(255, 179, 64, 0.20);
  color: #A85F00;
  border: 1px solid rgba(255, 159, 10, 0.24);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 23rpx;
  font-weight: 900;
  box-sizing: border-box;
}

.scan-btn.loading {
  opacity: 0.72;
}

.scan-btn.cover {
  background: rgba(215, 229, 141, 0.34);
  color: #617000;
  border-color: rgba(138, 157, 18, 0.18);
}

.cart-detail-title,
.add-modal-title {
  display: block;
  font-size: 34rpx;
  font-weight: 900;
  color: #1D1D1F;
  line-height: 1.35;
}

.cart-detail-sub,
.add-modal-sub {
  display: block;
  margin-top: 10rpx;
  font-size: 23rpx;
  color: #8E8E93;
}

.clear-btn {
  font-size: 25rpx;
  font-weight: 900;
  color: #d95745;
}

.cart-header-actions {
  display: flex;
  align-items: center;
  gap: 18rpx;
}

.cart-close-btn {
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  background: #F2F2F7;
  color: #6E6E73;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  font-weight: 900;
  line-height: 1;
}

.cart-items {
  max-height: 50vh;
}

.note-field {
  margin-top: 24rpx;
  padding-top: 22rpx;
  border-top: 1px solid #eff2ea;
}

.note-label {
  display: block;
  margin-bottom: 14rpx;
  line-height: 1.45;
  font-size: 25rpx;
  font-weight: 900;
  color: #6E6E73;
}

.note-input {
  height: 78rpx;
  border-radius: 20rpx;
  background: rgba(242, 242, 247, 0.86);
  border: 2rpx solid transparent;
  padding: 0 22rpx;
  box-sizing: border-box;
  font-size: 26rpx;
  color: #1D1D1F;
}

.cart-item {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 18rpx 0;
  border-bottom: 1px solid #eff2ea;
}

.cart-item-icon {
  width: 56rpx;
  height: 56rpx;
  border-radius: 18rpx;
  background: #FFF4CB;
  color: #1D1D1F;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 25rpx;
  font-weight: 900;
}

.cart-item-image {
  width: 56rpx;
  height: 56rpx;
  border-radius: 18rpx;
  display: block;
  flex-shrink: 0;
}

.cart-item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.cart-item-name {
  font-size: 27rpx;
  font-weight: 900;
  color: #1D1D1F;
}

.cart-item-price {
  font-size: 23rpx;
  font-weight: 800;
  color: #A85F00;
}

.cart-item-qty {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.qty-btn {
  width: 48rpx;
  height: 48rpx;
  border-radius: 16rpx;
  background: rgba(242, 242, 247, 0.90);
  color: #6E6E73;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 900;
}

.qty-btn.plus {
  background: #D7E58D;
  color: #1D1D1F;
}

.qty-num {
  min-width: 34rpx;
  text-align: center;
  font-size: 28rpx;
  font-weight: 900;
  color: #1D1D1F;
}

.add-overlay {
  z-index: 960;
}

.add-modal {
  max-height: 82vh;
  overflow-y: auto;
}

.add-modal-close,
.detail-modal-close {
  width: 52rpx;
  height: 52rpx;
  border-radius: 18rpx;
  background: rgba(242, 242, 247, 0.90);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6E6E73;
  font-size: 36rpx;
}

.add-form {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.recognition-card {
  padding: 22rpx 24rpx;
  border-radius: 24rpx;
  background: linear-gradient(135deg, rgba(215, 229, 141, 0.34), rgba(255, 244, 203, 0.72));
  border: 1px solid rgba(138, 157, 18, 0.16);
}

.recognition-title {
  display: block;
  font-size: 24rpx;
  font-weight: 900;
  color: #617000;
  line-height: 1.45;
}

.recognition-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #1D1D1F;
  line-height: 1.55;
}

.add-field {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.add-field.row {
  flex-direction: row;
  gap: 18rpx;
}

.category-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.category-option {
  height: 60rpx;
  padding: 0 22rpx;
  border-radius: 18rpx;
  background: rgba(242, 242, 247, 0.86);
  border: 2rpx solid transparent;
  color: #6E6E73;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 900;
}

.category-option.selected {
  background: rgba(255, 179, 64, 0.18);
  border-color: rgba(255, 159, 10, 0.24);
  color: #1D1D1F;
}

.brand-scroll {
  white-space: nowrap;
}

.brand-row {
  display: inline-flex;
  gap: 12rpx;
  padding-right: 8rpx;
}

.brand-option,
.sugar-option {
  height: 60rpx;
  padding: 0 22rpx;
  border-radius: 18rpx;
  background: rgba(242, 242, 247, 0.86);
  border: 2rpx solid transparent;
  color: #6E6E73;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 900;
}

.brand-option.selected,
.sugar-option.selected {
  background: rgba(255, 179, 64, 0.18);
  border-color: rgba(255, 159, 10, 0.24);
  color: #1D1D1F;
}

.brand-input {
  margin-top: 14rpx;
}

.sugar-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.half {
  flex: 1;
}

.add-label {
  font-size: 25rpx;
  font-weight: 900;
  color: #6E6E73;
  line-height: 1.45;
}

.add-input,
.icon-picker {
  height: 82rpx;
  border-radius: 20rpx;
  background: rgba(242, 242, 247, 0.86);
  border: 2rpx solid transparent;
  box-sizing: border-box;
}

.add-input {
  padding: 0 22rpx;
  font-size: 28rpx;
  color: #1D1D1F;
}

.icon-picker {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  font-weight: 900;
  color: #1D1D1F;
}

.icon-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.cover-chip {
  min-height: 72rpx;
  padding: 10rpx 16rpx;
  border-radius: 20rpx;
  background: rgba(242, 242, 247, 0.86);
  display: flex;
  align-items: center;
  gap: 14rpx;
  box-sizing: border-box;
}

.cover-chip-image {
  width: 52rpx;
  height: 52rpx;
  border-radius: 16rpx;
  display: block;
}

.cover-chip-text {
  font-size: 24rpx;
  font-weight: 900;
  color: #6E6E73;
}

.icon-option {
  width: 58rpx;
  height: 58rpx;
  border-radius: 18rpx;
  background: rgba(242, 242, 247, 0.86);
  border: 2rpx solid transparent;
  color: #1D1D1F;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 900;
}

.icon-option.selected {
  background: rgba(255, 179, 64, 0.18);
  border-color: rgba(255, 159, 10, 0.24);
}

.add-actions {
  display: flex;
  gap: 18rpx;
  margin-top: 10rpx;
}

.add-cancel,
.add-confirm,
.detail-cart-btn {
  height: 88rpx;
  border-radius: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 900;
}

.add-cancel {
  flex: 1;
  background: rgba(242, 242, 247, 0.90);
  color: #6E6E73;
}

.add-confirm {
  flex: 2;
  background: #FF9F0A;
  color: #fff;
}

.detail-overlay {
  z-index: 990;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  box-sizing: border-box;
}

.detail-modal {
  width: 100%;
  max-width: 660rpx;
  background:
    linear-gradient(145deg, rgba(255, 253, 246, 0.98), rgba(255, 255, 255, 0.96));
  border-radius: 42rpx;
  padding: 26rpx 30rpx 32rpx;
  box-sizing: border-box;
  border: 1px solid rgba(176, 136, 78, 0.18);
  box-shadow: 0 28rpx 80rpx rgba(29, 29, 31, 0.22);
  transform: perspective(1100rpx) rotateY(-74deg) scale(0.62) translateY(48rpx);
  transform-origin: center center;
  opacity: 0;
  transition: transform 0.46s cubic-bezier(0.2, 0.86, 0.2, 1), opacity 0.24s ease;
}

.detail-overlay.show .detail-modal {
  transform: perspective(1100rpx) rotateY(0deg) scale(1) translateY(0);
  opacity: 1;
}

.detail-modal-header {
  display: flex;
  justify-content: flex-end;
}

.detail-body {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 18rpx;
}

.detail-name {
  font-size: 44rpx;
  font-weight: 900;
  color: #1D1D1F;
  line-height: 1.25;
  text-align: center;
}

.detail-brand {
  height: 42rpx;
  padding: 0 18rpx;
  border-radius: 16rpx;
  background: rgba(255, 179, 64, 0.16);
  color: #A85F00;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 900;
  align-self: center;
}

.detail-desc {
  font-size: 26rpx;
  color: #6E6E73;
  text-align: center;
  line-height: 1.45;
}

.detail-options {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 4rpx;
}

.detail-option-group {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.detail-option-title {
  font-size: 24rpx;
  font-weight: 900;
  color: #6E6E73;
}

.detail-option-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.detail-option {
  height: 58rpx;
  padding: 0 20rpx;
  border-radius: 18rpx;
  background: rgba(242, 242, 247, 0.86);
  border: 2rpx solid transparent;
  color: #6E6E73;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 900;
}

.detail-option.selected {
  background: rgba(255, 179, 64, 0.18);
  border-color: rgba(255, 159, 10, 0.28);
  color: #1D1D1F;
}

.detail-custom-input {
  height: 70rpx;
  border-radius: 20rpx;
  background: rgba(242, 242, 247, 0.86);
  padding: 0 20rpx;
  box-sizing: border-box;
  font-size: 25rpx;
  color: #1D1D1F;
}

.detail-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 8rpx;
}

.detail-cart-btn,
.detail-edit-btn,
.detail-delete-btn {
  height: 84rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 900;
}

.detail-cart-btn {
  flex: 2;
  background: #FF9F0A;
  color: #fff;
}

.detail-edit-btn {
  flex: 1;
  background: rgba(242, 242, 247, 0.92);
  color: #6E6E73;
}

.detail-delete-btn {
  flex: 1;
  background: rgba(217, 87, 69, 0.10);
  color: #d95745;
}
</style>
