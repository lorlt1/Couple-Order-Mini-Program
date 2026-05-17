<template>
  <view class="page">
    <view class="top-row">
      <view class="back-btn" @click="goBack">‹</view>
      <text class="top-label">创建账号</text>
    </view>

    <view class="hero">
      <text class="title">加入 Corn's Menu</text>
      <text class="subtitle">注册后即可体验菜单维护、购物车和模拟下单流程</text>
    </view>

    <view class="form-panel">
      <view class="form-group" :class="{ focused: focusAccount }">
        <text class="label">账号</text>
        <view class="input-wrap" :class="{ 'input-error': accountError }">
          <text class="field-icon">＠</text>
          <input
            class="input"
            v-model="account"
            placeholder="至少 3 个字符"
            placeholder-class="placeholder"
            @focus="focusAccount = true"
            @blur="focusAccount = false"
          />
        </view>
        <text class="error-msg" v-if="accountError">{{ accountError }}</text>
      </view>

      <view class="form-group" :class="{ focused: focusPassword }">
        <text class="label">密码</text>
        <view class="input-wrap" :class="{ 'input-error': passwordError }">
          <text class="field-icon">锁</text>
          <input
            class="input"
            :type="showPassword ? 'text' : 'password'"
            v-model="password"
            placeholder="至少 6 位"
            placeholder-class="placeholder"
            @focus="focusPassword = true"
            @blur="focusPassword = false"
          />
          <text class="toggle-pw" @click="showPassword = !showPassword">
            {{ showPassword ? '隐藏' : '显示' }}
          </text>
        </view>
        <text class="error-msg" v-if="passwordError">{{ passwordError }}</text>
      </view>

      <view class="form-group" :class="{ focused: focusConfirm }">
        <text class="label">确认密码</text>
        <view class="input-wrap" :class="{ 'input-error': confirmError }">
          <text class="field-icon">验</text>
          <input
            class="input"
            :type="showConfirm ? 'text' : 'password'"
            v-model="confirmPassword"
            placeholder="再次输入密码"
            placeholder-class="placeholder"
            @focus="focusConfirm = true"
            @blur="focusConfirm = false"
          />
          <text class="toggle-pw" @click="showConfirm = !showConfirm">
            {{ showConfirm ? '隐藏' : '显示' }}
          </text>
        </view>
        <text class="error-msg" v-if="confirmError">{{ confirmError }}</text>
      </view>

      <view class="password-rule">
        <text :class="{ active: account.trim().length >= 3 }">账号 3 位+</text>
        <text :class="{ active: password.length >= 6 }">密码 6 位+</text>
        <text :class="{ active: password && confirmPassword === password }">两次一致</text>
      </view>

      <button
        class="primary-btn"
        :class="{ loading: isLoading }"
        :disabled="isLoading"
        @click="handleRegister"
      >
        <text v-if="!isLoading">注册</text>
        <text v-else>创建中...</text>
      </button>

      <view class="login-row">
        <text class="login-text">已有账号？</text>
        <text class="login-link" @click="goBack">去登录</text>
      </view>
    </view>

    <view class="success-overlay" :class="{ show: showSuccess }" @click="goBack">
      <view class="checkmark">✓</view>
      <text class="success-title">注册成功</text>
      <text class="success-desc">点击返回登录页，账号会自动填入</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const account = ref('')
const password = ref('')
const confirmPassword = ref('')
const focusAccount = ref(false)
const focusPassword = ref(false)
const focusConfirm = ref(false)
const showPassword = ref(false)
const showConfirm = ref(false)
const isLoading = ref(false)
const showSuccess = ref(false)
const accountError = ref('')
const passwordError = ref('')
const confirmError = ref('')

function clearErrors() {
  accountError.value = ''
  passwordError.value = ''
  confirmError.value = ''
}

