# cloudmail 架构文档（Architecture Spec，Web 端）

> **文档状态**：定稿 v1.0（豆豆放权确认）
> **版本变更**：v0.9 → v1.0。v1.0 新增接口 `GET /email/detail`；Webhook 对齐方向定为「上游为准做兼容层」；§7 裁决项已全部定案。
> **关联文档**：`docs/prd.md`、`docs/design.md`
> **基线**：本地仓库 `E:/otsmail` main 分支，HEAD = `cfe4637`
> **反推自现存实现**：本稿的 API 约定与 D1 schema 均**逐字反推自 `mail-worker/src` 现存代码**（2026-09-18 核验），非凭空设计。改动凡涉及接口约定一律升版本号并写变更说明。

---

## 0. 范围与策略

- 本轮是**存量系统复测 + 定向修复**，不是绿地新建。
- P0 阻塞项：`T-01`（已读同步，上游 `ee7eb51`）、`T-02`（刷新详情空白，上游 `4770960`）。
- P1：`T-03` OAuth 错误详情、`T-04` 列表性能索引、`T-05` Webhook 对齐、`T-06` AI 验证码健壮性。
- 全部接口约定**以现有代码为准**回写本文档；@fullstack-dev 修复不得改坏本文档已锁定的字段（除非本架构文档升级版本）。

---

## 1. 技术栈与选型

| 层 | 选型 | 选型理由 |
|----|------|---------|
| 前端框架 | Vue 3 (Composition API) + Vite + Pinia | 现存代码即此栈（`mail-vue`），组件/状态已成型，升级成本最低 |
| UI 库 | Element Plus + iconify | 现存三栏布局、ElMessage 提示、el-image-viewer 均依赖，替换会大改视觉与交互 |
| HTTP | axios（封装 `@/axios`）+ 内存 token 层（`token-store.js`） | 拦截器已统一处理 401/403/502 与错误 Toast；token 集中收口便于将来换 httpOnly Cookie |
| 边缘运行时 | Cloudflare Worker（`mail-worker`，Hono 框架） | 现存架构；Hono 轻量、CORS 白名单化、错误兜底已落实 |
| 数据库 | Cloudflare D1（主数据，drizzle-orm 定义） | 现存主存储 |
| 缓存/会话/配置 | Cloudflare KV | 会话 token 列表、setting 缓存、发件日计数、公开 token |
| 对象存储 | Cloudflare R2（复用旧桶 `mail-r2`） | 热附件与前端 web 静态资源共用，公开域名 `r2.atproxy.eu.org` |
| 邮件发送 | Cloudflare Email Service（优先）→ Resend（兜底），站内互发直写 DB | 已实现的 `sendByCloudflareEmail`/`sendByResend` 双通道 |
| 邮件接收 | Resend webhook（`/webhooks`）+ `email` 入口模块 | 现存 `email/email.js` 收信回调链 |
| AI 验证码 | Cloudflare Workers AI（`@cf/meta/llama-3.1-8b-instruct-fast`） | 现存 `ai-service.js`，`ai_model` 可配 |
| 翻译 | Cloudflare Workers AI / DeepL（`deepl_key` 可配） | 现存 `translation-service.js`，结果落 `email_translation` 表缓存 |
| 安全 | JWT（KV 会话）+ Bearer 头 + 逐接口权限（permKey→path） | 现存 `security.js`；CORS 已白名单化（非 `*`） |
| 部署 | `wrangler deploy` / wrangler-action；前端以 R2 `web/` 前缀托管 | 现存 `web-asset-service.js`；Assets 绑定因 0 字节问题弃用 |

---

## 2. 模块划分

```
mail-worker (Cloudflare Worker, Hono)
├── api/          al路由处理层（Hono handler, 仅做参数→service→result 包装）
├── service/      业务逻辑层（登录/邮件/账号/OAuth/翻译/设置/统计/webhook…）
├── dao/ entity/  D1 数据访问（drizzle sqliteTable 定义 = schema 单一事实来源）
├── security/     JWT 校验、user-context、逐接口权限中间件
├── const/ i18n/  enums(状态机) + 双语文案(Error 提示单一来源)
├── email/        Resend 收信入口(email.js) + HTML/文本模板
├── utils/        crypto、jwt、html-sanitize(DOMPurify 配套)、robust-json…
├── error/        BizError (业务异常→{code,message})
└── model/result  {code,message,data} 统一响应包装

mail-vue (Vue 3 SPA)
├── views/        页面：login/email(收件箱)/content(详情)/send/all-email/star/…
├── layout/       AppShell 三栏：header(顶栏)/aside(列表)/main(详情区)
├── components/   email-scroll(虚拟滚动)/shadow-html(正文消毒)/tiny-editor…
├── store/        Pinia：email/account/setting/ui/writer/send…
├── request/      逐资源 API 封装（= 前端侧接口契约）
└── router/
```

