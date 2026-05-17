<template>
  <view class="page">
    <view class="top-bar">
      <view>
        <text class="store-label">Corn's Menu</text>
        <text class="top-title">私人点单台</text>
        <text class="top-subtitle">先添加商品，再开始点单。</text>
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
      <text class="clear-search" v-if="search" @click="search = ''">×</text>
    </view>

    <view class="quick-actions">
      <view class="quick-btn primary" @click="openAddModal">
        <text class="quick-icon">+</text>
        <text>添加商品</text>
      </view>
      <view class="quick-btn secondary" @click="goOrders">
        <text>查看订单</text>
      </view>
    </view>

    <scroll-view class="tabs" scroll-x :show-scrollbar="false">
      <view
        v-for="(tab, index) in categories"
        :key="tab.name"
        class="tab-item"
        :class="{ active: activeTab === index }"
        @click="activeTab = index"
      >
        <text>{{ tab.name }}</text>
      </view>
    </scroll-view>

    <scroll-view class="product-list" scroll-y>
      <view class="product-grid" v-if="filteredList.length">
        <view
          class="product-card"
          :class="`theme-${item.category}`"
          v-for="item in filteredList"
          :key="item.id"
          @click="showDetail(item)"
        >
          <view class="product-cover">
            <text class="product-icon">{{ item.icon }}</text>
          </view>
          <view class="product-info">
            <text class="product-name">{{ item.name }}</text>
            <text class="product-desc">{{ item.desc }}</text>
            <view class="product-bottom">
              <text class="product-price">¥{{ item.price }}</text>
              <view class="add-btn" @click.stop="addToCart(item)">+</view>
            </view>
            <view class="manage-row">
              <text @click.stop="openEditModal(item)">编辑</text>
              <text @click.stop="removeGoods(item)">删除</text>
            </view>
          </view>
        </view>
      </view>

      <view class="empty-state" v-else>
        <view class="empty-icon">+</view>
        <text class="empty-title">这个分类还没有商品</text>
        <text class="empty-desc">点击下方按钮，添加第一件商品。</text>
        <view class="empty-add-btn" @click="openAddModal">添加商品</view>
      </view>
    </scroll-view>

    <view class="cart-bar" v-if="cart.length">
      <view class="cart-left" @click="showCartDetail = !showCartDetail">
        <view class="cart-icon-wrap">
          <text class="cart-icon">单</text>
          <text class="cart-badge">{{ cartCount }}</text>
        </view>
        <view class="cart-total">
          <text class="total-price">¥{{ totalPrice }}</text>
          <text class="total-label">查看已选商品</text>
        </view>
      </view>
      <view class="checkout-btn" @click="handleCheckout">下单</view>
    </view>

    <view class="empty-cart" v-else>
      <text class="empty-cart-icon">单</text>
      <text class="empty-text">购物车为空</text>
    </view>

    <view class="cart-detail-overlay" :class="{ show: showCartDetail }" @click="showCartDetail = false">
      <view class="cart-detail" @click.stop>
        <view class="cart-detail-header">
          <view>
            <text class="cart-detail-title">购物车</text>
            <text class="cart-detail-sub">{{ cartCount }} 件 · 合计 ¥{{ totalPrice }}</text>
          </view>
          <text class="clear-btn" @click="clearCart">清空</text>
        </view>
        <scroll-view class="cart-items" scroll-y>
          <view class="cart-item" v-for="item in cart" :key="item.id">
            <text class="cart-item-icon">{{ item.icon }}</text>
            <view class="cart-item-info">
              <text class="cart-item-name">{{ item.name }}</text>
              <text class="cart-item-price">¥{{ item.price }}</text>
            </view>
            <view class="cart-item-qty">
              <view class="qty-btn" @click="decrease(item)">−</view>
              <text class="qty-num">{{ item.count }}</text>
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
          />
        </view>
      </view>
    </view>

    <view class="add-overlay" :class="{ show: showAddModal }" @click="showAddModal = false">
      <view class="add-modal" @click.stop>
        <view class="add-modal-header">
          <view>
            <text class="add-modal-title">{{ editingProductId ? '编辑商品' : '添加商品' }}</text>
            <text class="add-modal-sub">把它放到合适的分类里。</text>
          </view>
          <text class="add-modal-close" @click="showAddModal = false">×</text>
        </view>

        <view class="add-form">
          <view class="add-field">
            <text class="add-label">分类</text>
            <view class="category-picker">
              <text
                v-for="(category, index) in categories"
                :key="category.name"
                class="category-option"
                :class="{ selected: addCategory === index }"
                @click="selectAddCategory(index)"
              >{{ category.name }}</text>
            </view>
          </view>

          <view class="add-field">
            <text class="add-label">商品名称</text>
            <input class="add-input" v-model="addName" placeholder="例：冰美式" placeholder-class="placeholder" maxlength="16" />
          </view>
          <view class="add-field row">
            <view class="half">
              <text class="add-label">价格</text>
              <input class="add-input" v-model="addPrice" placeholder="18" placeholder-class="placeholder" type="number" maxlength="5" />
            </view>
            <view class="half">
              <text class="add-label">图标</text>
              <view class="icon-picker" @click="cycleIcon">{{ addIcon }}</view>
            </view>
          </view>
          <view class="add-field">
            <text class="add-label">描述</text>
            <input class="add-input" v-model="addDesc" placeholder="例：少冰、三分糖" placeholder-class="placeholder" maxlength="28" />
          </view>

          <view class="icon-list">
            <text
              v-for="icon in icons"
              :key="icon"
              class="icon-option"
              :class="{ selected: addIcon === icon }"
              @click="addIcon = icon"
            >{{ icon }}</text>
          </view>

          <view class="add-actions">
            <view class="add-cancel" @click="showAddModal = false">取消</view>
            <view class="add-confirm" @click="saveGoods">{{ editingProductId ? '保存修改' : '确认添加' }}</view>
          </view>
        </view>
      </view>
    </view>

    <view class="detail-overlay" :class="{ show: showDetailModal }" @click="showDetailModal = false">
      <view class="detail-modal" @click.stop>
        <view class="detail-modal-header">
          <text class="detail-modal-close" @click="showDetailModal = false">×</text>
        </view>
        <view class="detail-body" v-if="detailItem">
          <view class="detail-icon">{{ detailItem.icon }}</view>
          <text class="detail-name">{{ detailItem.name }}</text>
          <text class="detail-desc">{{ detailItem.desc }}</text>
          <text class="detail-price">¥{{ detailItem.price }}</text>
          <view class="detail-cart-btn" @click="addDetailToCart">加入购物车</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  addOrder,
  addProduct,
  deleteProduct,
  listProducts,
  updateProduct
} from '../../utils/menuApi'

