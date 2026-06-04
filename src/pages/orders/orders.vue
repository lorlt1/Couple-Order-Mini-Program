<template>
  <view class="page">
    <view class="top-bar">
      <view>
        <text class="store-label">Corn's Menu</text>
        <text class="top-title">{{ isManager ? '订单管理' : '我的订单' }}</text>
        <text class="top-subtitle">
          {{ isManager ? '处理当前账号收到的订单。' : '只显示你自己的点单记录。' }}
        </text>
      </view>
    </view>

    <view class="summary-card">
      <view>
        <text class="summary-num">{{ orders.length }}</text>
        <text class="summary-label">全部订单</text>
      </view>
      <view>
        <text class="summary-num highlight">{{ activeCount }}</text>
        <text class="summary-label">进行中</text>
      </view>
      <view>
        <text class="summary-num">{{ doneCount }}</text>
        <text class="summary-label">已完成</text>
      </view>
    </view>

    <view class="pending-notice" v-if="activeCount">
      <text class="notice-title">{{ activeCount }} 个订单还在进行中</text>
      <text class="notice-desc">
        {{ isManager ? '处理好后点击确认完成。' : '等待处理时可以取消或催一下。' }}
      </text>
    </view>

    <view class="skeleton" v-if="isLoading">
      <view></view>
      <view></view>
      <view></view>
    </view>

    <scroll-view class="orders-list" scroll-y v-else>
      <view class="empty-state" v-if="!orders.length">
        <view class="empty-icon">单</view>
        <text class="empty-title">还没有订单</text>
        <text class="empty-desc">{{ isManager ? '用户下单后，你会在这里看到想要的商品。' : '去点单页选点喜欢的吧。' }}</text>
        <view class="empty-action" v-if="!isManager" @click="goOrder">去点单</view>
      </view>

      <view
        class="order-card"
        :class="{ pending: isActive(order), reminded: isManager && hasReminder(order), finished: order.status === 'done', cancelled: order.status === 'cancelled' }"
        v-for="order in sortedOrders"
        :key="order.id"
      >
        <view class="order-head">
          <view class="order-head-main">
            <text class="order-title">{{ formatTime(order.createdAt) }}</text>
            <text class="order-sub">{{ order.totalCount || orderItemCount(order) }} 件</text>
          </view>
          <text class="status-pill" :class="order.status">{{ statusText(order.status) }}</text>
        </view>

        <view class="remind-alert" v-if="isManager && hasReminder(order)">
          <text class="remind-title">对方催了一下</text>
          <text class="remind-text">已提醒 {{ order.remindCount || 1 }} 次 · {{ formatTime(order.remindedAt) }}</text>
        </view>

        <view class="order-items">
          <view class="order-item" v-for="item in order.items" :key="`${item.id || ''}:${item.sugar || ''}:${item.name || ''}`">
            <image class="item-image" v-if="item.imageUrl" :src="item.imageUrl" mode="aspectFit" />
            <text class="item-icon" v-else>{{ fallbackText(item) }}</text>
            <view class="item-main">
              <text class="item-name">{{ item.name || '未命名商品' }}</text>
              <text class="item-meta">{{ item.count || 1 }} 件{{ item.brand && item.brand !== '自定义' ? ' · ' + item.brand : '' }}{{ item.sugar ? ' · ' + item.sugar : '' }}</text>
              <text class="item-note" v-if="itemNote(item)">描述：{{ itemNote(item) }}</text>
            </view>
          </view>
        </view>

        <view class="order-note" v-if="order.note">
          <text class="note-label">备注</text>
          <text class="note-text">{{ order.note }}</text>
        </view>

        <view class="order-debug" v-if="isManager && order.doneNotifyError">
          <text class="debug-label">完成通知失败</text>
          <text class="debug-text">{{ notifyErrorText(order.doneNotifyError) }}</text>
        </view>

        <view class="order-actions" v-if="isManager">
          <view class="action-btn primary" v-if="isActive(order)" @click="finishOrder(order.id)">确认完成</view>
          <view class="action-btn danger" @click="deleteOrderRecord(order)">删除记录</view>
        </view>

        <view class="order-actions user-actions" v-else>
          <view class="action-btn ghost" v-if="order.status === 'pending'" @click="cancelUserOrder(order.id)">取消订单</view>
          <view class="action-btn ghost" v-if="order.status === 'pending'" @click="remindUserOrder(order)">催一下</view>
          <view class="action-btn primary" v-if="order.status === 'done'" @click="buyAgain(order)">再次购买</view>
          <view class="action-btn disabled" v-if="order.status === 'cancelled'">订单已取消</view>
          <view class="action-btn danger" @click="deleteOrderRecord(order)">删除记录</view>
        </view>
      </view>
    </scroll-view>

    <BottomNav active="orders" />
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import BottomNav from '../../components/BottomNav.vue'
import { ORDER_NOTIFY_TEMPLATE_ID } from '../../config/cloud'
import { cancelOrder, deleteOrder, getErrorMessage, listOrders, registerOrderNotifier, remindOrder, updateOrderStatus } from '../../utils/menuApi'
import { getSession, isAdmin } from '../../utils/auth'

