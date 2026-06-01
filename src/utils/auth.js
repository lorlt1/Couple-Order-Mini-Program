import { isCloudReady } from '../config/cloud'

const USERS_KEY = 'registeredUsers'
const SESSION_KEY = 'cornMenuSession'
const REMEMBER_KEY = 'cornMenuRememberedAccount'
const RESET_VERSION_KEY = 'cornMenuResetVersion'
const CURRENT_RESET_VERSION = '2026-05-23-strict-user-isolation-reset'

export function resetLocalDataOnce() {
  if (uni.getStorageSync(RESET_VERSION_KEY) === CURRENT_RESET_VERSION) return

  const users = getUsers()
  users.forEach(user => {
    clearAccountCache(user.userId || user.account)
    clearAccountCache(user.account)
  })
  clearSession()
  clearRememberedAccount()
  uni.removeStorageSync(USERS_KEY)
  uni.setStorageSync(RESET_VERSION_KEY, CURRENT_RESET_VERSION)
}

export function hashPassword(password = '') {
  let hash = 2166136261
  const text = String(password)
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a:${(hash >>> 0).toString(16)}`
}

async function callAuthCloud(action, payload = {}) {
  if (!isCloudReady()) {
    throw new Error('cloud-not-configured')
  }

  const response = await wx.cloud.callFunction({
    name: 'menuApi',
    data: {
      action,
      ...payload
    }
  })
  const result = response.result
  if (!result || result.ok === false) {
    const error = new Error(result?.message || '账号服务异常')
    error.code = result?.code || 'auth-cloud-failed'
    throw error
  }
  return result.data
}

export function getUsers() {
  return uni.getStorageSync(USERS_KEY) || []
}

export function saveUsers(users) {
  uni.setStorageSync(USERS_KEY, users)
}

export async function createUser(account, password) {
  const passwordHash = hashPassword(password)
  if (isCloudReady()) {
    const user = await callAuthCloud('registerUser', {
      account,
      passwordHash
    })
    upsertLocalUser({
      ...user,
      passwordHash
    })
    return user
  }

  const users = getUsers()
  if (users.find(item => item.account === account)) {
    const error = new Error('该账号已被注册')
    error.code = 'account-exists'
    throw error
  }
  const user = {
    userId: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    account,
    passwordHash,
    role: 'user',
    createdAt: Date.now()
  }
  users.push(user)
  saveUsers(users)
  return user
}

export async function verifyUser(account, password) {
  const passwordHash = hashPassword(password)
  if (isCloudReady()) {
    try {
      const user = await callAuthCloud('loginUser', {
        account,
        passwordHash
      })
      upsertLocalUser({
        ...user,
        passwordHash
      })
      return { ok: true, user }
    } catch (error) {
      if (error.code === 'account-not-found') {
        const localUser = verifyLocalUser(account, password, passwordHash)
        if (localUser) {
          try {
            const migratedUser = await callAuthCloud('registerUser', {
              account,
              passwordHash
            })
            upsertLocalUser({
              ...migratedUser,
              passwordHash
            })
            return { ok: true, user: migratedUser }
          } catch (migrationError) {
            return { ok: true, user: localUser }
          }
        }
        return { ok: false, reason: 'not-found' }
      }
      if (error.code === 'wrong-password') return { ok: false, reason: 'password' }
      return { ok: false, reason: 'network', message: error.message }
    }
  }

  const users = getUsers()
  const user = users.find(item => item.account === account)
  if (!user) return { ok: false, reason: 'not-found' }

  if (!user.userId) {
    user.userId = `user-${Date.now()}-${Math.random().toString(36).slice(2)}`
    saveUsers(users)
  }

  if (user.passwordHash === passwordHash) {
    return { ok: true, user }
  }

  if (user.password === password) {
    delete user.password
    user.passwordHash = passwordHash
    saveUsers(users)
    return { ok: true, user }
  }

  return { ok: false, reason: 'password' }
}

function verifyLocalUser(account, password, passwordHash = hashPassword(password)) {
  const users = getUsers()
  const user = users.find(item => item.account === account)
  if (!user) return null

  if (!user.userId) {
    user.userId = `user-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  if (user.passwordHash === passwordHash) {
    saveUsers(users)
    return user
  }

  if (user.password === password) {
    delete user.password
    user.passwordHash = passwordHash
    saveUsers(users)
    return user
  }

  return null
}

function upsertLocalUser(user) {
  const users = getUsers()
  const index = users.findIndex(item => item.account === user.account)
  if (index >= 0) {
    users[index] = {
      ...users[index],
      ...user
    }
  } else {
    users.push(user)
  }
  saveUsers(users)
}

export function createSession(user, keepLogin = false, role = 'user') {
  const previousSession = getSession()
  if (previousSession && previousSession.userId !== user.userId) {
    clearAccountCache(previousSession.userId || previousSession.account)
  }

  clearAllRuntimeData()
  clearSession()
  const safeRole = role === 'admin' ? 'admin' : 'user'
  const session = {
    token: `session-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    userId: user.userId,
    account: user.account,
    role: safeRole,
    keepLogin,
    createdAt: Date.now(),
    expiresAt: keepLogin ? Date.now() + 1000 * 60 * 60 * 24 * 30 : Date.now() + 1000 * 60 * 60 * 12
  }
  uni.setStorageSync(SESSION_KEY, session)
  return session
}

export function getSession() {
  const session = uni.getStorageSync(SESSION_KEY)
  if (!session || !session.token || Number(session.expiresAt || 0) <= Date.now()) {
    clearSession()
    return null
  }
  return session
}

export function clearSession() {
  uni.removeStorageSync(SESSION_KEY)
}

export function clearAccountCache(account) {
  if (!account) return
  uni.removeStorageSync(`cornMenuProducts:${account}`)
  uni.removeStorageSync(`cornMenuOrders:${account}`)
  uni.removeStorageSync(`cornMenuCart:${account}`)
  uni.removeStorageSync(`cornMenuDraft:${account}`)
}

export function clearAllRuntimeData() {
  const info = uni.getStorageInfoSync()
  ;(info.keys || []).forEach(key => {
    if (
      key === 'cornMenuProducts' ||
      key === 'cornMenuOrders' ||
      key === 'cornMenuCart' ||
      key === 'cornMenuDraft' ||
      key.startsWith('cornMenuProducts:') ||
      key.startsWith('cornMenuOrders:') ||
      key.startsWith('cornMenuCart:') ||
      key.startsWith('cornMenuDraft:')
    ) {
      uni.removeStorageSync(key)
    }
  })
}

export function clearCurrentAccountState() {
  const session = getSession()
  if (session) {
    clearAccountCache(session.userId || session.account)
  }
  clearAllRuntimeData()
  clearSession()
}

export function logout() {
  clearCurrentAccountState()
}

export function rememberAccount(account) {
  uni.setStorageSync(REMEMBER_KEY, { account })
}

export function getRememberedAccount() {
  return uni.getStorageSync(REMEMBER_KEY)?.account || ''
}

export function clearRememberedAccount() {
  uni.removeStorageSync(REMEMBER_KEY)
}

export function getCurrentRole() {
  return getSession()?.role || 'guest'
}

export function isAdmin() {
  return getCurrentRole() === 'admin'
}

export function getEntryPage(role = getCurrentRole()) {
  return role === 'admin' ? '/pages/orders/orders' : '/pages/home/home'
}