const categories = [
  { name: '咖啡' },
  { name: '果茶' },
  { name: '奶茶' },
  { name: '便利店' },
  { name: '其他' }
]

const icons = ['咖', '果', '奶', '便', '其', '茶', '甜']
const search = ref('')
const activeTab = ref(0)
const showCartDetail = ref(false)
const showAddModal = ref(false)
const showDetailModal = ref(false)
const cart = ref([])
const menuItems = ref([])
const detailItem = ref(null)
const orderNote = ref('')

const addName = ref('')
const addPrice = ref('')
const addDesc = ref('')
const addIcon = ref('咖')
const addCategory = ref(0)
const editingProductId = ref('')

onShow(() => {
  loadProducts()
})

const filteredList = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return menuItems.value.filter(item => {
    const matchedCategory = item.category === activeTab.value
    const matchedKeyword = !keyword ||
      item.name.toLowerCase().includes(keyword) ||
      item.desc.toLowerCase().includes(keyword)
    return matchedCategory && matchedKeyword
  })
})

const cartCount = computed(() => cart.value.reduce((sum, item) => sum + item.count, 0))
const totalPrice = computed(() => cart.value.reduce((sum, item) => sum + item.price * item.count, 0))

async function loadProducts() {
  menuItems.value = await listProducts()
}

function addToCart(item) {
  const found = cart.value.find(cartItem => cartItem.id === item.id)
  if (found) {
    found.count += 1
  } else {
    cart.value.push({ ...item, count: 1 })
  }
}