**依赖方向**：`api → service → (orm/entity) → D1`；`front → api(POST/GET…)`。前端**不允许**直接访问 D1/R2/KV。

---

## 3. API 接口约定

> 统一约定：
> - **Base path**：所有 API 挂 `/api` 前缀（`index.js` 中 `/api` 前缀被剥掉后转发 Hono）。即前端请求 `/api/email/list`，Worker 内路径为 `/email/list`。
> - **鉴权**：除 `exclude` 列表外，均需请求头 `Authorization: <jwt>`。`/public` 段需头 `Authorization: <publicToken>`（存 KV）。
> - **统一响应包裹** `result.js`：
>   ```json
>   { "code": 200, "message": "success", "data": <payload> }   // 成功，data 可为 null
>   { "code": <非200>, "message": "<错误文案>" }                // 失败，无 data 字段
>   ```
>   code 语义：`200` 成功 / `401` 未登录或已过期 / `403` 无权限或域名禁用 / `500` 内部错误（非 BizError 时对客户端只回 `Internal error`）/ `502` KV/D1 未绑定。
> - **CORS**：默认仅同源；`allow_origin` 变量配逗号分隔白名单。
> - **分页游标**：列表用 `emailId` 游标 + `timeSort` + `size`（size 最大 50），非 page 分页。

以下逐接口列字段。**字段名与类型精确到逐字**，来自现存代码。

### 3.1 登录 / 会话 / OAuth（exclude 免鉴权）

#### `POST /login`（exclude）
请求：
```json
{ "email": "string", "password": "string", "token": "string?" } // token=Turnstile 验证，registerVerify 开启时必填
```
响应 `data`：
```json
{ "token": "string" }   // JWT
```

#### `POST /register`（exclude）
请求：`{ "email": string, "password": string(min6,max30), "code": string?, "token": string? }`
- `code` = 邀请码（`regKey` 开关 OPEN 时必填；OPTIONAL 时选填）
- `token` = Turnstile（registerVerify OPEN/COUNT 且超阈值时必需）
响应 `data`（注意：**注册不返回 token**）：
```json
{ "regVerifyOpen": false }   // 仅当 registerVerify=COUNT 且未达阈值时才要前端继续引导验证
```

#### `DELETE /logout`
- 鉴权：#tAuthorized#；从 KV 会话移除当前 token。请求无 body。
- 响应 `data: null`。

#### `GET /my/loginUserInfo`
- 鉴权：#tAuthorized#。
- 响应 `data`：
```json
{
  "userId": "number",
  "sendCount": "number",
  "email": "string",
  "account": { "accountId": "number", "email": "string", "name": "string", "status": "number",
               "latestEmailTime": "string?", "createTime": "string?", "userId": "number",
               "allReceive": "number", "sort": "number", "isDel": "number" },
  "name": "string",
  "permKeys": ["string", "..."],        // admin 时为 ["*"]
  "role": { "roleId": "number", ... },   // admin 时为常量 ADMIN_ROLE
  "type": "number"                        // admin 时为 0
}
```

#### `PUT /oauth/bindUser`
请求：`{ "email": string, "oauthUserId": string, "code": string }`
- 把已授权的 oauth 账号与站内邮箱绑定。已绑定邮箱会报错。
响应 `data`：`{ "userInfo": { ...oauthRow }, "token": "<jwt>" }`

#### `POST /oauth/linuxDo/login`
请求：`{ "code": string }`（linux.do OAuth 授权码）
- 用 code 换 token→取用户→落 oauth 表。若该 oauth 已绑定站内用户则返回 token；否则 `token: null`（前端应引导 `bindUser`）。
响应 `data`：`{ "userInfo": { ...oauthRow }, "token": "<jwt>" | null }`

### 3.2 邮件（核心 P0）

#### `GET /email/list`
- 鉴权：#tAuthorized#；需权限：`account:query`（仅对 account 相关，本接口是否需要见 permKey，见实现）。
- Query 参数（全部可选，均需 Number 化）：
  | 参数 | 类型 | 说明 |
  |------|------|------|
  | `accountId` | number | 账号 id；`allReceive` 缺省时用于取账号的 allReceive |
  | `allReceive` | number(0/1) |=1 查该用户全部账号（`eq(1,1)` 忽略 accountId 过滤） |
  | `emailId` | number | 游标；默认 `9999999999`(倒序) / `0`(timeSort) |
  | `timeSort` | number(0/1) |=1 升序（新→旧方向取旧），=0 倒序取新 |
  | `size` | number(≤50) | 页大小，>50 会被截断为 50 |
  | `type` | number | 0=收件 1=发件（`emailConst.type`） |
