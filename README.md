# sky-stones-ics

光遇国服红黑石日历订阅。

项目提供红石、黑石和活动提醒订阅。红黑石每天只保留最后一场；如果当天最后一场在 23 点以后开始，就改用前一场。

## 订阅

部署后可以直接订阅：

```text
https://你的域名/red.ics
https://你的域名/black.ics
https://你的域名/events.ics
https://你的域名/calendar.ics?types=red,black
```

当前部署示例：

```text
https://sky-stones-bni.pages.dev/red.ics
https://sky-stones-bni.pages.dev/black.ics
```

主页可以勾选内容并生成自选订阅链接。

## 部署

Cloudflare Pages 连接这个仓库即可。

构建设置保持为空：

```text
Build command:
Build output directory:
```

Pages Functions 会处理 `/red.ics` 和 `/black.ics`。

## 本地检查

```bash
npm test
npm run build:events
```

测试会在本地生成 `preview-red.ics` 和 `preview-black.ics`。这些文件已被忽略，不会提交到 GitHub。

## 文件

```text
config.js              规则配置
calendar-engine.js     日期和场次计算
ics-generator.js       生成日历订阅内容
functions/red.ics.js   红石订阅
functions/black.ics.js 黑石订阅
functions/events.ics.js 活动订阅
functions/calendar.ics.js 自选合并订阅
test.js                本地检查
```

## 说明

这个项目只是个人使用的小工具，不是官方服务。游戏规则如果后续变动，需要同步调整配置。
