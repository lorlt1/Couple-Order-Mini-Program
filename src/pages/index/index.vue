<template>
  <view class="page">
    <view class="hero">
      <view class="brand-mark">C</view>
      <text class="eyebrow">Corn's Menu · 专属入口</text>
      <text class="title">欢迎回来</text>
      <text class="subtitle">登录后进入私人点单台，先添加商品，再开始点单。</text>
    </view>

    <view class="form-panel">
      <view class="form-group" :class="{ focused: focusAccount }">
        <text class="label">账号</text>
        <view class="input-wrap" :class="{ 'input-error': accountError }">
          <input
            class="input"
            v-model="account"
            placeholder="请输入专属账号"
            placeholder-class="placeholder"
            confirm-type="next"
            maxlength="20"
            @focus="focusAccount = true"
            @blur="focusAccount = false"
          />
        </view>
        <text class="error-msg" v-if="accountError">{{ accountError }}</text>
      </view>

      <view class="form-group" :class="{ focused: focusPassword }">
        <text class="label">密码</text>
        <view class="input-wrap" :class="{ 'input-error': passwordError }">
          <input
            class="input"
            :type="showPassword ? 'text' : 'password'"
            v-model="password"
            placeholder="请输入密码"
            placeholder-class="placeholder"
            confirm-type="done"
            maxlength="24"
            @focus="focusPassword = true"
            @blur="focusPassword = false"
          />
          <text class="toggle-pw" @click="showPassword = !showPassword">
            {{ showPassword ? '隐藏' : '显示' }}
          </text>
        </view>
        <text class="error-msg" v-if="passwordError">{{ passwordError }}</text>
      </view>

      <button
        class="primary-btn"
        :class="{ loading: isLoading }"
        :disabled="isLoading"
        @click="handleLogin"
      >
        <text v-if="!isLoading">进入点单台</text>
        <text v-else>正在安排...</text>
      </button>

      <view class="signup-row">
        <text class="signup-text">私人菜单，自己添加想要的商品。</text>
        <text class="signup-link" @click="handleSignup">去创建</text>
      </view>
    </view>

    <view class="success-overlay" :class="{ show: showSuccess }" @click="showSuccess = false">
      <view class="checkmark">✓</view>
      <text class="success-title">欢迎回来</text>
      <text class="success-desc">今天的好喝菜单已经准备好啦</text>
    </view>
  </view>
</template>

<script setup>
import { onUnmounted, ref } from 'vue'

const account = ref('')
const password = ref('')
const focusAccount = ref(false)
const focusPassword = ref(false)
const showPassword = ref(false)
const isLoading = ref(false)
const showSuccess = ref(false)
const accountError = ref('')
const passwordError = ref('')

function fillLogin(data = {}) {
  account.value = data.account || ''
  password.value = data.password || ''
}

uni.$on('fillLogin', fillLogin)
onUnmounted(() => {
  uni.$off('fillLogin', fillLogin)
})

function clearErrors() {
  accountError.value = ''
  passwordError.value = ''
}

function handleLogin() {
  clearErrors()
  let hasError = false

  if (!account.value.trim()) {
    accountError.value = '请输入账号'
    hasError = true
  }
  if (!password.value) {
    passwordError.value = '请输入密码'
    hasError = true
  }

  if (hasError) return

  const users = uni.getStorageSync('registeredUsers') || []
  const user = users.find(u => u.account === account.value.trim() && u.password === password.value)
  if (!user) {
    accountError.value = '账号或密码不对'
    passwordError.value = '再试一次，我在这等你'
    return
  }

  isLoading.value = true
  setTimeout(() => {
    isLoading.value = false
    showSuccess.value = true
    setTimeout(() => {
      showSuccess.value = false
      uni.navigateTo({ url: '/pages/order/order' })
    }, 900)
  }, 800)
}