- 响应 `data`：
```json
{
  "list": [ { /* email 行全部字段 + */ "isStar": 0|1, "attList": [/*Att[](3.7)*/] } ],
  "total": "number",
  "latestEmail": { "emailId": "number", "accountId": "number", "userId": "number" }
}
```
- `email` 行字段（列即 D1 列，见 §4.1）：`emailId, sendEmail, name, accountId, userId, subject, code, text, content, cc, bcc, recipient, toEmail, toName, inReplyTo, relation, messageId, type, status, resendEmailId, message, unread, createTime, isDel`。`cc/bcc/recipient` 为 **JSON 字符串**（如 `[]`、`[{"address":"x","name":""}]`）。

#### `GET /email/latest`
- Query：`emailId, accountId, allReceive`。约 20 条；`type=RECEIVE(0)` 且 `emailId` 之后的新邮件。
- 响应 `data`：`[ /* email 行 + attList */ ]`（前端 35s 超时长轮询用）。

#### `GET /email/detail`（v1.0 新增）
- 鉴权：#tAuthorized#（普通登录用户可读自己的邮件）
- Query：`emailId`（number，必填）
- 逻辑：查询 `user_id=当前用户 AND email_id=? AND is_del=0`，复用 `emailAddAtt` 组装 `attList`。
- 响应 `data`：
```json
{
  "emailId": "number", "sendEmail": "string", "name": "string", "accountId": "number",
  "userId": "number", "subject": "string", "code": "string", "text": "string?",
  "content": "string?", "cc": "string", "bcc": "string", "recipient": "string",
  "toEmail": "string", "toName": "string", "inReplyTo": "string", "relation": "string",
  "messageId": "string", "type": "number", "status": "number", "resendEmailId": "string?",
  "message": "string?", "unread": "number", "createTime": "string", "isDel": 0,
  "isStar": "number(0|1)",
  "attList": [ /* Att[](3.7) */ ]
}
```
> 记录不存在而非当前用户 → 返回 BizError (message `authExpired`/`notExist`)。实现时若记录不属于该 user 返回 401/404 语义，由 service 决定。

#### `PUT /email/read`
- 鉴权：#tAuthorized#
- 请求：`{ "emailIds": ["number", ...] }`
- 逻辑：把 `user_id=当前userId AND email_id IN list` 的行 `unread=1(READ)`。**（T-01 核心端点）**
- 响应 `data: null`。

#### `DELETE /email/delete`
- Query：`emailIds`（**逗号分隔字符串**，如 `"1,2,3"`）。
- 逻辑：`setting.syncDelete=OPEN` 时物理删；否则软删 `is_del=1`。
- 响应 `data: null`。

#### `POST /email/send`
- 鉴权：#tAuthorized#；需权限：`email:send`。
- 请求 body（multipart，含附件上传进度）：
```json
{
  "accountId": "number",          // 发件账号
  "name": "string?",              // 发件人名，缺省取账号名前缀
  "sendType": "normal|reply",     // reply 时 emailId 必填
  "emailId": "number?",           // reply 原邮件 id
  "receiveEmail": ["string", "..."],  // 收件人地址数组
  "text": "string?",
  "content": "string?",           // HTML（发件时内嵌图 base64 或 cid，服务端转 R2 并替换 url）
  "subject": "string",
  "attachments": [ { "filename": "string", "content": "base64|ArrayBuffer", "mimeType"?: "string", "size"?: number, "contentId"?: "string" } ]
}
```
- 响应 `data`：`[ { /* email 行 */ attList: [Att] } ]`（数组包一封已落库邮件）。
- 限制：附件 >10 个报错；内嵌图 >10 报错；`send` 开关关闭、ban、站外无 provider、次数/域名/接收方校验失败 → 对应 BizError(403)。

#### `GET /email/attList`
- Query：`emailId`（或若干）。响应 `data`：`[ Att* ]`（见 §3.7）。

### 3.3 账号

#### `GET /account/list`
- Query：无（当前用户）。
- 响应 `data`：`[ { accountId, email, name, status, latestEmailTime, createTime, userId, allReceive, sort, isDel } ]`

#### `POST /account/add`
- 请求：`{ "email": string, "token": string? }`（token=Turnstile，addEmailVerify 开启时）
- 需权限：`account:add`。响应 `data`：新 account 行。

