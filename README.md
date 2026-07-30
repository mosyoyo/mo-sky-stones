# sky-ics · 光遇国服日历订阅

非官方、非营利的粉丝工具。将《光遇》国服红石/黑石时间表和官方公告事件转换为标准 iCalendar (.ics) 订阅，用户可以一键添加到手机日历并收到提醒。

**在线访问：** https://sky-ics.pages.dev/

---

## 技术亮点

**时区精确计算**
Cloudflare Workers 运行时为 UTC，不能依赖 `new Date().getDate()` 推算北京日历日。使用 `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' })` 明确获取北京时区日期，解决 UTC 00:00–08:00 窗口内日历日判断错误的 bug。

**ICS 订阅刷新（RFC 5545 + ETag）**
iOS / Android 日历客户端默认对订阅 URL 强缓存。通过在响应头加入 `REFRESH-INTERVAL:PT1H`、`X-PUBLISHED-TTL:PT1H`，并对所有 ICS 接口统一返回 `Cache-Control: no-cache, must-revalidate` + `ETag`，使客户端正确走条件请求（`If-None-Match` → 304），解决手机日历不更新内容的问题。

**Web Crypto API 认证**
后台登录使用 `crypto.subtle.sign('HMAC', key, data)`（标准 HMAC-SHA256）替换自拼的 `SHA256(value + secret)` 方案，防止哈希长度扩展攻击。密码比对通过自实现的 `timingSafeEqual`（逐字节 XOR 累加）防止 timing side-channel。

**无状态速率防护**
Cloudflare Workers 多 isolate 架构下，进程内存计数器在并发请求间不共享。移除了误导性的 `failCount` 变量，改为在所有错误响应上施加固定延迟（500ms），配合 Cloudflare Dashboard 的 Rate Limiting rules 提供真实防护。

**数据管道**
GitHub Actions 每6小时执行一次同步：抓取网易大神公告 → 解析分类 → 经后台人工审核 → 写入 `data/events.json` → 触发 Cloudflare Pages 重新部署。只有日历数据真正变化时才生成 commit，避免无效构建。

---

## 功能

- 红石/黑石时间订阅（按游戏内固定规律计算，每天只保留最后一场）
- 旅行先祖、季节、活动、双倍、大蜡烛、维护公告订阅
- 自选组合订阅（`/subscribe`）和指定先祖订阅（`/spirits`）
- 全平台兼容：iOS 系统日历、Android 日历 App、macOS 日历、Outlook
- 后台审核界面：公告审核、事件管理、先祖配置、同步日志

---

## 订阅地址

主入口（推荐）：

```
https://sky-ics.pages.dev/
```

直接订阅接口：

```
https://sky-ics.pages.dev/red.ics           红石
https://sky-ics.pages.dev/black.ics         黑石
https://sky-ics.pages.dev/events.ics        活动公告
https://sky-ics.pages.dev/spirit-events.ics 旅行先祖（默认配置）
https://sky-ics.pages.dev/calendar.ics      合集（推荐参数见下）
```

推荐合集订阅（含10分钟提醒）：

```
https://sky-ics.pages.dev/calendar.ics?types=red,traveling_spirit,season,activity,bonus,candle_heap,maintenance&endOnly=traveling_spirit,season,activity
```

`endOnly` 表示该类型只保留结束提醒，避免持续事件占满日历。可选类型：`red` `black` `traveling_spirit` `season` `activity` `bonus` `candle_heap` `maintenance`。

指定先祖订阅：进入 `/spirits` 页面最多选择3个先祖，生成独立链接：

```
https://sky-ics.pages.dev/spirit-events.ics?spirits=希望之种,致敬钢琴家
```

---

## 使用方法

