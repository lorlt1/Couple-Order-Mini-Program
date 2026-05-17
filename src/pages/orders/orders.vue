<template>
  <view class="page">
    <view class="top-bar">
      <view>
        <text class="store-label">Corn's Menu</text>
        <text class="top-title">订单管理</text>
        <text class="top-subtitle">查看她下单想要什么，并更新处理状态。</text>
      </view>
    </view>

    <view class="quick-actions">
      <view class="quick-btn" @click="goBack">
        <text class="quick-icon">‹</text>
        <text>返回点单台</text>
      </view>
    </view>

    <view class="summary-card">
      <view>
        <text class="summary-num">{{ orders.length }}</text>
        <text class="summary-label">全部订单</text>
      </view>
      <view>
        <text class="summary-num highlight">{{ activeCount }}</text>
        <text class="summary-label">待完成</text>
      </view>
      <view>
        <text class="summary-num">{{ doneCount }}</text>
        <text class="summary-label">已完成</text>
      </view>
    </view>

    <view class="pending-notice" v-if="activeCount">
      <text class="notice-title">有 {{ activeCount }} 个订单待完成</text>
      <text class="notice-desc">处理好后点完成，她就知道你已经看到啦。</text>
    </view>

    <scroll-view class="orders-list" scroll-y>
      <view class="empty-state" v-if="!orders.length">
        <view class="empty-icon">单</view>
        <text class="empty-title">还没有订单</text>
        <text class="empty-desc">她下单后，你会在这里看到想要的商品。</text>
      </view>

      <view
        class="order-card"
        :class="{ pending: order.status !== 'done', finished: order.status === 'done' }"
        v-for="order in sortedOrders"
        :key="order.id"
      >
        <view class="order-head">
          <view>
            <text class="order-title">{{ formatTime(order.createdAt) }}</text>
            <text class="order-sub">{{ order.totalCount }} 件 · 合计 ¥{{ order.totalPrice }}</text>
          </view>
          <text class="status-pill" :class="order.status">{{ statusText(order.status) }}</text>
        </view>

        <view class="order-items">
          <view class="order-item" v-for="item in order.items" :key="item.id">
            <text class="item-icon">{{ item.icon }}</text>
            <view class="item-main">
              <text class="item-name">{{ item.name }}</text>
              <text class="item-meta">¥{{ item.price }} × {{ item.count }}</text>
            </view>
          </view>
        </view>

        <view class="order-note" v-if="order.note">
          <text class="note-label">备注</text>
          <text class="note-text">{{ order.note }}</text>
        </view>

        <view class="order-actions" v-if="order.status !== 'done'">
          <view class="action-btn primary" @click="finishOrder(order.id)">完成这个订单</view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { listOrders, updateOrderStatus } from '../../utils/menuApi'

const orders = ref([])

onShow(() => {
  loadOrders()
})

const activeCount = computed(() => orders.value.filter(order => order.status !== 'done').length)
const doneCount = computed(() => orders.value.filter(order => order.status === 'done').length)
const sortedOrders = computed(() => {
  return [...orders.value].sort((a, b) => {
    const aDone = a.status === 'done'
    const bDone = b.status === 'done'
    if (aDone !== bDone) {
      return aDone ? 1 : -1
    }
    return Number(b.createdAt || 0) - Number(a.createdAt || 0)
  })
})

async function loadOrders() {
  orders.value = await listOrders()
}

async function updateStatus(orderId, status) {
  orders.value = orders.value.map(order => (
    order.id === orderId ? { ...order, status } : order
  ))
  await updateOrderStatus(orderId, status)
  uni.showToast({ title: '状态已更新', icon: 'none' })
}

function finishOrder(orderId) {
  updateStatus(orderId, 'done')
}

function statusText(status) {
  const map = {
    pending: '待完成',
    arranged: '待完成',
    done: '已完成'
  }
  return map[status] || '待完成'
}