const orders = ref([])
const isManager = ref(false)
const isLoading = ref(true)
const activeAccount = ref('')

onShow(async () => {
  const session = getSession()
  if (!session) {
    uni.reLaunch({ url: '/pages/index/index' })
    return
  }
  const accountKey = session.userId || session.account
  if (activeAccount.value && activeAccount.value !== accountKey) {
    orders.value = []
  }
  activeAccount.value = accountKey
  isManager.value = isAdmin()
  await loadOrders()
})

const activeCount = computed(() => orders.value.filter(order => isActive(order)).length)
const doneCount = computed(() => orders.value.filter(order => order.status === 'done').length)
const sortedOrders = computed(() => {
  return [...orders.value].sort((a, b) => {
    const aInactive = !isActive(a)
    const bInactive = !isActive(b)
    if (aInactive !== bInactive) return aInactive ? 1 : -1
    return Number(b.createdAt || 0) - Number(a.createdAt || 0)
  })
})

async function loadOrders() {
  isLoading.value = true
  try {
    orders.value = await listOrders()
  } catch (error) {
    orders.value = []
    uni.showToast({ title: getErrorMessage(error, '订单加载失败'), icon: 'none' })
  } finally {
    isLoading.value = false
  }
}

async function enableOrderNotify(options = {}) {
  const silent = Boolean(options.silent)
  if (!ORDER_NOTIFY_TEMPLATE_ID || ORDER_NOTIFY_TEMPLATE_ID === 'YOUR_ORDER_NOTIFY_TEMPLATE_ID') {
    if (!silent) uni.showToast({ title: '请先配置订单通知模板 ID', icon: 'none' })
    return false
  }
  if (typeof wx === 'undefined' || !wx.requestSubscribeMessage) {
    if (!silent) uni.showToast({ title: '当前环境不支持订阅消息', icon: 'none' })
    return false
  }

  try {
    const accepted = await requestOrderNotifySubscribe()
    if (!accepted) {
      if (!silent) uni.showToast({ title: '你还没有允许订单通知', icon: 'none' })
      return false
    }
    try {
      await registerOrderNotifier(ORDER_NOTIFY_TEMPLATE_ID)
    } catch (error) {
      console.error('register order notifier failed:', error)
      if (!silent) uni.showToast({ title: getErrorMessage(error, '通知保存失败'), icon: 'none' })
      return false
    }
    if (!silent) uni.showToast({ title: '订单通知已开启', icon: 'none' })
    return true
  } catch (error) {
    console.error('request subscribe message failed:', error)
    if (!silent) uni.showToast({ title: getSubscribeErrorMessage(error), icon: 'none' })
    return false
  }
}

