<template>
  <scroll-view class="page" scroll-y>
    <view class="hero" @click="openTodayDetail">
      <text class="hero-title">今天</text>
      <text class="hero-date">{{ todayText }}</text>
    </view>

    <view class="calendar-card">
      <view class="week-row">
        <text v-for="day in weekDays" :key="day" class="week-day">{{ day }}</text>
      </view>
      <view class="calendar-grid">
        <view
          v-for="cell in calendarCells"
          :key="cell.key"
          class="calendar-cell"
          :class="{ blank: !cell.day, today: cell.isToday, has: cell.items.length }"
          @click="openDayDetail(cell)"
        >
          <template v-if="cell.day">
            <text class="day-num">{{ cell.day }}</text>
            <view class="day-drink" v-if="cell.items.length">
              <image
                v-if="cell.items[0].imageUrl"
                class="day-image"
                :src="cell.items[0].imageUrl"
                mode="aspectFit"
              />
              <text class="day-fallback" v-else>{{ fallbackText(cell.items[0]) }}</text>
              <text class="day-badge" v-if="cell.totalCount > 1">{{ cell.totalCount }}</text>
            </view>
          </template>
        </view>
      </view>
    </view>

    <view class="month-card" @click="openMonthDetail">
      <view>
        <text class="month-label">本月</text>
        <view class="month-count-row">
          <text class="month-count">{{ monthTotalCount }}</text>
          <text class="month-unit">件</text>
        </view>
        <text class="month-sub">{{ monthBrandCount }} 种类</text>
      </view>
      <view class="month-images" v-if="monthPreviewItems.length">
        <image
          v-for="(item, index) in monthPreviewItems"
          :key="`${item.name}-${index}`"
          class="month-image"
          :src="item.imageUrl"
          mode="aspectFit"
        />
      </view>
      <text class="month-empty" v-else>还没有记录</text>
    </view>

    <view class="rank-card">
      <view class="panel-head">
        <text class="panel-title">常点排行</text>
        <text class="panel-sub">本月</text>
      </view>
      <view class="rank-list" v-if="drinkRank.length">
        <view class="rank-item" v-for="(item, index) in drinkRank" :key="item.name">
          <text class="rank-no">{{ index + 1 }}</text>
          <view class="rank-main">
            <text class="rank-name">{{ item.name }}</text>
            <view class="rank-track">
              <view class="rank-fill" :style="{ width: item.percent + '%' }"></view>
            </view>
          </view>
          <text class="rank-count">{{ item.count }}件</text>
        </view>
      </view>
      <view class="empty-mini" v-else>点一件喜欢的，常点排行会慢慢长出来。</view>
    </view>

    <view class="bottom-space"></view>
    <BottomNav active="stats" />

    <view class="detail-overlay" v-if="showDetail" @click="closeDetail">
      <view class="detail-panel" @click.stop>
        <view class="detail-head">
          <view>
            <text class="detail-title">{{ detailTitle }}</text>
            <text class="detail-sub">{{ detailTotalCount }} 件 · {{ detailBrandCount }} 种类</text>
          </view>
          <text class="detail-close" @click="closeDetail">×</text>
        </view>

        <scroll-view class="detail-scroll" scroll-y>
          <view class="detail-grid" v-if="detailItems.length">
            <view class="detail-card" v-for="(item, index) in detailItems" :key="`${item.name}-${item.createdAt}-${index}`">
              <view class="detail-image-wrap">
                <image
                  v-if="item.imageUrl"
                  class="detail-image"
                  :src="item.imageUrl"
                  mode="aspectFit"
                />
                <text class="detail-fallback" v-else>{{ fallbackText(item) }}</text>
                <text class="detail-count" v-if="item.count > 1">×{{ item.count }}</text>
              </view>
              <text class="detail-name">{{ item.name }}</text>
              <text class="detail-time">{{ formatItemTime(item.createdAt) }}</text>
            </view>
          </view>
          <view class="detail-empty" v-else>这天还没有记录</view>
        </scroll-view>
      </view>
    </view>
  </scroll-view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import BottomNav from '../../components/BottomNav.vue'
import { getSession } from '../../utils/auth'
import { listOrders } from '../../utils/menuApi'

const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const orders = ref([])
const isLoading = ref(false)
const activeAccount = ref('')
const currentDate = ref(new Date())
const showDetail = ref(false)
const detailTitle = ref('今天')
const detailItems = ref([])

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
  currentDate.value = new Date()
  isLoading.value = true
  try {
    orders.value = await listOrders()
  } catch (error) {
    orders.value = []
  } finally {
    isLoading.value = false
  }
})

