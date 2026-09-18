# cloudmail API Inventory（存量反推，供架构参考）

> 由 @fullstack-dev 从 `E:/otsmail/mail-worker/src` 反推，2026-09-18。
> 用途：帮助 @architect 反推接口约定（路径 / 方法 / 入参），供 @qa-deploy 搭测试用例。
> 仓库无独立 `.sql` schema；drizzle 实体定义在 `mail-worker/src/entity/*.js`，D1 绑定 `env.db`。

## 1. 路由约定

- 入口 `src/index.js`：`/api/*` → 剥除 `/api` 前缀后转 Hono app。
- `/static/*`、`/attachments/*` → R2（`kvObjService.toObjResp`）。
- 其余非 `/api` → `webAssetService.fetch`（前端静态资源托管）。
- 统一响应包装：`result.ok(data)` / `result.fail(...)`。
- 鉴权：`user-context.js`（userContext.getUserId(c)）。

## 2. 路由清单（方法 路径 → 文件）

### email-api.js
- GET  /email/list       （emailService.list，query）
- GET  /email/latest
- DELETE /email/delete
- GET  /email/attList
- POST /email/send       （json）
- PUT  /email/read       （json，T-01 已读同步核心）

### account-api.js
- GET /account/list | DELETE /account/delete | POST /account/add | PUT /account/setName | PUT /account/setAllReceive | PUT /account/setAsTop

### all-email-api.js
- GET /allEmail/list | DELETE /allEmail/delete | DELETE /allEmail/batchDelete | GET /allEmail/latest

### analysis-api.js
- GET /analysis/echarts

### login-api.js
- POST /login | POST /register | DELETE /logout

### my-api.js
- GET /my/loginUserInfo | PUT /my/resetPassword | DELETE /my/delete

### oauth-api.js
- POST /oauth/linuxDo/login | PUT /oauth/bindUser

### public-api.js
- POST /public/genToken | POST /public/emailList | POST /public/addUser

### r2-api.js
- GET /oss/*

### reg-key-api.js
- POST /regKey/add | GET /regKey/list | DELETE /regKey/delete | DELETE /regKey/clearNotUse | GET /regKey/history

### resend-api.js
- POST /webhooks

### role-api.js
- POST /role/add | PUT /role/setDefault | PUT /role/set | GET /role/tree | DELETE /role/delete | GET /role/list | GET /role/selectUse

### setting-api.js
- PUT /setting/set | GET /setting/query | GET /setting/websiteConfig | PUT /setting/setBackground | DELETE /setting/deleteBackground | PUT /setting/setBlacklist

### star-api.js
- POST /star/add | GET /star/list | DELETE /star/cancel

### telegram-api.js
- GET /telegram/getEmail/:token

### translation-api.js
- POST /translation/translate

### user-api.js
- DELETE /user/delete | PUT /user/setPwd | PUT /user/setStatus | PUT /user/setType | GET /user/list | POST /user/add

### init-api.js
- GET /init/:secret

## 3. Drizzle 实体（`src/entity/`）

account, att, email, email-translation, oauth, perm, reg-key, role, role-perm, setting, star, user, verify-record

## 4. 关键 Service 定位

- 已读同步（T-01）：`src/service/email-service.js` → `read`
- 刷新防空白 / 详情预取（T-02）：`src/service/email-service.js` + 前端 `mail-vue/src/views/content/index.vue`
- 翻译（F-06）：`src/api/translation-api.js` + `service/ai-service.js`、`translation-const.js`
- Webhook（F-02）：`src/service/webhook-service.js`
- autoClean（F-03）：`src/service/email-service.js -> autoClean`
- AI 验证码（F-05/T-06）：`src/service/ai-service.js`
- 多账号（F-07）：`src/service/account-service.js` + 前端 `layout/account/index.vue`

## 5. 前端关键文件

- 布局：`mail-vue/src/layout/`（index / header / account / aside / main / write）
- 详情：`mail-vue/src/views/content/index.vue`
- 收件箱列表：`mail-vue/src/views/email/index.vue` + `components/email-scroll/`
- 登录：`mail-vue/src/views/login/index.vue`
- 搜索：`/search?q=`（对应 views 定位需核对，可能复用 email 列表）