#### `PUT /account/setName`
请求：`{ "accountId": number, "name": string }`；响应 null。

#### `PUT /account/setAllReceive`
请求：`{ "accountId": number, "allReceive": 0|1 }`；响应 null。

#### `PUT /account/setAsTop`
请求：`{ "accountId": number, "sort": number }`；响应 null。

#### `DELETE /account/delete`
Query：`accountId`；需权限：`account:delete`；响应 null。

### 3.4 星标 / 统计

#### `POST /star/add`
请求：`{ "emailId": number }`；响应 null。

#### `GET /star/list`
Query：`accountId, ...`（同 email/list 游标）；响应 `data: { list:[email+attList], total, latestEmail }`。

#### `DELETE /star/cancel`
Query：`emailId`；响应 null。

#### `GET /analysis/echarts`
需权限：`analysis:query`；Query 透传；响应 `data`（分析图表数据）。

### 3.5 翻译（P1-功能保留）

#### `POST /translation/translate`
- 鉴权：#tAuthorized#
- 请求：`{ "emailId": number, "targetLang": "string" }`（如 `zh`）
- 响应 `data`：
```json
{
  "translatedSubject": "string",
  "translatedContent": "string",
  "sourceLang": "string?",
  "alreadyInTargetLang": false,    // true 时前端提示"已在该语言"，不替换正文
  "model": "string?"
}
```
- 结果会写 `email_translation` 表（§4.8）供缓存。

### 3.6 全站邮件（管理） / 用户 / 角色

均为需权限接口，query 透传，`data` 为对应列表/空：
- `GET /allEmail/list`、`GET /allEmail/latest`（需 `all-email:query`）
- `DELETE /allEmail/delete`（`emailIds` 逗号串）、`DELETE /allEmail/batchDelete`（需 `all-email:delete`）
- `GET /user/list`、`POST /user/add`、`PUT /user/setPwd`、`PUT /user/setStatus`、`PUT /user/setType`、`PUT /user/restore`、`PUT /user/resetSendCount`、`DELETE /user/delete`、`GET /user/allAccount`、`DELETE /user/deleteAccount`
- `POST /role/add`、`GET /role/list`、`GET /role/tree`、`GET /role/selectUse`、`PUT /role/set`、`PUT /role/setDefault`、`DELETE /role/delete`

### 3.7 附件 / 静态资源

- `GET /oss/{key}`（exclude）：读 R2 对象，按 `Content-Type`/`Content-Disposition` 流式返回（`cfe4637` 已改流式 body 根治白屏）。
- `GET /static/{key}`、`GET /attachments/{key}`（`index.js` 直接路由）：走 `kv-obj-service` 读 KV/R2 对象。
- Att 对象字段：`attId, userId, emailId, accountId, key, filename, mimeType, size, status, type(0=att,1=embed), disposition, related, contentId, encoding, createTime`。

### 3.8 其它

- `GET /init/{secret}`（exclude）：D1 建表/初始化；响应由 `dbInit.init` 返回。
- `POST /webhooks`（exclude）：Resend 收信回调；成功回 `success`(200)，失败回 `e.message`(500)。**（T-05 Webhook 对齐点）**
- `GET /telegram/getEmail/{token}`（exclude）：Telegram 展开邮件内容（HTML，immutable 缓存）。
- `POST /public/genToken`、`POST /public/emailList`、`POST /public/addUser`：公开接口，需 `Authorization: <publicToken>`（KV 中的 `PUBLIC_KEY`）。
- `GET /setting/websiteConfig`（exclude）：登录页公开配置（见 §3.8 下）。

#### `GET /setting/query`（需 `setting:query`）
响应 `data`：全量 setting 字段，**敏感字段已脱敏**（`*` 号）：
`register, receive, title, manyEmail, addEmail, autoRefresh, addEmailVerify, registerVerify, regVerifyCount, addVerifyCount, send, r2Domain, secretKey(脱敏), siteKey(脱敏), regKey, background, tgBotToken(脱敏), tgChatId, tgBotStatus, forwardEmail, forwardStatus, ruleEmail, ruleType, loginOpacity, resendTokens(脱敏值), notice*, aiCode, aiCodeFilter, syncDelete, deeplKey(脱敏), webhookUrl, webhookStatus, webhookRetry, webhookSecret, autoCleanDays, autoCleanExclude, domainList, projectLink, linuxdo*, regVerifyOpen, addVerifyOpen, storageType, hasR2, hasCfEmail, s3*(脱敏)…`

---

## 4. 数据库 Schema（D1，drizzle 定义，核验自 entity/*.js）