1. 打开 https://sky-ics.pages.dev/，点"订阅光遇日历"
2. **iOS / iPad**：点"添加"后进入系统日历 → 底部"日历"列表 → 订阅右侧 `i` → 打开"事件提醒"
3. **Android**：复制 HTTPS 链接 → 打开日历 App → 找"添加日历"/"订阅日历"/"URL"入口 → 粘贴链接
4. 如需自选内容，进入 `/subscribe`；如需关注特定先祖复刻，进入 `/spirits`

遇到问题可访问 `/help`，或加 QQ 群 `1014055900`。

---

## 架构

```
┌─────────────────────────────────────────────────────────┐
│  GitHub Actions（每 6 小时）                              │
│  fetchFeeds → parseFeed → buildEvents → commit data/    │
└──────────────────────┬──────────────────────────────────┘
                       │ push → 触发部署
┌──────────────────────▼──────────────────────────────────┐
│  Cloudflare Pages                                        │
│  ┌─────────────────┐  ┌──────────────────────────────┐  │
│  │  静态文件        │  │  Functions (Workers)         │  │
│  │  index.html     │  │  /red.ics  /black.ics        │  │
│  │  subscribe.html │  │  /events.ics /calendar.ics   │  │
│  │  spirits.html   │  │  /spirit-events.ics          │  │
│  │  admin/*.html   │  │  /api/admin-*                │  │
│  └─────────────────┘  └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

- **calendar-engine.js**：红/黑石日期和场次计算（纯函数，无 I/O）
- **ics-generator.js**：生成 RFC 5545 标准 VEVENT，含 VALARM 提醒
- **functions/_middleware.js**：鉴权中间件，保护 `/data/` 和 `/admin/` 路径
- **functions/_shared.js**：HMAC-SHA256 签名、timingSafeEqual
- **src/scripts/**：抓取、解析、合并事件的 Node.js 脚本（仅在 GitHub Actions 和本地运行）

---

## 技术栈

| 层 | 技术 |
|---|---|
| 托管 / CDN | Cloudflare Pages + Pages Functions（Workers） |
| ICS 标准 | RFC 5545 iCalendar |
| 认证 | HMAC-SHA256（Web Crypto API）+ timingSafeEqual |
| 时区 | `Intl.DateTimeFormat` — Asia/Shanghai 显式计算 |
| CI / 数据同步 | GitHub Actions（每6小时 cron） |
| 前端 | 原生 HTML/CSS/JS，无框架 |
| 运行时 | Node.js 20（脚本）/ Cloudflare Workers（接口） |

---

## 部署

### Cloudflare Pages 配置

项目设置：

```
Project name: sky-ics
Production branch: main
Build command: npm run build:events
Build output directory: .
Functions directory: functions
Node.js version: 20
```

### 环境变量

在 Cloudflare Pages → Settings → Environment variables 中配置（**Production** 环境）：

```json
{
  "adminPassword": "你的后台密码",
  "githubToken": "github_pat_xxx",
  "githubOwner": "你的 GitHub 用户名",
  "githubRepo": "mo-sky-stones",
  "githubBranch": "main",
  "webAnalyticsToken": "可选：Cloudflare Web Analytics token"
}
```

变量名：`APP_CONFIG`，类型：**Secret**（加密）。

也兼容分散变量（优先级低于 `APP_CONFIG`）：

```
ADMIN_PASSWORD
GITHUB_TOKEN
GITHUB_OWNER
GITHUB_REPO
GITHUB_BRANCH
CF_WEB_ANALYTICS_TOKEN
CLOUDFLARE_WEB_ANALYTICS_TOKEN
```

### GitHub Token 权限

推荐使用 **Fine-grained personal access token**：

```
Repository access: Only select repositories → 你的用户名/mo-sky-stones
Permissions:
  Contents: Read and write
  Metadata: Read-only