function requestOrderNotifySubscribe() {
  return withTimeout(new Promise((resolve, reject) => {
    const requestSubscribeMessage = uni.requestSubscribeMessage || wx.requestSubscribeMessage
    requestSubscribeMessage({
      tmplIds: [ORDER_NOTIFY_TEMPLATE_ID],
      success: (res) => resolve(res[ORDER_NOTIFY_TEMPLATE_ID] === 'accept'),
      fail: reject
    })
  }), 8000)
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise(resolve => {
      setTimeout(() => resolve(false), timeoutMs)
    })
  ])
}

function getSubscribeErrorMessage(error) {
  const message = String(error?.errMsg || error?.message || '')
  if (message.includes('cancel')) return '你取消了通知授权'
  if (message.includes('main switch')) return '请在微信设置里开启订阅消息'
  if (message.includes('tmplIds')) return '通知模板 ID 无效'
  if (message.includes('No template data')) return '模板未同步，请确认小程序 AppID 和模板 ID'
  if (message.includes('can only be invoked by user TAP gesture')) return '请点击按钮开启通知'
  return message || '订阅授权失败'
}

function isActive(order) {
  return order.status !== 'done' && order.status !== 'cancelled'
}

function hasReminder(order) {
  return Number(order.remindCount || 0) > 0 && order.status === 'pending'
}

async function finishOrder(orderId) {
  if (!isManager.value) return
  const previous = [...orders.value]
  orders.value = orders.value.map(order => (
    order.id === orderId ? { ...order, status: 'done' } : order
  ))

  try {
    await enableOrderNotify({ silent: true })
    await updateOrderStatus(orderId, 'done')
    await loadOrders()
    uni.showToast({ title: '订单已完成', icon: 'none' })
  } catch (error) {
    orders.value = previous
    uni.showToast({ title: getErrorMessage(error, '状态更新失败'), icon: 'none' })
  }
}

async function cancelUserOrder(orderId) {
  const previous = [...orders.value]
  orders.value = orders.value.map(order => (
    order.id === orderId ? { ...order, status: 'cancelled' } : order
  ))

  try {
    await cancelOrder(orderId)
    uni.showToast({ title: '订单已取消', icon: 'none' })
  } catch (error) {
    orders.value = previous
    uni.showToast({ title: getErrorMessage(error, '取消失败'), icon: 'none' })
  }
}

async function remindUserOrder(order) {
  if (order.status !== 'pending') {
    uni.showToast({ title: '订单进行中才可以催单', icon: 'none' })
    return
  }
  const previous = [...orders.value]
  const now = Date.now()
  orders.value = orders.value.map(item => (
    item.id === order.id
      ? { ...item, remindCount: Number(item.remindCount || 0) + 1, remindedAt: now }
      : item
  ))

  try {
    const saved = await remindOrder(order.id)
    orders.value = orders.value.map(item => item.id === order.id ? { ...item, ...saved } : item)
    uni.showToast({ title: '已提醒对方', icon: 'none' })
  } catch (error) {
    orders.value = previous
    uni.showToast({ title: getErrorMessage(error, '提醒失败，请稍后重试'), icon: 'none' })
  }
}

function deleteOrderRecord(order) {
  uni.showModal({
    title: '删除订单',
    content: `确定删除「${orderTitle(order)}」这条记录吗？`,
    confirmText: '删除',
    confirmColor: '#d95745',
    success: async (res) => {
      if (!res.confirm) return
      const previous = [...orders.value]
      orders.value = orders.value.filter(item => item.id !== order.id)
      try {
        await deleteOrder(order.id)
        uni.showToast({ title: '已删除', icon: 'none' })
      } catch (error) {
        orders.value = previous
        uni.showToast({ title: getErrorMessage(error, '删除失败'), icon: 'none' })
      }
    }
  })
}

function buyAgain(order) {
  const session = getSession()
  const key = `cornMenuPendingReorder:${session?.userId || session?.account || 'guest'}`
  uni.setStorageSync(key, (order.items || []).map(item => ({ ...item })))
  uni.redirectTo({ url: '/pages/order/order' })
}

function goOrder() {
  uni.redirectTo({ url: '/pages/order/order' })
}

function statusText(status) {
  const map = {
    pending: '待处理',
    arranged: '待处理',
    done: '已完成',
    cancelled: '已取消'
  }
  return map[status] || '待处理'
}