function handleRegister() {
  clearErrors()
  let hasError = false

  if (!account.value.trim()) {
    accountError.value = '请输入账号'
    hasError = true
  } else if (account.value.trim().length < 3) {
    accountError.value = '账号至少 3 个字符'
    hasError = true
  }

  if (!password.value) {
    passwordError.value = '请设置密码'
    hasError = true
  } else if (password.value.length < 6) {
    passwordError.value = '密码至少 6 位'
    hasError = true
  }

  if (!confirmPassword.value) {
    confirmError.value = '请确认密码'
    hasError = true
  } else if (password.value && confirmPassword.value !== password.value) {
    confirmError.value = '两次密码不一致'
    hasError = true
  }

  if (hasError) return

  const users = uni.getStorageSync('registeredUsers') || []
  if (users.find(u => u.account === account.value.trim())) {
    accountError.value = '该账号已被注册'
    return
  }

  isLoading.value = true
  setTimeout(() => {
    isLoading.value = false
    users.push({ account: account.value.trim(), password: password.value })
    uni.setStorageSync('registeredUsers', users)
    showSuccess.value = true
  }, 800)
}

function goBack() {
  if (account.value.trim() || password.value) {
    uni.$emit('fillLogin', {
      account: account.value.trim(),
      password: password.value
    })
  }
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
  padding: 96rpx 34rpx 44rpx;
  box-sizing: border-box;
  background:
    radial-gradient(circle at 18% 10%, rgba(255, 214, 10, 0.14), transparent 30%),
    radial-gradient(circle at 84% 16%, rgba(199, 216, 107, 0.12), transparent 28%),
    linear-gradient(180deg, #FAF9F4 0%, #F7F6F1 56%, #F2F2ED 100%);
}

.top-row {
  display: flex;
  align-items: center;
  gap: 18rpx;
}

.back-btn {
  width: 72rpx;
  height: 72rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.82);
  color: #1D1D1F;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 56rpx;
  line-height: 1;
  border: 1px solid rgba(60, 60, 67, 0.10);
  box-shadow: 0 10rpx 28rpx rgba(60, 60, 67, 0.08);
  backdrop-filter: blur(20rpx);
}

.top-label {
  font-size: 27rpx;
  font-weight: 900;
  color: #6E6E73;
}

.hero {
  padding: 58rpx 4rpx 52rpx;
}

.title {
  display: block;
  font-size: 52rpx;
  font-weight: 900;
  color: #1D1D1F;
  line-height: 1.24;
}

.subtitle {
  display: block;
  margin-top: 24rpx;
  font-size: 27rpx;
  color: #6E6E73;
  line-height: 1.78;
}

.form-panel {
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(60, 60, 67, 0.10);
  border-radius: 34rpx;
  padding: 38rpx 30rpx 34rpx;
  box-shadow: 0 18rpx 44rpx rgba(60, 60, 67, 0.10);
  backdrop-filter: blur(24rpx);
}

.form-group {
  margin-bottom: 32rpx;
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
  min-height: 92rpx;
  border-radius: 24rpx;
  background: rgba(242, 242, 247, 0.82);
  border: 2rpx solid transparent;
  display: flex;
  align-items: center;
  padding: 0 22rpx;
  box-sizing: border-box;
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
}

.form-group.focused .input-wrap {
  background: #fff;
  border-color: rgba(255, 159, 10, 0.48);
  box-shadow: 0 0 0 6rpx rgba(255, 159, 10, 0.10);
}

.input-wrap.input-error {
  border-color: #d95745;
  background: #fff7f5;
}

.field-icon {
  width: 54rpx;
  color: #8E8E93;
  font-size: 25rpx;
  font-weight: 800;
}

.input {
  flex: 1;
  height: 92rpx;
  font-size: 29rpx;
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

.password-rule {
  display: flex;
  gap: 12rpx;
  margin: 4rpx 0 32rpx;
}

.password-rule text {
  flex: 1;
  height: 52rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(242, 242, 247, 0.82);
  color: #8E8E93;
  font-size: 22rpx;
  font-weight: 800;
}

.password-rule text.active {
  background: rgba(215, 229, 141, 0.38);
  color: #1D1D1F;
}

.primary-btn {
  height: 98rpx;
  border-radius: 26rpx;
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

.login-row {
  margin-top: 30rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.login-text {
  font-size: 26rpx;
  color: #8E8E93;
}

.login-link {
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
