# cloudmail 部署日志

## 版本基线
- 仓库：`E:/otsmail`，分支 `main`
- 域名：`mail.otscup.com`（custom domain → Worker `otsmail`）
- Worker 入口：`https://otsmail.vincentdam93.workers.dev`

---

## 生产配置变更：开启注册邀请码门禁（2026-09-23）
- **操作**：D1 `setting.reg_key` 1(CLOSE) → **0(OPEN)**（`UPDATE setting SET reg_key=0 WHERE reg_key=1`）
- **原因**：豆豆要求「注册必须填邀请码」。根因诊断：非代码漏洞，是配置未开——OAuth 与普通注册共用同一门禁（`login-service.register` 在 reg_key===OPEN 时均校验 code），无绕过。
- **前提**：`reg_key` 表原本空，直接开启会锁死所有注册。已先插入救命邀请码：
  - `OTSCUP-INVITE-2026`（count=50，role_id=1 普通用户，expire 2026-12-31，user_id=0）
- **验证**：`reg_key=0` ✅；reg_key 表 cnt=1 ✅
- **⚠️ 单一事实来源纪律固化**：期望生产值为 `reg_key=0(OPEN)`。换环境/重新初始化后需手工恢复此值 + 维护有效邀请码，勿凭部署翻转回 1。
- **⚠️ 存量知情**：此前已通过 OAuth 无邀请码注册的账号**不会被追溯移除**（门禁开启前行），豆豆已知情。

---
## 部署 #8（当前线上）— MCP 邮件能力 + 安全加固（a61f369 + 3e15189）
- **代码**：`a61f369 feat(mcp)` + `3e15189 fix(mcp): isDel for trash`。功能：`/mcp` Streamable HTTP 端点暴露 5 个工具（list/read/send/delete/mark_read），供 AI 客户端经 MCP 协议操作邮件。
- **前置环境修复**（原 dev 环境坑）：MCP SDK 依赖原未入 lock（`pnpm install` 报 `null matches`/交互确认）。QA 用 pnpm 9.15.9 单包安装，lock 补入 `@modelcontextprotocol/sdk@1.32.1` + `zod@3.25.76`，`deploy --dry-run` build 成功（3915 KiB）。
- **安全复核（部署前逐条核实，全过）**：
  - **RBAC 校验在工具执行前**：`send_email` 查 `email:send`、`delete_email` 查 `email:delete`，admin 放行，无权限 403（`requirePerm`，mcp-server.js L57）
  - **`mcp_switch` 默认 OFF**：wrangler.toml `mcp_switch = false`，POST /mcp 未开启时 403（mcp-api.js L16-24）
  - **delete 速率限制**：KV 按「用户+日期」计数，每日 200 封上限（MCP_DELETE_DAILY_LIMIT=200）
  - **审计标记 via MCP**：写操作追加 KV `mcp_log:<userId>`，含 via/mcp + accountId，保留 100 条
  - **单账号作用域**：只暴露 JWT holder 主账号，`allReceive:0` 不跨账号不切换
  - **KV 常量存在**：`KvConst.MCP_ACTION='mcp_action:'` / `MCP_LOG='mcp_log:'`（非 undefined，不会静默失效）
  - **JWT 强制**：`/mcp` 不在 security.js exclude 列表，走标准 JWT 中间件
  - **i18n**：`mcpRateLimit` 已入 zh/en
- **已知限制（不阻塞）**：`folder=trash` 当前返回空（`emailService.list` 底层 `WHERE isDel=NORMAL` 只查未删邮件，需改共享 email-service 加 trash 分支，影响面大，单独开 issue）。
- **默认状态**：`mcp_switch=false`，部署后**不生效**；验证需先在 Cloudflare 设为 `true`。
- **⚠️ 部署期发现 2 个阻塞缺陷（QA 实测拦下，已修）**：
  1. **`nodejs_compat` 缺失**（`9b41f52`）：MCP SDK 依赖 `node:http`，未配 flag 时 Cloudflare API 直接拒绝版本（`No such module "node:http"`, code 10021），部署静默失败、生产仍停旧版。已加 `compatibility_flags = ["nodejs_compat"]`。
  2. **`/mcp` 未接线**（`8ada18b`）：dev 注册了 `app.post/get('/mcp')` 但 index.js 入口无 `/mcp` 分发分支，请求全被 `webAssetService` 的 SPA fallback 抢成 HTML，**端点完全不可达**。已在 index.js `/api/` 分支后补 `if (url.pathname === '/mcp' || url.pathname.startsWith('/mcp/')) return app.fetch(...)`。
  - 两处修复前：GET/POST /mcp 均返回前端 HTML。修复后：GET 返回 `{"code":401,"message":"身份认证失效,请重新登录"}`（JWT 强制生效，不再被 fallback 抢）；POST 同被 JWT 拦。mail.otscup.com 健康 200。
  - **Version**：`5fa35bf6-5de1-490c-bdad-526f9a2d00f0`。回滚：`wrangler rollback`（无 D1 schema 变更）。
  - **⚠️ 待补验证**：开关默认 OFF，RBAC/限速/审计的实际生效尚未端到端测（需豆豆先在 Cloudflare 把 `mcp_switch` 设为 `true`，再用 MCP 客户端带 JWT 调 5 个工具）。建议合并前或合并后紧跟一次端到端验证。