function formatTime(timestamp) {
  const date = new Date(timestamp)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

function goBack() {
  uni.navigateBack()
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
  background: #F7F6F1;
  padding-bottom: 36rpx;
  box-sizing: border-box;
}

.top-bar {
  padding: 124rpx 32rpx 52rpx;
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
  max-width: 500rpx;
  margin-top: 20rpx;
  font-size: 25rpx;
  color: #6E6E73;
  line-height: 1.7;
}

.quick-actions {
  padding: 0 32rpx 22rpx;
  margin-top: -20rpx;
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

.quick-icon {
  width: 34rpx;
  height: 34rpx;
  border-radius: 12rpx;
  background: rgba(255, 159, 10, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 900;
}

.summary-card {
  margin: 0 32rpx 24rpx;
  padding: 28rpx;
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(60, 60, 67, 0.10);
  box-shadow: 0 12rpx 30rpx rgba(60, 60, 67, 0.10);
  backdrop-filter: blur(24rpx);
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18rpx;
}

.summary-card > view {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.summary-num {
  font-size: 42rpx;
  font-weight: 900;
  color: #1D1D1F;
}

.summary-num.highlight {
  color: #6D7F00;
}

.summary-label {
  font-size: 23rpx;
  color: #8E8E93;
}

.pending-notice {
  margin: 0 32rpx 24rpx;
  padding: 22rpx 26rpx;
  border-radius: 26rpx;
  background: rgba(255, 179, 64, 0.18);
  border: 1px solid rgba(255, 159, 10, 0.22);
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.notice-title {
  font-size: 28rpx;
  font-weight: 900;
  color: #1D1D1F;
  line-height: 1.42;
}

.notice-desc {
  font-size: 23rpx;
  color: #6E6E73;
}

.orders-list {
  padding: 0 32rpx;
  box-sizing: border-box;
  max-height: calc(100vh - 342rpx);
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
  font-size: 34rpx;
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
  text-align: center;
  line-height: 1.4;
}

.order-card {
  background: rgba(255, 255, 255, 0.88);
  border-radius: 30rpx;
  padding: 28rpx;
  margin-bottom: 22rpx;
  border: 1px solid rgba(60, 60, 67, 0.10);
  box-shadow: 0 8rpx 24rpx rgba(60, 60, 67, 0.08);
}

.order-card.pending {
  border-color: rgba(255, 159, 10, 0.26);
  box-shadow: 0 12rpx 28rpx rgba(255, 159, 10, 0.12);
}

.order-card.finished {
  background: rgba(255, 255, 255, 0.72);
  box-shadow: none;
}

.order-card.finished .order-title,
.order-card.finished .item-name,
.order-card.finished .note-text {
  color: #8E8E93;
}

.order-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 22rpx;
}

.order-title {
  display: block;
  font-size: 31rpx;
  font-weight: 900;
  color: #1D1D1F;
  margin-bottom: 10rpx;
  line-height: 1.35;
}

.order-sub {
  display: block;
  font-size: 24rpx;
  color: #8E8E93;
  line-height: 1.45;
}

.status-pill {
  height: 46rpx;
  padding: 0 18rpx;
  border-radius: 18rpx;
  background: rgba(255, 179, 64, 0.18);
  color: #1D1D1F;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 900;
}

.status-pill.done {
  background: rgba(215, 229, 141, 0.52);
  color: #1D1D1F;
}

.order-items {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.order-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.item-icon {
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

.item-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.item-name {
  font-size: 27rpx;
  font-weight: 900;
  color: #1D1D1F;
}

.item-meta {
  font-size: 23rpx;
  color: #8E8E93;
}

.order-note {
  margin-top: 22rpx;
  padding: 18rpx;
  border-radius: 20rpx;
  background: rgba(242, 242, 247, 0.70);
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.note-label {
  font-size: 22rpx;
  font-weight: 900;
  color: #8E8E93;
}

.note-text {
  font-size: 26rpx;
  font-weight: 800;
  color: #1D1D1F;
  line-height: 1.62;
}

.order-actions {
  display: flex;
  margin-top: 24rpx;
}

.action-btn {
  flex: 1;
  height: 74rpx;
  border-radius: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: 900;
}

.action-btn.primary {
  background: #FF9F0A;
  color: #fff;
}
</style>