function handleSignup() {
  uni.navigateTo({ url: '/pages/register/register' })
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
  padding: 112rpx 34rpx 44rpx;
  box-sizing: border-box;
  background:
    radial-gradient(circle at 82% 6%, rgba(255, 214, 10, 0.16), transparent 32%),
    radial-gradient(circle at 12% 16%, rgba(199, 216, 107, 0.12), transparent 28%),
    linear-gradient(180deg, #FAF9F4 0%, #F7F6F1 46%, #F2F2ED 100%);
}

.hero {
  width: 574rpx;
  max-width: 100%;
  margin: 0 auto;
  padding: 44rpx 0 44rpx;
  box-sizing: border-box;
}

.brand-mark {
  width: 96rpx;
  height: 96rpx;
  border-radius: 28rpx;
  background: rgba(255, 159, 10, 0.16);
  color: #A85F00;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  font-weight: 900;
  margin-bottom: 36rpx;
  border: 1px solid rgba(255, 159, 10, 0.22);
  box-shadow: 0 12rpx 30rpx rgba(60, 60, 67, 0.10);
}

.eyebrow {
  display: block;
  font-size: 26rpx;
  font-weight: 800;
  color: #A85F00;
  margin-bottom: 16rpx;
  line-height: 1.45;
}

.title {
  display: block;
  font-size: 64rpx;
  font-weight: 900;
  color: #1D1D1F;
  line-height: 1.12;
}

.subtitle {
  display: block;
  margin-top: 22rpx;
  font-size: 28rpx;
  line-height: 1.58;
  color: #6E6E73;
}

.form-panel {
  width: 574rpx;
  max-width: 100%;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(60, 60, 67, 0.10);
  border-radius: 36rpx;
  padding: 42rpx 38rpx 34rpx;
  box-shadow: 0 26rpx 58rpx rgba(60, 60, 67, 0.11);
  backdrop-filter: blur(24rpx);
}

.form-group {
  margin-bottom: 34rpx;
}

.label {
  display: block;
  font-size: 25rpx;
  font-weight: 800;
  color: #6E6E73;
  margin-bottom: 16rpx;
  line-height: 1.45;
}

.input-wrap {
  min-height: 88rpx;
  border-radius: 24rpx;
  background: rgba(242, 242, 247, 0.82);
  border: 2rpx solid transparent;
  display: flex;
  align-items: center;
  padding: 0 28rpx;
  box-sizing: border-box;
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
}

.form-group.focused .input-wrap {
  background: #fff;
  border-color: rgba(255, 159, 10, 0.56);
  box-shadow: 0 0 0 6rpx rgba(255, 159, 10, 0.12);
}

.input-wrap.input-error {
  border-color: #d95745;
  background: #fff7f5;
}

.input {
  flex: 1;
  height: 86rpx;
  font-size: 28rpx;
  color: #1D1D1F;
}

.placeholder {
  color: #AEAEB2;
}

.toggle-pw {
  font-size: 24rpx;
  font-weight: 800;
  color: #A85F00;
  padding-left: 18rpx;
}

.error-msg {
  display: block;
  margin-top: 10rpx;
  font-size: 23rpx;
  color: #d95745;
}

.primary-btn {
  height: 98rpx;
  border-radius: 28rpx;
  background: #FFB340;
  color: #1D1D1F;
  font-size: 31rpx;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 14rpx 30rpx rgba(255, 159, 10, 0.22);
}

.primary-btn::after {
  border: 0;
}

.primary-btn[disabled] {
  opacity: 0.78;
}

.signup-row {
  margin-top: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.signup-text {
  font-size: 26rpx;
  color: #8E8E93;
}

.signup-link {
  font-size: 26rpx;
  font-weight: 900;
  color: #A85F00;
}

.success-overlay {
  position: fixed;
  inset: 0;
  background: rgba(247, 246, 241, 0.96);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22rpx;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s;
  z-index: 100;
}

.success-overlay.show {
  opacity: 1;
  pointer-events: all;
}

.checkmark {
  width: 118rpx;
  height: 118rpx;
  border-radius: 50%;
  background: #D7E58D;
  color: #1D1D1F;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 62rpx;
  font-weight: 900;
}

.success-title {
  font-size: 38rpx;
  font-weight: 900;
  color: #1D1D1F;
}

.success-desc {
  font-size: 27rpx;
  color: #6E6E73;
}
</style>
