<template>
  <view class="page">
    <view class="top-bar">
      <view class="avatar">{{ avatarText }}</view>
      <view class="profile">
        <text class="hello">我的</text>
        <text class="account">{{ session?.account || '未登录' }}</text>
        <text class="role">{{ roleText }}</text>
      </view>
    </view>

    <view class="section">
      <text class="section-title">设置</text>
      <view class="setting-card">
        <view class="setting-row">
          <view>
            <text class="setting-title">账号与安全</text>
            <text class="setting-desc">管理登录状态和本地账号缓存。</text>
          </view>
          <text class="chevron">›</text>
        </view>
        <view class="security-panel">
          <view class="info-row">
            <text>当前账号</text>
            <text>{{ session?.account || '-' }}</text>
          </view>
          <view class="info-row">
            <text>登录身份</text>
            <text>{{ roleText }}</text>
          </view>
          <view class="logout-btn" @click="handleLogout">退出登录</view>
        </view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">权限说明</text>
      <view class="setting-card compact">
        <text class="muted">
          {{ isManager ? '可以维护商品、处理订单和查看记录。' : '可以点单、添加商品和查看自己的记录。' }}
        </text>
      </view>
    </view>

    <BottomNav active="mine" />
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import BottomNav from '../../components/BottomNav.vue'
import { getSession, isAdmin, logout } from '../../utils/auth'

const session = ref(null)
const isManager = ref(false)

onShow(() => {
  session.value = getSession()
  if (!session.value) {
    uni.reLaunch({ url: '/pages/index/index' })
    return
  }
  isManager.value = isAdmin()
})

const avatarText = computed(() => (session.value?.account || 'C').slice(0, 1).toUpperCase())
const roleText = computed(() => isManager.value ? '管理员' : '普通用户')

function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '退出后会清除当前登录状态，下次需要重新登录。',
    confirmText: '退出',
    confirmColor: '#8E8E93',
    success: (res) => {
      if (!res.confirm) return
      logout()
      uni.reLaunch({ url: '/pages/index/index' })
    }
  })
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
    radial-gradient(circle at 84% 0%, rgba(255, 214, 10, 0.14), transparent 34%),
    linear-gradient(180deg, #FAF9F4 0%, #F7F6F1 56%, #F2F2ED 100%);
  animation: fade-in 0.24s ease both;
}

.top-bar {
  display: flex;
  align-items: center;
  gap: 22rpx;
  margin-bottom: 42rpx;
}

.avatar {
  width: 112rpx;
  height: 112rpx;
  border-radius: 34rpx;
  background: #FFB340;
  color: #1D1D1F;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 46rpx;
  font-weight: 900;
  box-shadow: 0 14rpx 32rpx rgba(255, 159, 10, 0.22);
}

.profile {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.hello {
  font-size: 24rpx;
  font-weight: 900;
  color: #A85F00;
}

.account {
  font-size: 42rpx;
  font-weight: 900;
  color: #1D1D1F;
  line-height: 1.25;
}

.role {
  font-size: 24rpx;
  color: #6E6E73;
}

.section {
  margin-bottom: 28rpx;
}

.section-title {
  display: block;
  margin: 0 0 14rpx 6rpx;
  font-size: 24rpx;
  font-weight: 900;
  color: #8E8E93;
}

.setting-card {
  padding: 28rpx;
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(60, 60, 67, 0.10);
  box-shadow: 0 12rpx 30rpx rgba(60, 60, 67, 0.09);
  backdrop-filter: blur(24rpx);
}

.setting-card.compact {
  padding: 26rpx;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.setting-title {
  display: block;
  font-size: 31rpx;
  font-weight: 900;
  color: #1D1D1F;
  line-height: 1.45;
}

.setting-desc,
.muted {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #6E6E73;
  line-height: 1.7;
}

.chevron {
  color: #C7C7CC;
  font-size: 42rpx;
}

.security-panel {
  margin-top: 24rpx;
  padding-top: 22rpx;
  border-top: 1px solid rgba(60, 60, 67, 0.10);
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 0;
  font-size: 25rpx;
  color: #6E6E73;
}

.info-row text:last-child {
  color: #1D1D1F;
  font-weight: 900;
}

.logout-btn {
  margin: 30rpx auto 0;
  height: 74rpx;
  max-width: 320rpx;
  border-radius: 22rpx;
  background: rgba(242, 242, 247, 0.74);
  color: #8E8E93;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 25rpx;
  font-weight: 900;
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