function orderTitle(order) {
  return (order.items || []).map(item => item.name).filter(Boolean).slice(0, 2).join('、') || '订单'
}

function orderItemCount(order) {
  return (order.items || []).reduce((sum, item) => sum + Number(item.count || 1), 0)
}

function itemNote(item = {}) {
  return String(item.note || item.remark || item.desc || '').trim()
}

function notifyErrorText(error) {
  const text = String(error || '')
  if (text.includes('47003')) return '模板字段不匹配，已自动尝试备用字段。请用新订单再测一次。'
  if (text.includes('43101')) return '用户没有授权或授权次数已用完。'
  return text
}

function fallbackText(item) {
  return String((item && (item.brand || item.name || item.icon)) || '饮').slice(0, 2)
}

function formatTime(timestamp) {
  if (!timestamp) return '刚刚'
  const date = new Date(timestamp)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
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
  padding: 118rpx 32rpx 0;
  box-sizing: border-box;
  background:
    radial-gradient(circle at 82% 0%, rgba(255, 214, 10, 0.13), transparent 34%),
    linear-gradient(180deg, #FAF9F4 0%, #F7F6F1 52%, #F2F2ED 100%);
}

.top-bar {
  margin-bottom: 26rpx;
}

.store-label {
  display: block;
  font-size: 24rpx;
  font-weight: 800;
  color: #A85F00;
  margin-bottom: 16rpx;
}

.top-title {
  display: block;
  font-size: 50rpx;
  font-weight: 900;
  color: #1D1D1F;
  line-height: 1.28;
}

.top-subtitle {
  display: block;
  margin-top: 18rpx;
  font-size: 25rpx;
  color: #6E6E73;
  line-height: 1.78;
}

.summary-card,
.pending-notice,
.order-card {
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(60, 60, 67, 0.10);
  box-shadow: 0 12rpx 30rpx rgba(60, 60, 67, 0.08);
}

.summary-card {
  padding: 28rpx;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18rpx;
  margin-bottom: 22rpx;
}

.summary-num {
  display: block;
  font-size: 34rpx;
  font-weight: 900;
  color: #1D1D1F;
  line-height: 1.35;
}

.summary-num.highlight {
  color: #A85F00;
}

.summary-label {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #8E8E93;
}

.pending-notice {
  padding: 24rpx 28rpx;
  margin-bottom: 22rpx;
  background: rgba(255, 179, 64, 0.15);
  border-color: rgba(255, 159, 10, 0.20);
}

.notice-title {
  display: block;
  font-size: 27rpx;
  color: #1D1D1F;
  font-weight: 900;
}

.notice-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #6E6E73;
}