---
## 部署 #7 — OAuth 注销级联删 + 存量残留清理（d686534）
- **代码**：`d686534 fix(oauth)`。`userService.delete` 软删账号时同步 `oauthService.deleteByUserIds([userId])`，**注销即解绑 OAuth**，修复「注销后用同款 Google/GitHub 登录报『账号已注销』、且该 OAuth 被残留占用无法重注册」。
- **存量残留清理**（dev 修复只管未来注销，历史残留需手动清）：全表扫 `oauth.userId` 指向软删/不存在账号的行，删 2 条（linuxdo `shortdeng`→user9、Google `dengxutao1993@gmail.com`→user10，均 is_del=1）。
- **复核**：清理后全表扫残留 = **0 条**；现存 4 行 oauth 全部健康（user_id=0 未绑定 / user_id=1 admin 双绑 / user_id=11 is_del=0），账号所有权边界干净。
- **Version**：`70f1f912-5559-45f7-8e4f-30700d31bad8`。回滚：`npx wrangler rollback`（无 schema 变更）。

---
## 部署 #6（当前线上）— TG sendPhoto 方案 A（内嵌图直发聊天）
- **时间**：2026-09-23 14:00 (CST)
- **代码**：HEAD `799f3b5`（feat(tg): sendPhoto inline email images to chat）
- **变更**：
  - `telegram-service.js` 新增 `sendPhotosToBot`：`sendEmailToBot` 发完文本摘要后逐张发内嵌图
  - 过滤 image mime + contentId（CID 内嵌图），photo=R2 公开 URL（baseUrl/key），caption=主题/发件人/图序号 + View 按钮兜底
  - 上限 **5 张/封**防刷屏；无内嵌图/无 r2Domain 静默跳过、零回归
- **Version ID**：`3c7c006c-5eac-4908-88fe-17fa175d2c68`
- **验证**：
  - ✅ 单测 92/92 绿
  - ✅ QA 离线回归 87/87 gmail@ 样本无回退
  - ✅ dry-run 通过；✅ 部署成功；✅ 健康检查 mail.otscup.com 200
- **回滚方式**：`npx wrangler rollback`

---
## 部署 #5（已被 #6 覆盖，2026-09-23）
- **时间**：2026-09-23 12:08 (CST)
- **代码**：HEAD `1c4b6d5`（fix(tg): summary-style body in TG notify）
- **变更**：
  - `email-msg.js` 从「整封正文截断到 3500」改为摘要式 `buildSummary()`：
    - 先按行折叠超长行（>80 字符长 URL/base64/长域名 → 60 字符 + …）
    - 再取前 ~400 字符作为正文摘要 + 省略号；全文靠 View 按钮在 web_app 看
  - **② TG 内直接看图（sendPhoto）为独立新功能，另行评估（架构/豆豆拍板），未混入**
- **Version ID**：`6dd1ac84-c808-4d4c-9db2-360abc10416b`
- **验证**：
  - ✅ 单测 92/92 绿（+email-msg 5，含短正文保留/长URL折叠/超长截断/hide/空正文）
  - ✅ QA 离线回归 87/87 gmail@ 样本仍全中（无回退）
  - ✅ dry-run 通过；✅ 部署成功；✅ 健康检查 mail.otscup.com 200
- **回滚方式**：`npx wrangler rollback`（回退到上一 Version）

---
## 部署 #4（已被 #5 覆盖，2026-09-20）
- **时间**：2026-09-20（豆豆指令"直接部署，自行实测"）
- **代码**：HEAD `e870134`（v1.4 全套：N-01 GitHub + Google OAuth + 登录态 bind + provider 列 + session-guard 修复）
- **Version ID**：`70d8d26a-2afd-4730-a970-2e4b41526621`
- **变更**：
  - `POST /api/oauth/github/login`、`POST /api/oauth/google/login`、`PUT /api/oauth/bind` 新路由上线
  - 前端构建产物（mail-worker/dist，含 google/state=bind/绑定卡）上传 R2 `mail-r2/web/`
  - wrangler vars：`github_switch=true`、`google_switch=true`、`SKIP_FORWARD_GMAIL_FORWARDED=true`、`GMAIL_ROUTING_INBOX`