function decrease(item) {
  const found = cart.value.find(cartItem => cartItem.id === item.id)
  if (!found) return
  found.count -= 1
  if (found.count <= 0) {
    cart.value = cart.value.filter(cartItem => cartItem.id !== item.id)
  }
}

function clearCart() {
  cart.value = []
  showCartDetail.value = false
}

async function handleCheckout() {
  if (!cart.value.length) return

  const order = {
    id: `order-${Date.now()}`,
    items: cart.value.map(item => ({
      id: item.id,
      name: item.name,
      icon: item.icon,
      price: item.price,
      count: item.count
    })),
    totalPrice: totalPrice.value,
    totalCount: cartCount.value,
    note: orderNote.value.trim(),
    status: 'pending',
    createdAt: Date.now()
  }

  try {
    await addOrder(order)
    cart.value = []
    orderNote.value = ''
    showCartDetail.value = false
    uni.showToast({ title: '下单成功', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: '云端下单失败', icon: 'none' })
  }
}

function handleLogout() {
  uni.navigateBack()
}

function goOrders() {
  uni.navigateTo({ url: '/pages/orders/orders' })
}

function openAddModal() {
  editingProductId.value = ''
  addCategory.value = activeTab.value
  addName.value = ''
  addPrice.value = ''
  addDesc.value = ''
  addIcon.value = icons[addCategory.value] || '其'
  showAddModal.value = true
}

function openEditModal(item) {
  editingProductId.value = item.id
  addCategory.value = Number(item.category || 0)
  activeTab.value = addCategory.value
  addName.value = item.name
  addPrice.value = String(item.price)
  addDesc.value = item.desc
  addIcon.value = item.icon
  showAddModal.value = true
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
  const name = addName.value.trim()
  const price = Number(addPrice.value)

  if (!name) {
    uni.showToast({ title: '请输入商品名称', icon: 'none' })
    return
  }

  if (!Number.isFinite(price) || price <= 0) {
    uni.showToast({ title: '请输入有效价格', icon: 'none' })
    return
  }

  try {
    const payload = {
      id: editingProductId.value || `goods-${Date.now()}`,
      category: addCategory.value,
      icon: addIcon.value,
      name,
      price,
      desc: addDesc.value.trim() || '暂无描述',
      createdAt: Date.now()
    }
    const product = editingProductId.value
      ? await updateProduct(payload)
      : await addProduct(payload)

    menuItems.value = editingProductId.value
      ? menuItems.value.map(item => item.id === product.id ? product : item)
      : [product, ...menuItems.value.filter(item => item.id !== product.id)]
    cart.value = cart.value.map(item => item.id === product.id ? { ...product, count: item.count } : item)
    activeTab.value = Number(product.category || 0)
    showAddModal.value = false
    editingProductId.value = ''
    uni.showToast({ title: '保存成功', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: '云端保存失败', icon: 'none' })
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
        uni.showToast({ title: '云端删除失败', icon: 'none' })
      }
    }
  })
}

function showDetail(item) {
  detailItem.value = item
  showDetailModal.value = true
}

function addDetailToCart() {
  if (!detailItem.value) return
  addToCart(detailItem.value)
  showDetailModal.value = false
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
  display: flex;
  flex-direction: column;
  padding: 0 0 140rpx;
  box-sizing: border-box;
  background: #F7F6F1;
}

.top-bar {
  padding: 124rpx 32rpx 46rpx;
  background:
    radial-gradient(circle at 82% 0%, rgba(255, 214, 10, 0.18), transparent 34%),
    linear-gradient(180deg, #FAF9F4 0%, #F7F6F1 100%);
  display: flex;
  align-items: flex-start;
  color: #1D1D1F;
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
  margin-top: 20rpx;
  font-size: 25rpx;
  color: #6E6E73;
  line-height: 1.7;
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

.quick-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18rpx;
  padding: 0 32rpx 26rpx;
  box-sizing: border-box;
}

.quick-btn {
  height: 76rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.82);
  color: #1D1D1F;
  border: 1px solid rgba(60, 60, 67, 0.10);
  box-shadow: 0 8rpx 22rpx rgba(60, 60, 67, 0.08);
  backdrop-filter: blur(20rpx);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  font-size: 26rpx;
  font-weight: 900;
}