> 列名以 drizzle `sqliteTable` 第二个参数的字符串为准（下划线式）。**integer 列在 SQLite 为 64 位 int，text 为 TEXT。**

### 4.1 `email`（`entity/email.js`）
| 列 | 类型 | 约束/默认 | 说明 |
|----|------|----------|------|
| email_id | integer | PK autoincrement | |
| send_email | text | | 发件人地址 |
| name | text | | 发件人名 |
| account_id | integer | NOT NULL | |
| user_id | integer | NOT NULL | |
| subject | text | | |
| code | text | NOT NULL DEFAULT '' | |
| text | text | | 纯文本正文 |
| content | text | | HTML 正文（`imgReplace` 后 R2 url） |
| cc | text | NOT NULL DEFAULT '[]' | JSON 字符串 |
| bcc | text | NOT NULL DEFAULT '[]' | JSON 字符串 |
| recipient | text | | JSON 字符串 `[{address,name}]` |
| to_email | text | NOT NULL DEFAULT '' | |
| to_name | text | NOT NULL DEFAULT '' | |
| in_reply_to | text | NOT NULL DEFAULT '' | |
| relation | text | NOT NULL DEFAULT '' | |
| message_id | text | NOT NULL DEFAULT '' | |
| type | integer | NOT NULL DEFAULT 0 | 0=收/1=发(`emailConst.type`) |
| status | integer | NOT NULL DEFAULT 0 | 0收/1发/2已送达/3退信/4投诉/5延迟/6保存/7无人/8失败 |
| resend_email_id | text | | Resend 消息 id |
| message | text | | 退信原因（BOUNCED 时 JSON 字符串） |
| unread | integer | NOT NULL DEFAULT 0 | 0=未读/1=已读（`emailConst.unread`） |
| create_time | text | NOT NULL DEFAULT CURRENT_TIMESTAMP | |
| is_del | integer | NOT NULL DEFAULT 0 | 0正常/1软删 |

### 4.2 `account`（`entity/account.js`）
| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| account_id | integer | PK auto | |
| email | text | NOT NULL | |
| name | text | NOT NULL DEFAULT '' | |
| status | integer | NOT NULL DEFAULT 0 | |
| latest_email_time | text | | |
| create_time | text | DEFAULT CURRENT_TIMESTAMP | |
| user_id | integer | NOT NULL | |
| all_receive | integer | NOT NULL DEFAULT 0 | 0/1 全部接收 |
| sort | integer | NOT NULL DEFAULT 0 | 置顶排序 |
| is_del | integer | NOT NULL DEFAULT 0 | |

### 4.3 `attachments`（`entity/att.js`）
| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| att_id | integer | PK auto | |
| user_id | integer | NOT NULL | |
| email_id | integer | NOT NULL | |
| account_id | integer | NOT NULL | |
| key | text | NOT NULL | R2 对象 key |
| filename | text | | |
| mime_type | text | | |
| size | integer | | |
| status | text | NOT NULL DEFAULT 0 | 0 正常/1 未用 |
| type | integer | NOT NULL DEFAULT 0 | 0=附件/1=内嵌 |
| disposition | text | | |
| related | text | | |
| content_id | text | | |
| encoding | text | | |
| create_time | text | NOT NULL DEFAULT CURRENT_TIMESTAMP | |

### 4.4 `user`（`entity/user.js`）
| 列 | 类型 | 约束 |
|----|------|------|
| user_id | integer | PK auto |
| email | text | NOT NULL |
| type | integer | NOT NULL DEFAULT 1（角色 role_id） |
| password | text | NOT NULL（PBKDF2 hash；轮数 8000 免费档，写在 hash 里） |
| salt | text | NOT NULL |
| status | integer | NOT NULL DEFAULT 0（0 正常/1 禁） |
| create_time | text | DEFAULT CURRENT_TIMESTAMP |
| active_time | text | |
| create_ip / active_ip | text | |
| os / browser / device | text | |
| sort | text | DEFAULT 0 |
| send_count | text | DEFAULT 0 |
| reg_key_id | integer | NOT NULL DEFAULT 0 |
| is_del | integer | NOT NULL DEFAULT 0 |

