# Sakura Daigou ERP

深色 Apple 风轻量代购 ERP：订单管理、累计利润、独立利润计算器和中通国际站内物流。

## 启用物流代理

把整个仓库部署到 Vercel，在项目环境变量中添加 `MCS_ACCOUNT`、`MCS_PASSWORD`、`ALLOWED_ORIGIN`。服务端会登录 MCargoSuite，先按快递单号查询内部运单 ID，再读取 `/api/mcsParcelWaybill/tracks?id=...`。账号密码不会进入浏览器。

不要提交真实 `.env`。GitHub Pages 只能运行静态前端，无法安全保存中通账号；完整物流功能需用 Vercel 或兼容 Node Serverless Functions 的平台部署。
