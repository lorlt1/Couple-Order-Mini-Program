<script>
import { CLOUD_ENV_ID } from './config/cloud'

export default {
  onLaunch: function () {
    if (typeof wx !== 'undefined' && wx.cloud && CLOUD_ENV_ID) {
      wx.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: true
      })
    }
  },
  onShow: function () {
  },
  onHide: function () {
  },
}
</script>

<style>
/*每个页面公共css */
</style>
