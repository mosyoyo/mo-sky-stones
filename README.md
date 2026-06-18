# sky-ics

光遇国服日历订阅工具。红石、黑石自动计算；旅行先祖、季节、活动、双倍、大蜡烛和维护公告从官方动态抓取，后台审核后进入日历。

## 订阅地址

```text
https://sky-ics.pages.dev/
```

首页会生成自选订阅链接。也可以直接使用接口：

```text
https://sky-ics.pages.dev/red.ics
https://sky-ics.pages.dev/black.ics
https://sky-ics.pages.dev/events.ics
https://sky-ics.pages.dev/spirit-events.ics
https://sky-ics.pages.dev/spirits
https://sky-ics.pages.dev/calendar.ics
https://sky-ics.pages.dev/calendar.ics?types=red,traveling_spirit,season,activity,bonus,candle_heap,maintenance&endOnly=traveling_spirit,season,activity
```

直接订阅 `/calendar.ics` 时，默认等同首页推荐选择：红石、旅行先祖、季节、活动、双倍、大蜡烛、维护；其中旅行先祖、季节、活动只保留结束提醒。

可选类型：

```text
red                 红石
black               黑石
traveling_spirit    旅行先祖
season              季节
activity            活动
bonus               双倍
candle_heap         大蜡烛
maintenance         维护
```

`endOnly` 表示只保留结束提醒，例如：

```text
?types=red,activity&endOnly=activity
```

指定先祖订阅页面：

```text
https://sky-ics.pages.dev/spirits
```

页面会读取 `data/soul-spirits.json`，最多选择 3 个先祖，然后生成独立订阅链接：

```text
https://sky-ics.pages.dev/spirit-events.ics?spirits=希望之种,致敬钢琴家
```

复制时保留 HTTPS 链接；点击“添加”时使用 `webcal://` 唤起手机日历。

公开自选链接不依赖后台保存，每个用户可以生成自己的 `?spirits=` 订阅地址。后台的先祖页面只用于维护“不带 URL 参数时”的默认配置。

## 当前规则

红石和黑石每天只保留最后一场。如果当天最后一场超过 23 点，就改用前一场。

公告事件不会自动全部进入日历。同步脚本只负责抓公告、分类、解析时间；后台批准后才会写进 `data/events.json`。

提醒生成规则：

- 旅行先祖、季节、活动：默认可以生成持续事件和结束提醒；订阅页可选“仅结束”。
- 双倍、大蜡烛：无论持续多少天，都按连续事件显示。
- 维护：按维护时间显示。
- 指定先祖订阅：只在所选先祖出现在复刻事件里时生成日程。
- 解析不到开始/结束时间的公告会被过滤掉。
- 识别为活动但只有 1 天的动态会过滤成 `other`，减少噪音。

## 后台

后台入口不放在首页，直接访问：

```text
https://sky-ics.pages.dev/admin/login/
```

页面：

```text
/admin/feed/    公告审核
/admin/events/  事件管理
/admin/spirits/ 默认先祖配置
/admin/sync/    同步日志
/admin/settings/数据源设置
```

公告页支持搜索、分页、类型筛选和批量提交。后台提交会写入 GitHub，然后触发 Cloudflare Pages 重新部署。

## Cloudflare Pages 配置

Cloudflare Pages 项目字段：

```text
Project name: sky-ics
Production branch: main
Root directory: /
Build command: npm run build:events
Build output directory: .
Functions directory: functions
Node.js version: 20
```

如果 Cloudflare UI 不显示 `Functions directory` 字段也没关系，Pages 会自动识别项目根目录下的 `functions/`。

### 环境变量

在 Cloudflare Pages 项目里进入：

```text
Settings -> Environment variables
```

生产环境至少需要配置 `APP_CONFIG`。建议设成 Secret，不要写进代码、README、Git remote 或聊天记录里。

```json
{
  "adminPassword": "你的后台登录密码",
  "githubToken": "github_pat_xxx",
  "githubOwner": "mosyoyo",
  "githubRepo": "mo-sky-stones",
  "githubBranch": "main",
  "webAnalyticsToken": "Cloudflare Web Analytics token，可选"
}
```

字段说明：

```text
adminPassword   后台登录密码
githubToken     后台写入 data/*.json 时使用的 GitHub token
githubOwner     GitHub 用户名或组织名，这里是 mosyoyo
githubRepo      仓库名，这里是 mo-sky-stones
githubBranch    分支名，一般是 main
webAnalyticsToken  Cloudflare Web Analytics 的 token，填了以后首页会自动加载统计脚本
```