.quick-btn.primary {
  background: #FFB340;
  border-color: rgba(255, 159, 10, 0.18);
}

.quick-btn.secondary {
  color: #A85F00;
}

.quick-icon {
  width: 34rpx;
  height: 34rpx;
  border-radius: 12rpx;
  background: rgba(255, 159, 10, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 900;
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
  flex: 1;
  padding: 0 32rpx;
  box-sizing: border-box;
}

.product-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
  padding-bottom: 28rpx;
}

.product-card {
  background: rgba(255, 255, 255, 0.86);
  border-radius: 30rpx;
  overflow: hidden;
  border: 1px solid rgba(60, 60, 67, 0.10);
  box-shadow: 0 8rpx 24rpx rgba(60, 60, 67, 0.08);
}

.product-card.theme-0 .product-cover {
  background: linear-gradient(135deg, #FFE6A7, #FFF6D5);
}

.product-card.theme-1 .product-cover {
  background: linear-gradient(135deg, #FFB340, #FFE0A0);
}

.product-card.theme-2 .product-cover {
  background: linear-gradient(135deg, #FFF4CB, #FAF9F4);
}

.product-card.theme-3 .product-cover {
  background: linear-gradient(135deg, #D7E58D, #FFF4CB);
}

.product-card.theme-4 .product-cover {
  background: linear-gradient(135deg, #FAF9F4, #D7E58D);
}

.product-cover {
  height: 168rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.product-icon {
  width: 82rpx;
  height: 82rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.78);
  color: #1D1D1F;
  border: 1px solid rgba(60, 60, 67, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 38rpx;
  font-weight: 900;
}

.product-info {
  padding: 18rpx;
}

.product-name {
  display: block;
  font-size: 28rpx;
  font-weight: 900;
  color: #1D1D1F;
  margin-bottom: 12rpx;
  line-height: 1.35;
}

.product-desc {
  display: block;
  height: 60rpx;
  font-size: 22rpx;
  color: #6E6E73;
  line-height: 1.62;
  overflow: hidden;
}

.product-bottom {
  margin-top: 16rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.manage-row {
  margin-top: 16rpx;
  padding-top: 14rpx;
  border-top: 1px solid rgba(60, 60, 67, 0.10);
  display: flex;
  align-items: center;
  gap: 22rpx;
}

.manage-row text {
  font-size: 22rpx;
  font-weight: 900;
  color: #8E8E93;
}

.manage-row text:last-child {
  color: #d95745;
}

.product-price {
  font-size: 31rpx;
  font-weight: 900;
  color: #A85F00;
}

.add-btn {
  width: 54rpx;
  height: 54rpx;
  border-radius: 18rpx;
  background: #FF9F0A;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  font-weight: 900;
}

.empty-state {
  min-height: 460rpx;
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

.cart-bar,
.empty-cart {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: 24rpx;
  min-height: 98rpx;
  border-radius: 34rpx;
  z-index: 50;
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

.empty-cart-icon,
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
  z-index: 99;
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
  z-index: 100;
}

.add-modal {
  max-height: 82vh;
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
  z-index: 110;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-modal {
  width: 620rpx;
  background: rgba(255, 255, 255, 0.96);
  border-radius: 38rpx;
  padding: 28rpx 32rpx 34rpx;
  box-sizing: border-box;
}

.detail-modal-header {
  display: flex;
  justify-content: flex-end;
}

.detail-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}

.detail-icon {
  width: 150rpx;
  height: 150rpx;
  border-radius: 42rpx;
  background: linear-gradient(135deg, #FFE6A7, #FFF4CB);
  color: #1D1D1F;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 50rpx;
  font-weight: 900;
}

.detail-name {
  font-size: 38rpx;
  font-weight: 900;
  color: #1D1D1F;
}

.detail-desc {
  font-size: 26rpx;
  color: #6E6E73;
  text-align: center;
  line-height: 1.45;
}

.detail-price {
  font-size: 46rpx;
  font-weight: 900;
  color: #A85F00;
}

.detail-cart-btn {
  width: 100%;
  background: #FF9F0A;
  color: #fff;
  margin-top: 8rpx;
}
</style>
