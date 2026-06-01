<template>
  <view class="page">
    <view class="hero">
      <view class="brand-mark">C</view>
      <text class="eyebrow">Corn's Menu · 专属入口</text>
      <text class="title">欢迎回来</text>
      <text class="subtitle">登录后进入自己的页面；管理员需要点击下方入口并填写识别码。</text>
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
            type="text"
            :password="!showPassword"
            v-model="password"
            placeholder="请输入密码"
            placeholder-class="placeholder"
            confirm-type="done"
            maxlength="24"
            @focus="focusPassword = true"
            @blur="focusPassword = false"
          />
          <text class="toggle-pw" @click="showPassword = !showPassword">
            {{ showPassword ? '隐藏密码' : '显示密码' }}
          </text>
        </view>
        <text class="error-msg" v-if="passwordError">{{ passwordError }}</text>
      </view>

      <view class="admin-entry" @click="showAdminCode = !showAdminCode">
        <text>{{ showAdminCode ? '收起管理员入口' : '我是管理员' }}</text>
      </view>

      <view class="form-group admin-code" v-if="showAdminCode" :class="{ focused: focusAdminCode }">
        <text class="label">管理员识别码</text>
        <view class="input-wrap">
          <input
            class="input"
            v-model="adminCode"
            placeholder="选填，不影响普通用户登录"
            placeholder-class="placeholder"
            maxlength="16"
            @focus="focusAdminCode = true"
            @blur="focusAdminCode = false"
          />
        </view>
      </view>

      <view class="login-options">
        <view class="option-item" @click="rememberLogin = !rememberLogin">
          <text class="check-box" :class="{ checked: rememberLogin }">{{ rememberLogin ? '✓' : '' }}</text>
          <text>记住账号</text>
        </view>
        <view class="option-item" @click="keepLogin = !keepLogin">
          <text class="check-box" :class="{ checked: keepLogin }">{{ keepLogin ? '✓' : '' }}</text>
          <text>保持登录</text>
        </view>
      </view>

      <button class="primary-btn" :disabled="isLoading" @click="handleLogin">
        <text>{{ isLoading ? '正在进入...' : '登录' }}</text>
      </button>

      <view class="signup-row">
        <text class="signup-text">还没有账号？</text>
        <text class="signup-link" @click="handleSignup">去创建</text>
      </view>
    </view>

    <view class="transition-mask" :class="{ show: isLoading || showSuccess }">
      <view class="loader"></view>
      <text class="transition-title">{{ showSuccess ? '登录成功' : '正在校验账号' }}</text>
      <text class="transition-desc">{{ transitionText }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  clearCurrentAccountState,
  clearRememberedAccount,
  createSession,
  getEntryPage,
  getRememberedAccount,
  getSession,
  rememberAccount,
  verifyUser
} from '../../utils/auth'

const account = ref('')
const password = ref('')
const adminCode = ref('')
const focusAccount = ref(false)
const focusPassword = ref(false)
const focusAdminCode = ref(false)
const showPassword = ref(false)
const showAdminCode = ref(false)
const isLoading = ref(false)
const showSuccess = ref(false)
const transitionText = ref('请稍等一下')
const accountError = ref('')
const passwordError = ref('')
const rememberLogin = ref(false)
const keepLogin = ref(false)

onShow(() => {
  const session = getSession()
  if (session?.keepLogin) {
    uni.reLaunch({ url: getEntryPage(session.role) })
    return
  }

  const rememberedAccount = getRememberedAccount()
  if (rememberedAccount && !account.value) {
    account.value = rememberedAccount
    rememberLogin.value = true
  }
})

function clearErrors() {
  accountError.value = ''
  passwordError.value = ''
}

function clearFormAfterLogin() {
  password.value = ''
  adminCode.value = ''
  showAdminCode.value = false
  showPassword.value = false
}

async function handleLogin() {
  clearErrors()
  const accountText = account.value.trim()
  let hasError = false

  if (!accountText) {
    accountError.value = '请输入账号'
    hasError = true
  }
  if (!password.value) {
    passwordError.value = '请输入密码'
    hasError = true
  }
  if (hasError) return

  isLoading.value = true
  transitionText.value = '正在校验账号'

  const result = await verifyUser(accountText, password.value)
  if (!result.ok) {
    isLoading.value = false
    if (result.reason === 'not-found') {
      accountError.value = '账号不存在'
    } else if (result.reason === 'network') {
      passwordError.value = result.message || '登录失败，请稍后重试'
    } else {
      passwordError.value = '密码错误'
    }
    return
  }

  const role = showAdminCode.value && adminCode.value.trim() === 'admin' ? 'admin' : 'user'
  transitionText.value = role === 'admin' ? '正在进入管理页' : '正在进入菜单'

  setTimeout(() => {
    try {
      clearCurrentAccountState()
      const session = createSession(result.user, keepLogin.value, role)
      if (rememberLogin.value || keepLogin.value) {
        rememberAccount(result.user.account)
      } else {
        clearRememberedAccount()
      }
      clearFormAfterLogin()
      showSuccess.value = true
      setTimeout(() => {
        uni.reLaunch({ url: getEntryPage(session.role) })
      }, 420)
    } catch (error) {
      isLoading.value = false
      showSuccess.value = false
      uni.showToast({ title: '登录状态初始化失败', icon: 'none' })
    }
  }, 360)
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
  animation: fade-in 0.24s ease both;
}

.hero {
  width: 574rpx;
  max-width: 100%;
  margin: 0 auto;
  padding: 44rpx 0;
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
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(60, 60, 67, 0.10);
  border-radius: 36rpx;
  padding: 42rpx 38rpx 34rpx;
  box-shadow: 0 26rpx 58rpx rgba(60, 60, 67, 0.11);
  backdrop-filter: blur(24rpx);
}

.form-group {
  margin-bottom: 34rpx;
}

.admin-code {
  margin-top: 18rpx;
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

.admin-entry {
  margin: -10rpx 0 22rpx;
  color: #8E8E93;
  font-size: 24rpx;
  font-weight: 800;
}

.login-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin: -4rpx 0 28rpx;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 10rpx;
  color: #6E6E73;
  font-size: 24rpx;
  font-weight: 800;
}

.check-box {
  width: 34rpx;
  height: 34rpx;
  border-radius: 10rpx;
  border: 2rpx solid rgba(60, 60, 67, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1D1D1F;
  font-size: 22rpx;
  box-sizing: border-box;
}

.check-box.checked {
  background: #FFB340;
  border-color: #FFB340;
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

.transition-mask {
  position: fixed;
  inset: 0;
  background: rgba(247, 246, 241, 0.96);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 100;
}

.transition-mask.show {
  opacity: 1;
  pointer-events: all;
}

.loader {
  width: 74rpx;
  height: 74rpx;
  border-radius: 50%;
  border: 8rpx solid rgba(255, 179, 64, 0.25);
  border-top-color: #FFB340;
  animation: spin 0.8s linear infinite;
}

.transition-title {
  font-size: 34rpx;
  font-weight: 900;
  color: #1D1D1F;
}

.transition-desc {
  font-size: 25rpx;
  color: #6E6E73;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
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
