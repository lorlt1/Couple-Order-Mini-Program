<template>
  <view class="page">
    <view class="hero">
      <text class="store-label">Corn's Menu</text>
      <text class="title">今天想喝点什么？</text>
      <text class="subtitle">选一件喜欢的，今天也被好好照顾。</text>
    </view>

    <view class="skeleton" v-if="isLoading">
      <view></view>
      <view></view>
      <view></view>
    </view>

    <view v-else>
      <view class="profile-card">
        <view class="profile-left">
          <view class="avatar">
            <text>{{ avatarText }}</text>
          </view>
          <view class="profile-main">
            <view class="profile-name-row">
              <text class="profile-name">{{ accountName }}</text>
              <text class="level-badge">{{ levelName }}</text>
            </view>
            <view class="level-line">
              <view class="level-track">
                <view class="level-fill" :style="{ width: levelPercent + '%' }"></view>
              </view>
              <text class="level-text">{{ levelProgressText }}</text>
            </view>
            <text class="profile-hint">{{ upgradeHint }}</text>
          </view>
        </view>
        <view class="order-cta" @click="go('/pages/order/order')">
          <text>去点单</text>
        </view>
      </view>

      <view class="panel status-panel">
        <view class="panel-head">
          <text class="panel-title">最近状态</text>
          <text class="panel-more" @click="go('/pages/stats/stats')">点单记录</text>
        </view>
        <view class="status-hero" @click="go('/pages/stats/stats')">
          <view>
            <text class="status-label">最近一单</text>
            <text class="status-title">{{ latestOrderTitle }}</text>
            <text class="status-desc">{{ latestOrderDesc }}</text>
          </view>
          <text class="status-pill" :class="latestOrderStatus">{{ latestOrderStatusText }}</text>
        </view>
        <view class="mini-stats">
          <view>
            <text class="mini-num">{{ orderCount }}</text>
            <text class="mini-label">我的订单</text>
          </view>
          <view>
            <text class="mini-num">{{ pendingCount }}</text>
            <text class="mini-label">进行中</text>
          </view>
        </view>
      </view>
    </view>

    <BottomNav active="home" />
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import BottomNav from '../../components/BottomNav.vue'
import { getEntryPage, getSession, isAdmin } from '../../utils/auth'
import { getErrorMessage, listOrders } from '../../utils/menuApi'

const orders = ref([])
const isLoading = ref(true)
const activeAccount = ref('')
const sessionInfo = ref(null)

onShow(async () => {
  const session = getSession()
  if (!session) {
    uni.reLaunch({ url: '/pages/index/index' })
    return
  }
  if (isAdmin()) {
    uni.reLaunch({ url: getEntryPage('admin') })
    return
  }

  sessionInfo.value = session
  const accountKey = session.userId || session.account
  if (activeAccount.value && activeAccount.value !== accountKey) {
    orders.value = []
  }
  activeAccount.value = accountKey
  isLoading.value = true
  try {
    orders.value = await listOrders()
  } catch (error) {
    orders.value = []
    uni.showToast({ title: getErrorMessage(error, '首页数据加载失败'), icon: 'none' })
  } finally {
    isLoading.value = false
  }
})

const orderCount = computed(() => orders.value.length)
const pendingCount = computed(() => orders.value.filter(order => order.status !== 'done' && order.status !== 'cancelled').length)
const doneCount = computed(() => orders.value.filter(order => order.status === 'done').length)
const validOrderCount = computed(() => orders.value.filter(order => order.status !== 'cancelled').length)
const accountName = computed(() => sessionInfo.value?.account || 'Corn')
const avatarText = computed(() => accountName.value.slice(0, 1).toUpperCase())
const level = computed(() => Math.floor(validOrderCount.value / 3) + 1)
const levelName = computed(() => `S${level.value}`)
const levelCurrent = computed(() => validOrderCount.value % 3)
const levelPercent = computed(() => Math.round((levelCurrent.value / 3) * 100))
const levelProgressText = computed(() => `${levelCurrent.value}/3 件`)
const upgradeHint = computed(() => {
  const remain = 3 - levelCurrent.value
  return remain === 3 ? '点一件，开启本月小等级' : `再点 ${remain} 件升级`
})
const latestOrder = computed(() => {
  return [...orders.value].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0] || null
})
const latestOrderStatus = computed(() => latestOrder.value?.status || 'empty')
const latestOrderStatusText = computed(() => {
  const map = {
    pending: '进行中',
    arranged: '进行中',
    done: '已完成',
    cancelled: '已取消',
    empty: '暂无'
  }
  return map[latestOrderStatus.value] || '进行中'
})
const latestOrderTitle = computed(() => {
  const order = latestOrder.value
  if (!order) return '还没有下单'
  return (order.items || []).map(item => item.name).slice(0, 2).join('、') || '未命名订单'
})
const latestOrderDesc = computed(() => {
  const order = latestOrder.value
  if (!order) return '点一件喜欢的，订单状态会显示在这里。'
  return `${order.totalCount || orderItemCount(order)} 件`
})
function go(url) {
  uni.redirectTo({ url })
}

