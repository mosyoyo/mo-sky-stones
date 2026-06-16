# mo-sky-stones

光遇国服日历订阅。

红石、黑石会按当前规则自动生成。活动、旅行先祖、季节、双倍和维护公告走后台审核，确认后才会进日历。

## 订阅地址

```text
https://sky-stones-bni.pages.dev/red.ics
https://sky-stones-bni.pages.dev/black.ics
https://sky-stones-bni.pages.dev/events.ics
https://sky-stones-bni.pages.dev/calendar.ics?types=red,black
```

首页可以勾选内容，生成一个自选订阅链接。

常用类型：

```text
red
black
traveling_spirit
season
activity
bonus
maintenance
```

例如只订阅红石、黑石和旅行先祖：

```text
https://sky-stones-bni.pages.dev/calendar.ics?types=red,black,traveling_spirit
```

## 规则

红石和黑石每天只保留最后一场。如果当天最后一场超过 23 点，就改用前一场。

公告事件不会自动全部进入日历。同步脚本只负责抓公告和解析时间，后台审核后才会写进 `events.json`。

活动提醒大致按这个方式生成：

- 旅行先祖：短周期连续显示，并加离开提醒
- 季节：开始提醒和结束前一天提醒
- 活动：短活动可以连续显示，长活动只保留开始和结束提醒
- 双倍：按全天连续事件显示
- 维护：按维护时间显示

## 后台

后台入口不放在首页。直接访问：

```text
https://sky-stones-bni.pages.dev/admin/login/
```

登录后可以看三个页面：

```text
/admin/feed/    公告审核
/admin/events/  事件管理
/admin/sync/    同步日志
```

公告审核页不是点一下就提交。现在是先标记多条公告，最后点“统一提交”。这样只会写一次 GitHub，也只触发一次 Pages 部署。

## Cloudflare 配置

Cloudflare Pages 里可以只加一个变量：

```text
APP_CONFIG
```

值是 JSON：

```json
{
  "adminPassword": "你的后台密码",
  "githubToken": "ghp_xxx",
  "githubOwner": "mosyoyo",
  "githubRepo": "mo-sky-stones",
  "githubBranch": "main"
}
```

`githubToken` 需要能写这个仓库。后台批准、忽略、保存事件时会用它提交 `data/feeds.json` 和 `data/events.json`。

也兼容旧的分散变量：

```text
ADMIN_PASSWORD
GITHUB_TOKEN
GITHUB_OWNER
GITHUB_REPO
GITHUB_BRANCH
```

新部署建议直接用 `APP_CONFIG`，少填几次，也不容易漏。

## 自动同步

GitHub Action 会定时抓取网易大神官方动态：

```text
.github/workflows/sync-events.yml
```

本地也可以手动跑：

```bash
npm run fetch
npm run parse
npm run build:events
```

或者一次跑完：

```bash
npm run sync
```

## 本地检查

```bash
npm test
```

测试会生成预览文件：

```text
preview-red.ics
preview-black.ics
```

这些 `.ics` 文件只留在本地，`.gitignore` 已经忽略，不要提交到 GitHub。

## 文件

```text
calendar-engine.js       红石、黑石日期和场次计算
ics-generator.js         红石、黑石 ICS 生成
functions/*.ics.js       Cloudflare Pages 订阅接口
functions/api/*.js       后台接口
src/scripts/*.js         抓取、解析、生成事件
src/event-utils.js       公告分类、时间解析、活动 ICS 生成
data/feeds.json          抓到的公告
data/events.json         已进入日历的事件
data/sync.json           同步日志
```

这是个人用的小工具，不是官方服务。游戏规则变了，就改配置和解析规则。