const todayText = computed(() => {
  const date = currentDate.value
  return `${weekDays[date.getDay()]}，${date.getMonth() + 1}月${date.getDate()}日，${date.getFullYear()}`
})

const monthStart = computed(() => {
  const date = currentDate.value
  return new Date(date.getFullYear(), date.getMonth(), 1)
})

const monthEnd = computed(() => {
  const date = currentDate.value
  return new Date(date.getFullYear(), date.getMonth() + 1, 1)
})

const validMonthOrders = computed(() => {
  const start = monthStart.value.getTime()
  const end = monthEnd.value.getTime()
  return orders.value.filter(order => {
    const createdAt = Number(order.createdAt || 0)
    return order.status !== 'cancelled' && createdAt >= start && createdAt < end
  })
})

const monthItems = computed(() => flattenItems(validMonthOrders.value))
const monthTotalCount = computed(() => monthItems.value.reduce((sum, item) => sum + item.count, 0))
const monthBrandCount = computed(() => {
  const brands = new Set(monthItems.value.map(item => normalizeBrand(item.brand)).filter(Boolean))
  return brands.size
})
const todayItems = computed(() => {
  const date = currentDate.value
  const targetDay = date.getDate()
  return flattenItems(validMonthOrders.value.filter(order => {
    const createdAt = new Date(Number(order.createdAt || 0))
    return createdAt.getDate() === targetDay
  }))
})

const monthPreviewItems = computed(() => {
  const result = []
  monthItems.value.forEach(item => {
    if (!item.imageUrl) return
    for (let i = 0; i < Math.min(item.count, 2); i += 1) {
      result.push(item)
    }
  })
  return result.slice(0, 3)
})

const dayItemsMap = computed(() => {
  const map = {}
  validMonthOrders.value.forEach(order => {
    const date = new Date(Number(order.createdAt || 0))
    const day = date.getDate()
    if (!map[day]) map[day] = []
    map[day].push(...flattenItems([order]))
  })
  return map
})

const calendarCells = computed(() => {
  const date = currentDate.value
  const year = date.getFullYear()
  const month = date.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWeekday = new Date(year, month, 1).getDay()
  const cells = []

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ key: `blank-${i}`, day: 0, items: [], totalCount: 0, isToday: false })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const items = dayItemsMap.value[day] || []
    cells.push({
      key: `day-${day}`,
      day,
      items,
      totalCount: items.reduce((sum, item) => sum + item.count, 0),
      isToday: day === date.getDate()
    })
  }

  return cells
})

const drinkRank = computed(() => {
  const map = monthItems.value.reduce((result, item) => {
    const name = item.name || '未命名'
    result[name] = (result[name] || 0) + item.count
    return result
  }, {})
  const list = Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  const max = list[0]?.count || 1
  return list.map(item => ({
    ...item,
    percent: Math.max(16, Math.round((item.count / max) * 100))
  }))
})

function flattenItems(orderList) {
  return orderList.flatMap(order => {
    return normalizeItems(order.items).map(item => ({
      name: cleanText(item.name, 24) || '未命名',
      brand: cleanText(item.brand, 16),
      imageUrl: cleanText(item.imageUrl, 300),
      count: safeCount(item.count),
      createdAt: Number(order.createdAt || 0)
    }))
  })
}

function normalizeItems(value) {
  if (Array.isArray(value)) return value.filter(item => item && typeof item === 'object')
  if (value && typeof value === 'object') return [value]
  return []
}

function cleanText(value, maxLength) {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim().slice(0, maxLength)
  }
  if (typeof value === 'object') {
    const nested = value.name || value.text || value.value || value.title || ''
    return cleanText(nested, maxLength)
  }
  return ''
}

function safeCount(value) {
  const count = Number(
    typeof value === 'object' && value
      ? value.count || value.value || value.quantity
      : value
  )
  return Number.isFinite(count) && count > 0 ? Math.max(1, Math.round(count)) : 1
}

function normalizeBrand(value) {
  const text = cleanText(value, 16)
  return text && text !== '自定义' ? text : ''
}

function fallbackText(item) {
  return cleanText(item?.brand, 2) || cleanText(item?.name, 2) || '饮'
}

const detailTotalCount = computed(() => detailItems.value.reduce((sum, item) => sum + item.count, 0))
const detailBrandCount = computed(() => {
  const brands = new Set(detailItems.value.map(item => normalizeBrand(item.brand)).filter(Boolean))
  return brands.size
})