### 4.5 `setting`（`entity/setting.js`）——单行配置（无 PK，取第一条）
包含：`register, receive, title, many_email, add_email, auto_refresh, add_email_verify, register_verify, reg_verify_count, add_verify_count, send, r2_domain, secret_key, site_key, reg_key, background, tg_bot_token, tg_chat_id, tg_bot_status, forward_email, forward_status, rule_email, rule_type, login_opacity, resend_tokens(JSON 字符串 默认"{}"), notice_title/content/type/duration/position/offset/width, notice, no_recipient, login_domain, bucket, region, endpoint, s3_access_key, s3_secret_key, force_path_style, custom_domain, tg_msg_from/to/text, min_email_prefix, email_prefix_filter, black_subject/content/from, ai_code, ai_code_filter, sync_delete, deepl_key, webhook_url/status/retry/secret, auto_clean_days, auto_clean_exclude`。
> Webhook 对齐（T-05）与 autoClean 的配置就在这一行。

### 4.6 `star`（`entity/star.js`）
`star_id`(PK auto), `user_id` NOTNULL, `email_id` NOTNULL, `create_time` DEFAULT CURRENT_TIMESTAMP。

### 4.7 `oauth`（`entity/oauth.js`）
`oauth_id`(PK auto), `oauth_user_id` text, `username`, `name`, `avatar`, `active`, `trust_level`, `silenced`, `create_time`, `user_id` NOTNULL DEFAULT 0（0=未绑定）。

### 4.8 `email_translation`（`entity/email-translation.js`）
复合主键 `(email_id, target_lang)`；列 `email_id, target_lang, user_id, translated_subject, translated_content, source_lang, model, create_time`。
索引：`idx_translation_user(user_id)`、`idx_translation_email(email_id)`。

### 4.9 权限/角色/注册码/验证记录
- `perm`(`entity/perm.js`)：`perm_id`(PK), `name` NOTNULL, `perm_key`, `pid` NOTNULL DEFAULT 0, `type` NOTNULL DEFAULT 2, `sort`。
- `role`(`entity/role.js`)：`role_id`(PK), `name` NOTNULL, `key` NOTNULL, `description`, `ban_email` NOTNULL DEFAULT '', `ban_email_type` NOTNULL DEFAULT 0, `avail_domain` DEFAULT '', `sort`, `is_default` DEFAULT 0, `create_time` NOTNULL, `user_id`, `send_count`, `send_type` DEFAULT 'count', `account_count`。
- `role_perm`(`entity/role-perm.js`)：`id`(PK auto), `role_id`, `perm_id`。
- `reg_key`(`entity/reg-key.js`)：`rege_key_id`(PK), `code` NOTNULL DEFAULT '', `count` NOTNULL DEFAULT 0, `role_id` NOTNULL DEFAULT 0, `user_id` NOTNULL DEFAULT 0, `expire_time`, `create_time` NOTNULL。
- `verify_record`(`entity/verify-record.js`)：`vr_id`(PK), `ip` NOTNULL DEFAULT '', `count` NOTNULL DEFAULT 1, `type` NOTNULL DEFAULT 0, `update_time` NOTNULL。

### 4.10 索引建议（T-04 对齐，需在修复时验证是否已含）
- `email`:`(user_id, is_del, type, account_id)` 与 `(user_id, is_del, account_id, email_id DESC)` —— 列表默认查询路径。
- `email_translation` 已建双索引（§4.8）。
- 大列表虚拟滚动依赖 `email_id` 游标有序，建议确认 `email.email_id` 上有索引（autoincrement PK 隐含）。

---

## 5. 数据流（关键时序）

### 5.1 已读同步（T-01 复测点）
```
收件箱点击邮件 → /mail/:id
  content/index.vue onMounted:
    if showUnread && email.unread===UNREAD(0):
      本地先置 email.unread=READ(1)          // 立即反馈
      emailStore.markListRead(emailId)       // 同步列表 store 内该项
      PUT /email/read { emailIds:[id] }      // 持久化（幂等）
后端: UPDATE email SET unread=1 WHERE user_id=? AND email_id IN (...)
```
- 失败面：`markListRead` 依赖 `emailScroll.emailList` 与 detail 的 `email` 引用同一对象/列表项（`emailStore.contentData.email`）。若详情页与列表为**不同引用**（深浅拷贝断链），列表不会更新 → 表现即"已读不同步"。**@fullstack-dev 复测重点：确认 `contentData.email` 与列表项为同一引用，或有显式的读后回写。**

### 5.2 刷新详情防空白（T-02 复测点）
- 现存是**client-side 三栏 store（`emailStore.contentData` persist 到 localStorage）**；刷新后 `contentData.email` 从 persist 恢复，且 `email` 字段若带 `content` 则直接渲染，否则走回列表重取。
- 风险：刷新后 persist 里 `email.content` 缺失/过期 → 空白。建议：详情页挂载时若 `content` 缺失或 `contentData` 为空，**显式按 `emailId` 从列表兜底重取**或新增 `GET /email/detail`。
- **v1.0 定案：新增 `GET /email/detail?emailId=`**，返回单封 `email + attList`。现有代码没有该端点，列表 `SELECT *` 已含 content；实现时复用 `emailAddAtt` 组装 `attList`，查询条件 `user_id=? AND email_id=? AND is_del=0`。**此接口为新增，不在存量契约内，必须由 @fullstack-dev 实现后端 handler + 前端 `request/` 封装后方可用。**