- **验证**：
  - ✅ dry-run 通过（3048 KiB / gzip 629 KiB）
  - ✅ `wrangler deploy` 成功
  - ✅ 站点 200（mail.otscup.com / workers.dev）
  - ✅ 新路由挂载实测：`/api/oauth/github/login`→501 授权码无效、`/api/oauth/google/login`→501 令牌失败、`/api/oauth/bind`→401 未认证（均为路由存在且正确校验）
  - ⏳ 前端 R2 上传后台进行中（234 文件）
- **⚠️ 未完成项（豆豆实际使用时注意）**：
  1. **google 凭据未配**（client_id/secret/callback_url 全缺）→ Google 按钮显示但授权会失败
  2. **github_callback_url 未配**（client_id/secret 已有）→ GitHub 登录回调可能不完整
  3. **D1 provider 列 migration 未跑**（`GET /api/init/{secret}`，需 init secret）→ oauth 表尚无 provider 列，google/github 落库会失败
- **回滚方式**：`npx wrangler rollback`（回退到部署 #3 `9d17e09d`；注：provider migration 若已跑不可回滚，但当前未跑）

---

## 部署 #4（当前线上）— N-02 v1.3 判定源重构
- **时间**：2026-09-23 07:52 (CST)
- **代码**：HEAD `33c8f9a`（feat(n02): routing-inbox primary signal §4.11 v1.3）
- **变更**：
  - 判定主信号改为**收件地址命中 `GMAIL_ROUTING_INBOX`**（默认 `gmail@otscup.com`，大小写不敏感）→ Google 通道只进 TG，跳过 forward
  - 来源域/签名头降为辅助（B 类 Gmail 自动转发 From 非 google 域 + CF 可能剥头 + D1 无 headers 列 → 均不可依赖）
  - 接入点 `email.js` 传 `message.to`，诊断日志加 `toEmailRouting`
  - `wrangler.toml` 固化 `GMAIL_ROUTING_INBOX = "gmail@otscup.com"`（防 --var 丢失纪律）
- **Version ID**：`01cd4205-487d-4c0b-97ae-eaa5531af754`
- **验证**：
  - ✅ 单测 87/87 绿（原 85 + QA 离线回归 2）
  - ✅ **QA 离线回归：D1 真实 `to_email=gmail@otscup.com` 87 封历史样本 → 主信号命中 87/87，未命中 0**
  - ✅ dry-run（3048 KiB / gzip 629 KiB，vars 含 GMAIL_ROUTING_INBOX + SKIP_FORWARD_GMAIL_FORWARDED=true）
  - ✅ 部署成功；✅ 健康检查 mail.otscup.com / worker 均 HTTP 200
- **已知代价（豆豆已接受）**：163 等非 Google 来源直发 `gmail@otscup.com` 也归 Google 通道只进 TG（419 样本：vincent_dam@163.com → gmail@otscup.com）
- **回滚方式**：`npx wrangler rollback`（回退到部署 #3 `9d17e09d`；本次无 D1 schema 变更）

---
## 部署 #3（当前线上）
- **时间**：2026-09-19 06:59 (CST)
- **代码**：HEAD `9a505df`（N-02 Gmail 转发邮件分流规则）
- **变更**：新增 `src/utils/emailRules.js` + `email/email.js` L173 接入（Gmail 转发邮件跳过 forward，只 TG+保存）
- **Version ID**：`9d17e09d-0a7c-4f2c-8534-8d3fd6c30469`
- **验证**：✅ 54/54 单测通过；✅ dry-run（3034 KiB / gzip 626 KiB）；✅ 部署成功
- **注意**：分流开关 `SKIP_FORWARD_GMAIL_FORWARDED=false`（默认关闭，零回归）；启用需配 env=true
- **回滚方式**：`npx wrangler rollback`（回退到部署 #2 `a1d69c61`）

---

## 部署 #2（已被 #3 覆盖）
- **时间**：2026-09-19 04:31 (CST)
- **代码**：HEAD `8cf0a68`（detail() 补 await 修复 P0-02 500）
- **变更**：`email-service.js detail()` L1060 补 `await`（SELECT get()），修复 detail 端点全 500
- **Version ID**：`a1d69c61-f1fb-4a85-9b2a-5e471c81c996`
- **验证**：
  - ✅ 54/54 单测通过
  - ✅ dry-run 通过（3031 KiB / gzip 625 KiB）
  - ✅ 健康检查：`POST /login` 200，token 有效
  - ✅ P0-02 复测：`GET /email/detail?emailId=150/353/179` 全 200，subject/content/attList/isStar 完整；不存在 id 返回 501（非 500）