function openTodayDetail() {
  detailTitle.value = '今天'
  detailItems.value = todayItems.value
  showDetail.value = true
}

function openMonthDetail() {
  detailTitle.value = '本月'
  detailItems.value = monthItems.value
  showDetail.value = true
}

function openDayDetail(cell) {
  if (!cell || !cell.day || !cell.items.length) return
  detailTitle.value = cell.isToday ? '今天' : `${currentDate.value.getMonth() + 1}月${cell.day}日`
  detailItems.value = cell.items
  showDetail.value = true
}

function closeDetail() {
  showDetail.value = false
  detailItems.value = []
}

function formatItemTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(Number(timestamp))
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${monthNames[date.getMonth()]} ${date.getDate()}@${hour}:${minute}`
}

</script>

<style>
page {
  background: #F7F5EF;
}
</style>

<style scoped>
.page {
  min-height: 100vh;
  padding: 96rpx 28rpx 0;
  box-sizing: border-box;
  background:
    radial-gradient(circle at 18% 0%, rgba(255, 255, 255, 0.92), transparent 30%),
    linear-gradient(180deg, #F9F7F0 0%, #F4F0E8 100%);
}

.hero {
  text-align: center;
  margin-bottom: 52rpx;
}

.hero:active,
.month-card:active,
.calendar-cell.has:active {
  opacity: 0.86;
}

.hero-title {
  display: block;
  font-size: 54rpx;
  font-weight: 900;
  color: #2B1D1D;
  line-height: 1.2;
}

.hero-date {
  display: block;
  margin-top: 16rpx;
  font-size: 28rpx;
  color: #8A8177;
  font-weight: 700;
}

.calendar-card,
.month-card,
.rank-card {
  border-radius: 34rpx;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 18rpx 46rpx rgba(84, 66, 45, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.70);
}

.calendar-card {
  padding: 32rpx 28rpx 34rpx;
  margin-bottom: 34rpx;
}

.week-row {
  margin-bottom: 26rpx;
  display: flex;
  gap: 14rpx;
}

.week-day {
  width: calc((100% - 84rpx) / 7);
  flex-shrink: 0;
  text-align: center;
  font-size: 23rpx;
  font-weight: 900;
  color: #9A928B;
}

.calendar-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 18rpx 14rpx;
}

.calendar-cell {
  position: relative;
  width: calc((100% - 84rpx) / 7);
  flex-shrink: 0;
  height: 86rpx;
  border-radius: 22rpx;
  background: rgba(239, 238, 232, 0.86);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}

.calendar-cell.blank {
  background: transparent;
}

.calendar-cell.today {
  background: #CE934C;
}

.calendar-cell.has {
  background: rgba(239, 238, 232, 0.96);
}

.day-num {
  font-size: 25rpx;
  font-weight: 800;
  color: #3D2E2B;
}

.calendar-cell.today .day-num {
  color: #fff;
}

.day-drink {
  position: absolute;
  inset: 4rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.day-image {
  width: 92rpx;
  height: 92rpx;
  filter: drop-shadow(0 8rpx 12rpx rgba(84, 66, 45, 0.18));
}

.day-fallback {
  width: 54rpx;
  height: 54rpx;
  border-radius: 18rpx;
  background: #FFF4CB;
  color: #A85F00;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 900;
}

.day-badge {
  position: absolute;
  top: -12rpx;
  right: -10rpx;
  min-width: 34rpx;
  height: 34rpx;
  padding: 0 8rpx;
  border-radius: 999rpx;
  background: #C69A59;
  color: #fff;
  font-size: 20rpx;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.month-card {
  min-height: 176rpx;
  padding: 30rpx 34rpx;
  margin-bottom: 34rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
}

.month-label {
  display: block;
  font-size: 27rpx;
  color: #8A8177;
  font-weight: 900;
}

.month-count-row {
  margin-top: 18rpx;
  display: flex;
  align-items: baseline;
  gap: 12rpx;
}

.month-count {
  font-size: 58rpx;
  color: #2B1D1D;
  font-weight: 900;
  line-height: 1;
}

.month-unit,
.month-sub,
.month-empty {
  font-size: 27rpx;
  color: #8A8177;
  font-weight: 800;
}

.month-sub {
  display: block;
  margin-top: 18rpx;
}

.month-images {
  position: relative;
  width: 230rpx;
  height: 132rpx;
}

.month-image {
  position: absolute;
  width: 118rpx;
  height: 132rpx;
  filter: drop-shadow(0 14rpx 18rpx rgba(84, 66, 45, 0.16));
}

.month-image:nth-child(1) {
  right: 92rpx;
  transform: rotate(-8deg);
}

.month-image:nth-child(2) {
  right: 46rpx;
  transform: rotate(5deg);
}

.month-image:nth-child(3) {
  right: 0;
  transform: rotate(9deg);
}

.rank-card {
  padding: 30rpx;
  margin-bottom: 30rpx;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.panel-title {
  font-size: 30rpx;
  font-weight: 900;
  color: #2B1D1D;
}

.panel-sub {
  font-size: 23rpx;
  color: #9A928B;
  font-weight: 900;
}

.rank-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.rank-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.rank-no {
  width: 46rpx;
  height: 46rpx;
  border-radius: 16rpx;
  background: #F2E9DA;
  color: #A85F00;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 900;
}

.rank-main {
  min-width: 0;
  flex: 1;
}

.rank-name {
  display: block;
  font-size: 26rpx;
  font-weight: 900;
  color: #2B1D1D;
  margin-bottom: 10rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-track {
  height: 12rpx;
  border-radius: 12rpx;
  background: rgba(239, 238, 232, 0.94);
  overflow: hidden;
}

.rank-fill {
  height: 100%;
  border-radius: 12rpx;
  background: #CE934C;
}

.rank-count {
  width: 74rpx;
  text-align: right;
  font-size: 23rpx;
  color: #8A8177;
  font-weight: 900;
}

.empty-mini {
  min-height: 116rpx;
  border-radius: 24rpx;
  background: rgba(239, 238, 232, 0.72);
  color: #9A928B;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 24rpx;
  box-sizing: border-box;
  font-size: 24rpx;
  font-weight: 900;
}

.bottom-space {
  height: calc(190rpx + env(safe-area-inset-bottom));
}

.detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 980;
  background: rgba(29, 29, 31, 0.28);
  display: flex;
  align-items: flex-end;
}

.detail-panel {
  width: 100%;
  max-height: 82vh;
  min-height: 62vh;
  border-radius: 42rpx 42rpx 0 0;
  background:
    radial-gradient(circle at 18% 0%, rgba(255, 255, 255, 0.94), transparent 32%),
    linear-gradient(180deg, #FBFAF5 0%, #F4F0E8 100%);
  padding: 44rpx 28rpx calc(34rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  position: relative;
  margin-bottom: 34rpx;
  text-align: center;
}

.detail-title {
  display: block;
  font-size: 38rpx;
  font-weight: 900;
  color: #2B1D1D;
  line-height: 1.3;
}

.detail-sub {
  display: block;
  margin-top: 16rpx;
  font-size: 25rpx;
  color: #9A928B;
  font-weight: 800;
}

.detail-close {
  position: absolute;
  right: 0;
  top: -8rpx;
  width: 66rpx;
  height: 66rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.86);
  color: #8A8177;
  border: 1px solid rgba(60, 60, 67, 0.10);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 54rpx;
  line-height: 1;
}

.detail-scroll {
  max-height: 62vh;
}

.detail-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 22rpx;
  padding-bottom: 18rpx;
}

.detail-card {
  width: calc((100% - 22rpx) / 2);
  flex-shrink: 0;
  min-height: 308rpx;
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 16rpx 38rpx rgba(84, 66, 45, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.72);
  padding: 22rpx 18rpx 20rpx;
  box-sizing: border-box;
  text-align: center;
}

.detail-image-wrap {
  position: relative;
  height: 150rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 18rpx;
}

.detail-image {
  width: 144rpx;
  height: 144rpx;
  filter: drop-shadow(0 12rpx 18rpx rgba(84, 66, 45, 0.12));
}

.detail-fallback {
  width: 112rpx;
  height: 112rpx;
  border-radius: 34rpx;
  background: #FFF4CB;
  color: #A85F00;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  font-weight: 900;
}

.detail-count {
  position: absolute;
  right: 12rpx;
  top: 0;
  min-width: 42rpx;
  height: 42rpx;
  padding: 0 10rpx;
  border-radius: 999rpx;
  background: #C69A59;
  color: #fff;
  font-size: 22rpx;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.detail-name {
  display: block;
  font-size: 28rpx;
  font-weight: 900;
  color: #2B1D1D;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-time {
  display: block;
  margin-top: 14rpx;
  font-size: 24rpx;
  color: #8A8177;
  font-weight: 700;
}

.detail-empty {
  height: 240rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.72);
  color: #9A928B;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: 900;
}
</style>
