<template>
  <view class="bottom-nav">
    <view
      v-for="item in visibleTabs"
      :key="item.key"
      class="nav-item"
      :class="{ active: active === item.key }"
      @click="go(item)"
    >
      <text class="nav-text">{{ item.label }}</text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { isAdmin } from '../utils/auth'

const props = defineProps({
  active: {
    type: String,
    default: 'home'
  }
})

const tabs = computed(() => {
  const role = isAdmin() ? 'admin' : 'user'
  return [
    { key: 'home', label: '首页', url: '/pages/home/home', roles: ['user'] },
    { key: 'order', label: '商品', url: '/pages/order/order', roles: ['admin'] },
    { key: 'orders', label: '订单', url: '/pages/orders/orders', roles: ['user', 'admin'] },
    { key: 'stats', label: '记录', url: '/pages/stats/stats', roles: ['user', 'admin'] },
    { key: 'mine', label: '我的', url: '/pages/mine/mine', roles: ['user', 'admin'] }
  ]
})

const visibleTabs = computed(() => {
  const role = isAdmin() ? 'admin' : 'user'
  return tabs.value.filter(item => item.roles.includes(role))
})

function go(item) {
  if (item.key === props.active) return
  uni.showLoading({ title: '加载中', mask: true })
  uni.redirectTo({
    url: item.url,
    complete: () => {
      setTimeout(() => {
        uni.hideLoading()
      }, 160)
    },
    fail: () => {
      uni.reLaunch({ url: item.url })
    }
  })
}
</script>

<style scoped>
.bottom-nav {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(18rpx + env(safe-area-inset-bottom));
  z-index: 900;
  height: 106rpx;
  padding: 10rpx;
  border-radius: 36rpx;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0.36)),
    rgba(255, 255, 255, 0.50);
  border: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow:
    0 22rpx 48rpx rgba(60, 60, 67, 0.18),
    inset 0 2rpx 0 rgba(255, 255, 255, 0.88),
    inset 0 -12rpx 26rpx rgba(168, 95, 0, 0.06);
  display: flex;
  box-sizing: border-box;
  overflow: hidden;
  backdrop-filter: blur(34rpx) saturate(1.6);
  -webkit-backdrop-filter: blur(34rpx) saturate(1.6);
}

.bottom-nav::before {
  content: '';
  position: absolute;
  left: 26rpx;
  right: 26rpx;
  top: 10rpx;
  height: 2rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.92);
}

.bottom-nav::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -44rpx;
  width: 360rpx;
  height: 96rpx;
  border-radius: 999rpx;
  transform: translateX(-50%);
  background: rgba(255, 179, 64, 0.12);
  filter: blur(20rpx);
}

.nav-item {
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 0;
  height: 86rpx;
  border-radius: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8E8E93;
  font-weight: 900;
  overflow: hidden;
}

.nav-item.active {
  color: #7A4A00;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.74), rgba(255, 179, 64, 0.24)),
    rgba(255, 255, 255, 0.44);
  box-shadow:
    0 10rpx 24rpx rgba(255, 159, 10, 0.16),
    inset 0 2rpx 0 rgba(255, 255, 255, 0.92),
    inset 0 -8rpx 18rpx rgba(168, 95, 0, 0.08);
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 18rpx;
  right: 18rpx;
  top: 10rpx;
  height: 2rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.82);
}

.nav-text {
  font-size: 25rpx;
  line-height: 1;
  letter-spacing: 0;
}
</style>
