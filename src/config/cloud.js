export const CLOUD_ENV_ID = 'cloud1-d8gr5llwc89362fbb'

export function isCloudReady() {
  return typeof wx !== 'undefined' && wx.cloud && CLOUD_ENV_ID
}