.orders-list {
  height: calc(100vh - 332rpx);
  padding-bottom: calc(180rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.empty-state {
  min-height: 420rpx;
  border-radius: 28rpx;
  border: 1px dashed rgba(60, 60, 67, 0.18);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 34rpx;
  box-sizing: border-box;
}

.empty-icon {
  width: 86rpx;
  height: 86rpx;
  border-radius: 28rpx;
  background: #FFF4CB;
  color: #A85F00;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  font-weight: 900;
}

.empty-title {
  margin-top: 24rpx;
  font-size: 32rpx;
  color: #1D1D1F;
  font-weight: 900;
}

.empty-desc {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #8E8E93;
  line-height: 1.6;
  text-align: center;
}

.empty-action {
  margin-top: 26rpx;
  height: 74rpx;
  padding: 0 34rpx;
  border-radius: 22rpx;
  background: #FF9F0A;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: 900;
}

.order-card {
  padding: 26rpx;
  margin-bottom: 22rpx;
}

.order-card.pending {
  border-color: rgba(255, 159, 10, 0.24);
}

.order-card.reminded {
  border-color: rgba(217, 87, 69, 0.34);
}

.order-card.finished,
.order-card.cancelled {
  opacity: 0.78;
}

.order-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 22rpx;
}

.order-head-main {
  min-width: 0;
}

.order-title {
  display: block;
  font-size: 30rpx;
  font-weight: 900;
  color: #1D1D1F;
}

.order-sub {
  display: block;
  margin-top: 8rpx;
  font-size: 23rpx;
  color: #8E8E93;
  font-weight: 800;
}

.status-pill {
  height: 48rpx;
  padding: 0 18rpx;
  border-radius: 18rpx;
  background: rgba(242, 242, 247, 0.92);
  color: #6E6E73;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 900;
}

.status-pill.pending,
.status-pill.arranged {
  background: rgba(255, 159, 10, 0.16);
  color: #A85F00;
}

.status-pill.done {
  background: rgba(52, 199, 89, 0.13);
  color: #1f8f3a;
}

.status-pill.cancelled {
  background: rgba(217, 87, 69, 0.12);
  color: #d95745;
}

.remind-alert {
  padding: 20rpx;
  border-radius: 20rpx;
  background: rgba(217, 87, 69, 0.09);
  border: 1px solid rgba(217, 87, 69, 0.16);
  margin-bottom: 18rpx;
}

.remind-title,
.remind-text {
  display: block;
  font-size: 23rpx;
  color: #d95745;
  font-weight: 900;
}

.remind-text {
  margin-top: 6rpx;
  color: #6E6E73;
}

.order-items {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.order-item {
  min-height: 86rpx;
  padding: 14rpx;
  border-radius: 18rpx;
  background: rgba(242, 242, 247, 0.70);
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.item-image,
.item-icon {
  width: 62rpx;
  height: 62rpx;
  border-radius: 18rpx;
  flex-shrink: 0;
}

.item-icon {
  background: #FFF4CB;
  color: #A85F00;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 23rpx;
  font-weight: 900;
}

.item-main {
  min-width: 0;
  flex: 1;
}

.item-name {
  display: block;
  font-size: 26rpx;
  color: #1D1D1F;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #8E8E93;
  line-height: 1.45;
}

.item-note {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #6E6E73;
  line-height: 1.5;
  white-space: normal;
  word-break: break-all;
}

.order-note {
  margin-top: 18rpx;
  padding: 18rpx 20rpx;
  border-radius: 20rpx;
  background: rgba(255, 244, 203, 0.48);
}

.order-debug {
  margin-top: 18rpx;
  padding: 16rpx 18rpx;
  border-radius: 18rpx;
  background: rgba(217, 87, 69, 0.08);
}

.debug-label,
.debug-text {
  display: block;
  font-size: 22rpx;
  line-height: 1.5;
}

.debug-label {
  color: #d95745;
  font-weight: 900;
}

.debug-text {
  margin-top: 6rpx;
  color: #6E6E73;
  word-break: break-all;
}

.note-label,
.note-text {
  display: block;
  font-size: 24rpx;
  font-weight: 900;
}

.note-label {
  color: #A85F00;
}

.note-text {
  margin-top: 8rpx;
  color: #1D1D1F;
  line-height: 1.66;
}

.order-actions {
  display: flex;
  gap: 14rpx;
  margin-top: 24rpx;
  flex-wrap: wrap;
}

.action-btn {
  flex: 1;
  min-width: 176rpx;
  height: 74rpx;
  border-radius: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 25rpx;
  font-weight: 900;
}

.action-btn.primary {
  background: #FF9F0A;
  color: #fff;
}

.action-btn.ghost {
  background: rgba(242, 242, 247, 0.92);
  color: #1D1D1F;
}

.action-btn.danger {
  background: rgba(217, 87, 69, 0.11);
  color: #d95745;
}

.action-btn.disabled {
  background: rgba(242, 242, 247, 0.72);
  color: #8E8E93;
}

.skeleton {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.skeleton view {
  height: 168rpx;
  border-radius: 28rpx;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.62), rgba(255, 244, 203, 0.72), rgba(255, 255, 255, 0.62));
  animation: shimmer 1s ease-in-out infinite;
}

@keyframes shimmer {
  50% {
    opacity: 0.55;
  }
}
</style>