### 5.3 收信链路（email/email.js → 入库 → 附件 → 推送）
```
Resend webhook POST /webhooks
  → resendService.webhooks 解析
  → 判断站内/站外、blacklist、role ban/availDomain、rule type
  → email.receive() imgReplace(cid→R2) → INSERT email (unread=0)
  → attService saveArticleAtt → R2 上传
  → webhook 通知（Bearer 签名 + 重试，若开启）
  → Telegram 通知（若开启）
```

### 5.4 发信链路
```
前端 → POST /email/send
  → 权限/次数/域名校验（§3.2）
  → 内嵌图 base64→attService→R2
  → sendByCloudflareEmail 优先 / sendByResend 兜底（站外）
  → INSERT email (type=1) + att
  → allInternal 时 HandleOnSiteEmail 为收件人写 type=0 行
  → KV 发件日计数 +1
```

---

## 6. 任务拆解（交 @fullstack-dev）

依赖顺序（P0 先行）：

1. **T-00 环境快照**（无依赖）：确认 `/api` 前缀编译后 Worker 路由、D1/KV 绑定、wrangler.toml 配置项（`pwd_iterations=8000`、`domain`、`admin`）。
2. **T-01 已读同步复测+修复**（依赖 T-00）：
   - 首复现：详情标已读，返回列表是否同步。核 `markListRead` 引用一致性。
   - 若断链：修 store，落地读后回写；不破坏 `PUT /email/read` 契约。
3. **T-02 详情刷新防空白**（依赖 T-00）：
   - 复现刷新详情空白；补挂载兜底重取。若采纳 §7 新增 `GET /email/detail`，则由本任务一并实现并同步升版本。
4. **T-04 列表性能索引**（依赖 T-00，可与 T-01/02 并行）：
   - 对比上游索引 DDL；补 `email` 组合索引；慢查询日志验证。
5. **T-03 OAuth 错误详情**（依赖 T-00）：把 oauth/limitdo 错误 `statusText` 映射为明确错误码+文案，前端展示。
6. **T-05 Webhook 对齐**（依赖 T-00）：输出本地 vs 上游事件类型/payload/重试差异清单，按清单对齐。
7. **T-06 AI 验证码健壮性**（依赖 T-00）：按上游边界用例复测 `ai-service`，异常输入兜底。
8. **P0-05 性能基线**（依赖 2/3/4）：本地 + Cloudflare 边缘压测列表 ≤2s、详情 ≤1.5s。

---

## 7. 开放项裁决（v1.0 全部定案）

**7-1 新增 `GET /email/detail`** → **采纳**（product-ui 支持、qa-deploy 支持、豆豆放权）。见 §5.2 与 §3.2 新增接口定义。

**7-2 接口版本策略** → **采纳**：凡碰契约的 P0 改动升版本号 + 群内通告。architecture.md 为单一事实来源，design.md 由 product-ui 同步版本。

**7-3 Webhook 对齐方向（T-05）** → **定案：「上游为准做兼容层」**。本地保留内部事件模型，出站序列化时映射成上游 payload 格式；上游标准事件（event type/payload/重试策略）不破坏外部订阅方；本地自定义事件在兼容层额外暴露并文档化。纯技术取舍，豆豆放权确认。

---

## 8. 实现备注（开发 Bot 回写区）

<!-- 本区由 fullstack-dev 回写技术细节；架构 Bot 保持单一事实来源。 -->
**v1.0 通告 @fullstack-dev（2026-09-18）**：
- 新增后端 handler `GET /email/detail`（§3.2）+ 前端 `request/email.js` 封装 `emailDetail(emailId)`。
- T-01 已读同步复测点：核 `emailStore.contentData.email` 与列表项 `emailScroll.emailList[]` 是否同一引用；断链则补读后回写。
- T-02 刷新防空白：详情页挂载若 `content` 缺失/`contentData` 空，用 `GET /email/detail` 兜底重取。
- T-05 Webhook：**上游为准做兼容层**（§7-3），本地内部模型转上游 payload 序列化输出。
- 以上接口字段已锁定，接入前先看图再动 `request/` 与 worker handler，不抢先猜字段名。