- **回滚方式**：`npx wrangler rollback`（回退到上一 Version，即部署 #1 的 `1b709898`）

---

## 部署 #1（已被 #2 覆盖）
- **时间**：2026-09-19 04:10 (CST)
- **代码**：HEAD `cb09b31`（read() 补 .run() 修复 P0-01）
- **变更**：
  - `email-service.js read()` L1054 补 `.run()`（Drizzle UPDATE 真正执行）
  - 含 v1.0 全量新代码（detail 端点、webhook 兼容层、OAuth 错误详情、T-04 索引迁移、T-02 空态兜底）
- **Version ID**：`1b709898-222d-48e5-821f-243cc52cfc5a`
- **验证**：54/54 单测通过；dry-run 通过；登录 200
- **已知问题（部署后暴露）**：detail 端点全 500（缺 await）→ 部署 #2 修复
- **回滚方式**：`npx wrangler rollback`

---

## 部署前基线（旧代码）
- **代码**：`cfe4637`（v1.0 之前，无 detail 端点，read() 无 .run()）
- **验证**：现网 `GET /email/detail` 404；P0-01 read 依赖 .run() 修复

## 部署事项备忘（待豆豆确认后执行）
- [ ] `linuxdo_*` env 配置（登录入口可见）：`linuxdo_client_id`/`linuxdo_callback_url`/`linuxdo_switch=true`（vars）+ `linuxdo_client_secret`（secret）
- [ ] `GET /api/init/{secret}` 跑 T-04 索引迁移（若未自动执行）
- [ ] 测试完成提醒豆豆改回 admin 密码

## 待部署：v1.4 Google OAuth + 绑定重构（HEAD `e870134`，2026-09-20 代码验收通过暂缓）
- **范围**：后端 `6b2c408`（`POST /oauth/google/login` OIDC、登录态 `PUT /oauth/bind`、signup gate 修正堵 P0 backdoor、`oauth` 表 `provider` 列 + D1 migration）+ 前端 `984e537`（Google 按钮、state 分流、设置页绑定卡）+ `e870134`（session-guard 修 OAuth 绑定接管）。
- **代码验收**：✅ worker 单测 80/80 绿（oauth 8 例含 googleUserToOauth）；后端与架构 v1.4 契约全对齐；前端源码完整；前端 dist **已重建**；**`e870134` 会话接管修复 QA 复核通过**。详见 `docs/test-report.md`。
- **⚠️ 部署前待解（BLOCK）**：
  1. ~~前端 dist 未更新~~ ✅ 已重建（`984e537`）。
  2. **D1 migration `provider` 列**：跑 `GET /api/init/{secret}`（ALTER TABLE oauth ADD COLUMN provider + 回填 linuxdo + UNIQUE 索引）。
  3. **env 配置**（github 同批）：`google_client_id`/`google_callback_url`/`google_switch=true`（vars）+ `google_client_secret`（secret）；`github_client_id`/`github_callback_url`/`github_switch=true` + `github_client_secret`。
  4. ~~OAuth 绑定接管洞~~ ✅ 已由 `e870134` session-guard 修复并 QA 复核（BLOCK-3 解除）。
- **⚠️ secret 勿写 `[vars]`**（进 git/Dashboard 明文）。
- **回滚方式**：`npx wrangler rollback`（回退到部署 #3 `9d17e09d`；注：本次含 D1 migration，回滚 worker 版本不影响已落库的 provider 列）。
- **状态**：⏸ 暂缓——代码全绿，仅剩豆豆提供 github/google 凭据 + D1 migration + 真实账号 E2E（BLOCK-1/2）。

## 待部署：N-01 GitHub OAuth（提交 `49755ce`，2026-09-19 验收通过，暂缓）
- **代码验收**：✅ 单测 76/76 绿（oauth-github 4 新增）、前端 build 成功、契约对齐 architecture §3.1 N-01。详见 `docs/test-report.md`。
- **部署阻塞（BLOCK-1）**：现网 wrangler[ vars]/secret 缺 `github_*` 配置 → 即便部署按钮也不显示（fallback 为验收标准③默认分支）。需豆豆提供 GitHub OAuth App client_id/secret。
- **配置清单**（配好后方可部署）：`github_client_id` + `github_callback_url` + `github_switch=true`（`[vars]`/`--var`）+ `github_client_secret`（`wrangler secret put`）。
- **⚠️ 禁止把 secret 写 `[vars]`**（会进 git / Dashboard 明文）。
- **回滚方式**：`npx wrangler rollback`（回退到部署 #3 `9d17e09d`）。
- **状态**：⏸ 暂缓——等豆豆提供凭据后部署并补真实账号 E2E。