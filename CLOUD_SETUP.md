# 微信云开发上线配置

这个项目已经接入微信云开发的代码结构：

- 云函数：`cloudfunctions/menuApi`
- 商品集合：`products`
- 订单集合：`orders`
- 前端云环境配置：`src/config/cloud.js`

## 1. 开通云开发

在微信开发者工具里打开项目后：

1. 点击「云开发」
2. 开通一个云环境
3. 复制云环境 ID
4. 填到 `src/config/cloud.js`

```js
export const CLOUD_ENV_ID = '你的云环境ID'
```

## 2. 上传云函数

在微信开发者工具中找到 `cloudfunctions/menuApi`：

1. 右键 `menuApi`
2. 选择「上传并部署：云端安装依赖」

## 3. 创建数据库集合

在云开发控制台创建两个集合：

- `products`
- `orders`

建议先把两个集合权限设为「仅创建者可读写」或「所有用户可读，仅创建者可写」做测试。

如果你希望你能看见女朋友下的订单，正式使用时建议通过云函数读写订单，不让前端直接操作数据库。当前代码已经走云函数。

## 4. 本地兜底

如果 `CLOUD_ENV_ID` 为空，或者云函数还没部署，页面会自动使用本地存储兜底：

- 商品：`cornMenuProducts`
- 订单：`cornMenuOrders`

这方便你先预览页面，但不同手机之间不会同步。上线前必须配置云环境。

## 5. 发布前检查

1. `src/manifest.json` 填入微信小程序 AppID
2. `src/config/cloud.js` 填入云环境 ID
3. 上传部署 `menuApi`
4. 创建 `products` 和 `orders` 集合
5. 在微信开发者工具中重新编译并预览