**实现备注 @fullstack-dev（2026-09-18）T-00/T-01/T-02 落地**：
- `GET /email/detail` 已实现（后端 `email-service.detail` + `email-api.js` 路由 + 前端 `request/email.js emailDetail`）。查询条件 = 当前 `userId AND email_id=? AND is_del=NORMAL`，leftJoin star 得 `isStar`，复用 `emailAddAtt` 组装 `attList`。摘要 §3.2 字段逐字对齐。记录不存在或非当前用户 → `BizError(authExpired)`（复用现有文案）。
- T-01 复测确认：`markListRead` 走显式 `emailScroll.emailList.find` 回写（非依赖引用一致性），已规避深浅拷贝断链风险。且 `contentData.email` 在 `email/index.vue jumpContent` 中直接赋值为列表项同一引用（line 67），引用一致；read 后 `markListRead` 显式回写列表项。**T-01 后端契约未动**，仅前端 store 回写链已确认存在。
- T-02 已实现：`content/index.vue onMounted` 若 `contentData.email.content` 缺失，用 `GET /email/detail` 兜底重取并对 `email` 就地 `Object.assign`（保持引用/响应式），失败不阻塞 read 同步。初版接入完成。
- **T-04 已实现（2026-09-19）**：本地 `init.js` 缺 list 查询路径复合索引；新增 `otsmail_4DB` 迁移，`CREATE INDEX IF NOT EXISTS` 补齐 T-04 对齐上游 a8c9ae3 的 7 个索引：`idx_email_list_user(user_id,type,is_del,email_id)`、`idx_email_list_account(user_id,account_id,type,is_del,email_id)`（§4.10 列表路径）、`idx_star_user_email(star(user_id,email_id))`、`idx_email_name/subject/to_email/send_email *_nocase`。DB 迁移非接口契约，未升版本。需在 D1 跑 `GET /init/{secret}` 执行。
- **T-03 已实现（2026-09-19）**：`oauth-service.js` 的 `linuxDoLogin` 上游失败原用 `statusText`（常为空/无意义），改为 i18n 明确文案——token 换取 400 报 `oauthBadCode`（授权码无效/过期）、其它失败报 `oauthTokenFailed`（请重试/联系管理员）；用户信息获取失败报 `oauthUserFailed`。中英 i18n 各 +4 key。前端 `oauthLinuxDoLogin` 走 axios 拦截器已自动 Toast `data.message`，无需前端改动。
- **T-06 已核实（2026-09-19）**：本地 `ai-service.js` 与 `upstream/main` **逐字一致**（含 T-06 的 `content is string ? JSON.parse(content) : content` 健壮性修复）；`shouldExtractCode` 有 `email.from?.address || ''` 空安全；`extractCode` 全文 try/catch 兜底 `''`，异常图片/非验证码不崩溃。代码侧已对齐上游，P1-04 边界复测属 @qa-deploy 验收。
- **T-05 已实现（2026-09-19）**：Webhook 按 §7-3「上游为准做兼容层」对齐 `upstream/main` 的 `webhook-service.js`——① `sendName: email.name`（修掉本地原 `email.sendName` 在 D1 行上恒 undefined 的 bug）；② `Authorization` 由 `Bearer ${secret}` 改为上游原始 secret；③ 新增 `toOssDomain(webhookUrl)` 域名归一。保留本地带退避的重试逻辑（优于上游线性重试）。出站 payload = 上游格式；内部模型不破坏。Webhook 为出站契约非 worker 请求 API，未升版本。
- **T-02 边界收缩（2026-09-19，响应 @architect 裁决 + @qa-deploy 报告 ②）**：`content/index.vue onMounted` 顶部新增判空——持久化 `contentData.email` 为 null/无 emailId 时 `router.replace('/inbox')` 回落收件箱并 return，杜绝空指针白屏。该场景 /mail 无 route 参数、无可恢复 emailId，列表是唯一源头。
- **① 登录入口部署可见性（2026-09-19 核实）**：linux.do OAuth 代码端**全链路完整**（worker 读 `linuxdo_client_id/secret/callback_url` env → settings-service 暴露 `linuxdoSwitch/ClientId/CallbackUrl` → 前端按钮按 `linuxdoSwitch` 显隐并拼 authorize URL）。「入口不可见」非代码缺陷，而是 **wrangler.toml/secret 缺 `linuxdo_*` 配置**——配好 `wrangler secret put linuxdo_client_secret` + `[vars]` 设 `linuxdo_client_id`/`linuxdo_callback_url`/`linuxdo_switch=true` 即显示。属部署配置，交 @qa-deploy/@user。