也兼容分散变量：

```text
ADMIN_PASSWORD
GITHUB_TOKEN
GITHUB_OWNER
GITHUB_REPO
GITHUB_BRANCH
CF_WEB_ANALYTICS_TOKEN
CLOUDFLARE_WEB_ANALYTICS_TOKEN
```

新部署建议只用 `APP_CONFIG`，少填几次，不容易漏。

### GitHub token 权限

推荐用 GitHub fine-grained personal access token：

```text
Repository access: Only select repositories -> mosyoyo/mo-sky-stones
Permissions:
  Contents: Read and write
  Metadata: Read-only
```

后台需要这个 token 来提交：

```text
data/feeds.json
data/events.json
data/event-overrides.json
data/source-config.json
data/soul-spirits.json
data/spirit-subscriptions.json
data/sync.json
```

不要使用已经泄漏过的 token。删掉旧 token 后，在 Cloudflare Pages 环境变量里补新的 `githubToken`，再重新部署一次。

## 自动同步

GitHub Action 每 6 小时同步一次：

```text
.github/workflows/sync-events.yml
```

它会执行：

```bash
npm run sync
```

同步内容包括：

```text
网易大神公告 -> data/feeds.json / data/events-netease.json
BWiki 活动日历 -> data/events-wiki.json
双数据源合并 -> data/events.json
BWiki 旅行先祖回归记录 -> data/soul-spirits.json
```

然后提交 `data/` 的变化。也可以在 GitHub Actions 页面手动点 `Run workflow`。

如果同步后只有 `data/sync.json` 日志变化，Action 会跳过提交；只有公告、事件、数据源配置或先祖目录等日历数据真的变化时，才会生成 `chore: sync events` 提交。

本地手动同步：

```bash
npm run sync
```

单独调试网易大神抓取和解析时可以拆开跑：

```bash
npm run fetch
npm run parse
npm run fetch:souls
npm run verify:souls
npm run build:events
```

抓更多历史公告时可以临时指定：

```bash
FEED_FETCH_OLDER=1 FEED_TARGET_COUNT=300 FEED_MAX_PAGES=30 npm run fetch
```

PowerShell 写法：

```powershell
$env:FEED_FETCH_OLDER='1'
$env:FEED_TARGET_COUNT='300'
$env:FEED_MAX_PAGES='30'
npm run fetch
```

默认同步会从最新公告开始抓，避免漏掉新动态。只有需要继续往前补历史时才设置 `FEED_FETCH_OLDER=1`。

## 本地检查

```bash
npm test
npm run verify:souls
npm run build:events
```

`npm test` 会生成：

```text
preview-red.ics
preview-black.ics
```

这些 `.ics` 文件只用于本地预览，`.gitignore` 已经忽略，不要提交到 GitHub。

`npm run build:events` 默认只校验活动 ICS 能否生成，不会在根目录写出 `events.ics`，避免部署时静态文件和 Cloudflare Function 路由冲突。需要本地导出时再临时执行：

```bash
WRITE_STATIC_ICS=1 npm run build:events
```

PowerShell：

```powershell
$env:WRITE_STATIC_ICS='1'
npm run build:events
```

## 文件结构

```text
calendar-engine.js       红石、黑石日期和场次计算
ics-generator.js         红石、黑石 ICS 生成
functions/*.ics.js       Cloudflare Pages 订阅接口
functions/api/*.js       后台接口
src/scripts/*.js         抓取、解析、生成事件
src/event-utils.js       公告分类、时间解析、活动 ICS 生成
data/feeds.json          抓到并能解析时间的公告
data/events.json         已进入日历的事件
data/event-overrides.json 事件页的人工修改和删除记录
data/source-config.json  数据源偏好
data/soul-spirits.json   BWiki 抓取的完整复刻先祖目录
data/spirit-subscriptions.json 默认先祖配置
data/sync.json           同步日志
```

## 安全备忘

- 不要把 GitHub token 放进 Git remote URL。
- 不要把 token 写进 README、代码、截图或聊天记录。
- 本地推送用浏览器授权、GitHub CLI 或 SSH key。
- Cloudflare Pages 里用 Secret 环境变量保存 token。

## 维护注意

ICS 里的 `UID` 域名、`PRODID` 和后台 cookie 签名前缀属于兼容标识，不是对外展示名。即使项目已经叫 `sky-ics`，也不要顺手把这些旧标识批量改掉；手机日历可能会把事件当成全新的日程，导致重复或重新订阅异常。

这是个人用的小工具，不是官方服务。游戏规则或公告格式变了，就改配置和解析规则。