function orderItemCount(order) {
  return (order.items || []).reduce((sum, item) => sum + Number(item.count || 1), 0)
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
  padding: 124rpx 32rpx 158rpx;
  box-sizing: border-box;
  background:
    radial-gradient(circle at 82% 0%, rgba(255, 214, 10, 0.16), transparent 34%),
    linear-gradient(180deg, #FAF9F4 0%, #F7F6F1 52%, #F2F2ED 100%);
  animation: fade-in 0.24s ease both;
}

.hero {
  margin-bottom: 26rpx;
}

.store-label {
  display: block;
  font-size: 24rpx;
  font-weight: 800;
  color: #A85F00;
  margin-bottom: 16rpx;
  line-height: 1.45;
}

.title {
  display: block;
  font-size: 58rpx;
  font-weight: 900;
  color: #1D1D1F;
  line-height: 1.22;
}

.subtitle {
  display: block;
  margin-top: 22rpx;
  font-size: 27rpx;
  color: #6E6E73;
  line-height: 1.76;
}

.panel {
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(60, 60, 67, 0.10);
  box-shadow: 0 12rpx 30rpx rgba(60, 60, 67, 0.09);
  backdrop-filter: blur(24rpx);
}

.profile-card {
  min-height: 150rpx;
  padding: 22rpx 24rpx;
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.90);
  border: 1px solid rgba(60, 60, 67, 0.10);
  box-shadow: 0 16rpx 38rpx rgba(60, 60, 67, 0.11);
  backdrop-filter: blur(24rpx);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.profile-left {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 18rpx;
}

.avatar {
  width: 84rpx;
  height: 84rpx;
  border-radius: 50%;
  background:
    linear-gradient(135deg, rgba(255, 244, 203, 0.92), rgba(215, 229, 141, 0.60));
  border: 5rpx solid rgba(168, 95, 0, 0.18);
  color: #A85F00;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  font-weight: 900;
  flex-shrink: 0;
}

.profile-main {
  min-width: 0;
  flex: 1;
}

.profile-name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 10rpx;
}

.profile-name {
  max-width: 240rpx;
  color: #1D1D1F;
  font-size: 31rpx;
  font-weight: 900;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.level-badge {
  min-width: 50rpx;
  height: 36rpx;
  padding: 0 12rpx;
  border-radius: 16rpx;
  background: #8A9D12;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 900;
}

.level-line {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}

.level-track {
  flex: 1;
  height: 10rpx;
  border-radius: 12rpx;
  background: rgba(242, 242, 247, 0.90);
  overflow: hidden;
}

.level-fill {
  height: 100%;
  border-radius: 12rpx;
  background: linear-gradient(90deg, #FFB340, #D7E58D);
}

.level-text {
  width: 66rpx;
  color: #8E8E93;
  font-size: 20rpx;
  font-weight: 900;
}

.profile-hint {
  display: block;
  font-size: 21rpx;
  color: #6E6E73;
  line-height: 1.4;
}

.order-cta {
  width: 118rpx;
  height: 62rpx;
  border-radius: 24rpx;
  background: #8A9D12;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: 900;
  box-shadow: 0 12rpx 26rpx rgba(138, 157, 18, 0.22);
  flex-shrink: 0;
}

.panel {
  margin-top: 26rpx;
  padding: 34rpx;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 26rpx;
}

.panel-title {
  font-size: 34rpx;
  font-weight: 900;
  color: #1D1D1F;
}

.panel-more {
  font-size: 25rpx;
  font-weight: 900;
  color: #A85F00;
}

.mini-stats {
  display: flex;
  gap: 16rpx;
}

.mini-stats > view {
  min-width: 0;
  flex: 1;
  padding: 30rpx 18rpx;
  border-radius: 24rpx;
  background: rgba(242, 242, 247, 0.70);
}

.status-panel {
  padding-bottom: 36rpx;
}

.status-hero {
  min-height: 176rpx;
  border-radius: 28rpx;
  background: linear-gradient(135deg, rgba(255, 179, 64, 0.20), rgba(255, 244, 203, 0.78));
  border: 1px solid rgba(255, 159, 10, 0.16);
  padding: 30rpx;
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 22rpx;
}

.status-hero:active {
  opacity: 0.88;
}

.status-label {
  display: block;
  font-size: 23rpx;
  color: #8E8E93;
  font-weight: 900;
  margin-bottom: 10rpx;
}

.status-title {
  display: block;
  font-size: 36rpx;
  color: #1D1D1F;
  font-weight: 900;
  line-height: 1.35;
}

.status-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 25rpx;
  color: #6E6E73;
  line-height: 1.5;
}

.status-pill {
  flex-shrink: 0;
  min-width: 96rpx;
  height: 52rpx;
  padding: 0 18rpx;
  border-radius: 18rpx;
  background: rgba(255, 159, 10, 0.18);
  color: #A85F00;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 23rpx;
  font-weight: 900;
}

.status-pill.done {
  background: rgba(215, 229, 141, 0.52);
  color: #617000;
}

.status-pill.cancelled,
.status-pill.empty {
  background: rgba(142, 142, 147, 0.14);
  color: #8E8E93;
}

.mini-num {
  display: block;
  font-size: 36rpx;
  font-weight: 900;
  color: #1D1D1F;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-label {
  display: block;
  margin-top: 10rpx;
  font-size: 23rpx;
  color: #8E8E93;
}

.skeleton {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.skeleton view {
  height: 130rpx;
  border-radius: 28rpx;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.62), rgba(255, 244, 203, 0.72), rgba(255, 255, 255, 0.62));
  animation: shimmer 1s ease-in-out infinite;
}

@keyframes shimmer {
  50% {
    opacity: 0.55;
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
