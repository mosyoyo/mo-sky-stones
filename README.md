# mo-sky-stones

光遇国服日历订阅工具。红石、黑石自动计算；旅行先祖、季节、活动、双倍、大蜡烛和维护公告从官方动态抓取，后台审核后进入日历。

## 订阅地址

```text
https://sky-stones-bni.pages.dev/
```

首页会生成自选订阅链接。也可以直接使用接口：

```text
https://sky-stones-bni.pages.dev/red.ics
https://sky-stones-bni.pages.dev/black.ics
https://sky-stones-bni.pages.dev/events.ics
https://sky-stones-bni.pages.dev/calendar.ics?types=red,traveling_spirit,season,activity,bonus,candle_heap,maintenance&endOnly=traveling_spirit,season,activity
```

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

## 当前规则

红石和黑石每天只保留最后一场。如果当天最后一场超过 23 点，就改用前一场。

公告事件不会自动全部进入日历。同步脚本只负责抓公告、分类、解析时间；后台批准后才会写进 `data/events.json`。

提醒生成规则：

- 旅行先祖、季节、活动：默认可以生成持续事件和结束提醒；订阅页可选“仅结束”。
- 双倍、大蜡烛：无论持续多少天，都按连续事件显示。
- 维护：按维护时间显示。
- 解析不到开始/结束时间的公告会被过滤掉。
- 识别为活动但只有 1 天的动态会过滤成 `other`，减少噪音。

## 后台

后台入口不放在首页，直接访问：

```text
https://sky-stones-bni.pages.dev/admin/login/
```

页面：

```text
/admin/feed/    公告审核
/admin/events/  事件管理
/admin/sync/    同步日志
```

公告页支持搜索、分页、类型筛选和批量提交。后台提交会写入 GitHub，然后触发 Cloudflare Pages 重新部署。

## Cloudflare Pages 配置

Cloudflare Pages 项目字段：

```text
Project name: sky-stones-bni
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
  "githubBranch": "main"
}
```

字段说明：

```text
adminPassword   后台登录密码
githubToken     后台写入 data/*.json 时使用的 GitHub token
githubOwner     GitHub 用户名或组织名，这里是 mosyoyo
githubRepo      仓库名，这里是 mo-sky-stones
githubBranch    分支名，一般是 main
```

也兼容分散变量：

```text
ADMIN_PASSWORD
GITHUB_TOKEN
GITHUB_OWNER
GITHUB_REPO
GITHUB_BRANCH
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
data/sync.json
```

不要使用已经泄漏过的 token。删掉旧 token 后，在 Cloudflare Pages 环境变量里补新的 `githubToken`，再重新部署一次。

## 自动同步

GitHub Action 每 6 小时抓一次网易大神官方动态：

```text
.github/workflows/sync-events.yml
```

它会执行：

```bash
npm run sync
```

然后提交 `data/` 的变化。也可以在 GitHub Actions 页面手动点 `Run workflow`。

本地手动同步：

```bash
npm run fetch
npm run parse
npm run build:events
```

或者一次跑完：

```bash
npm run sync
```

抓更多历史公告时可以临时指定：

```bash
FEED_TARGET_COUNT=300 FEED_MAX_PAGES=30 npm run fetch
```

PowerShell 写法：

```powershell
$env:FEED_TARGET_COUNT='300'
$env:FEED_MAX_PAGES='30'
npm run fetch
```

## 本地检查

```bash
npm test
npm run build:events
```

`npm test` 会生成：

```text
preview-red.ics
preview-black.ics
```

这些 `.ics` 文件只用于本地预览，`.gitignore` 已经忽略，不要提交到 GitHub。

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
data/sync.json           同步日志
```

## 安全备忘

- 不要把 GitHub token 放进 Git remote URL。
- 不要把 token 写进 README、代码、截图或聊天记录。
- 本地推送用浏览器授权、GitHub CLI 或 SSH key。
- Cloudflare Pages 里用 Secret 环境变量保存 token。

这是个人用的小工具，不是官方服务。游戏规则或公告格式变了，就改配置和解析规则。