```

后台需要此 token 来提交 `data/*.json` 的变更。不要使用已泄漏的 token；如需更新，在 Cloudflare 环境变量中替换后重新部署。

---

## 本地开发

### 安装依赖

```bash
npm install
```

### 同步数据

完整同步流程：

```bash
npm run sync
```

等价于：

```bash
npm run fetch          # 抓取网易大神公告
npm run parse          # 解析公告并分类
npm run fetch:souls    # 抓取 BWiki 先祖数据
npm run verify:souls   # 验证先祖数据
npm run build:events   # 合并并生成事件文件
```

### 测试

```bash
npm test
```

生成 `preview-red.ics` 和 `preview-black.ics`，可用本地日历 App 打开验证。

### 调试环境变量

抓取更多历史公告：

```bash
# Bash / sh
FEED_FETCH_OLDER=1 FEED_TARGET_COUNT=300 FEED_MAX_PAGES=30 npm run fetch

# PowerShell
$env:FEED_FETCH_OLDER='1'
$env:FEED_TARGET_COUNT='300'
$env:FEED_MAX_PAGES='30'
npm run fetch
```

导出静态 ICS（用于本地测试，不建议部署）：

```bash
# Bash / sh
WRITE_STATIC_ICS=1 npm run build:events

# PowerShell
$env:WRITE_STATIC_ICS='1'
npm run build:events
```

---

## 文件结构

```
calendar-engine.js              红/黑石日期和场次计算（纯函数）
ics-generator.js                红/黑石 ICS 生成（RFC 5545）
config.js                       石头时间表配置
functions/
  _middleware.js                鉴权中间件（HMAC-SHA256，保护 /data/ 和 /admin/）
  _shared.js                    公共工具：signAdminAuth、timingSafeEqual
  _ics-response.js              ICS 响应工具：ETag、304、Cache-Control
  *.ics.js                      各订阅接口（red/black/events/calendar/spirit-events）
  api/                          后台 API（登录、审核、事件管理等）
src/
  event-utils.js                公告分类、时间解析、活动 ICS 生成
  scripts/
    fetchFeeds.js               抓取网易大神公告
    parseFeed.js                解析公告并分类
    mergeEvents.js              双源合并，按北京日期去重
    fetchSoulSpirits.js         抓取 BWiki 先祖数据
    buildEvents.js              生成最终 data/events.json
    syncEvents.js               完整同步入口
data/
  events.json                   已进入日历的事件（经人工审核）
  feeds.json                    已抓取且可解析的公告
  event-overrides.json          后台的人工修改记录
  soul-spirits.json             先祖目录（BWiki 抓取）
  spirit-subscriptions.json     默认先祖配置
  source-config.json            各类型的数据源偏好
  sync.json                     同步日志
admin/                          后台前端页面
test.js                         单元测试（red/black 石日期边界、ICS 生成）
```

---

## 后台

入口（不在首页展示）：

```
https://sky-ics.pages.dev/admin/login/
```

页面：

```
/admin/feed/      公告审核（搜索、分页、类型筛选、批量提交）
/admin/events/    事件管理
/admin/spirits/   默认先祖配置
/admin/sync/      同步日志
/admin/settings/  数据源设置
```

后台提交操作会通过 GitHub API 写入对应 `data/*.json`，然后触发 Cloudflare Pages 重新部署。

---

## 数据来源与免责声明

| 数据 | 来源 |
|---|---|
| 红石/黑石规律 | 游戏社区逆向整理，参考 [CikiSyteen/sky-stones](https://github.com/CikiSyteen/sky-stones) |
| 公告事件（旅行先祖、活动等） | 网易大神官方动态（公开页面） |
| 先祖目录 | [光遇 Wiki (BWiki)](https://wiki.biligame.com/sky/) |

**本项目为非官方、非营利的粉丝工具，与 thatgamecompany 和网易无任何关联。**
游戏内容版权归 thatgamecompany 所有。如权利方要求，将立即停止服务并下架相关内容。

---

## 维护注意

ICS 里的 `UID` 域名、`PRODID` 和后台 cookie 签名前缀属于兼容标识，不要批量更改——手机日历可能会把事件当成全新日程，导致重复或重新订阅异常。

---

## License

[MIT](LICENSE) © mosyoyo


