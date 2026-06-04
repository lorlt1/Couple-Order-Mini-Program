export const CLOUD_ENV_ID = 'cloud1-d8gr5llwc89362fbb'
export const ORDER_NOTIFY_TEMPLATE_ID = 'q1YVZttT-GOLGr8-gwZgBt5IhWlCgOceD-dJ4yXg6ag'
export const ORDER_DONE_NOTIFY_TEMPLATE_ID = 'RX7VSZzttyoZdsOfLf26PHoxzdAL5CSYtvQb6dnDNSQ'

export function isCloudReady() {
  return typeof wx !== 'undefined' && wx.cloud && CLOUD_ENV_ID
}
