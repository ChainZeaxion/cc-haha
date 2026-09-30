# 17-h5-mobile-market-layout — H5/移动端技能市场页 header 布局适配（链位 17，`17-h5-mobile-market-layout.patch`）

> 功能组：pr-1 — H5 远程访问与移动端支持（pr-prepare/pr-1/）
> 链位 17，patch `17-h5-mobile-market-layout.patch`（本目录）

- 需求背景：用户 verbatim：「主要是技能市场，该页面内大标题下面的文字排成了9行，这相当不合理。」390px 下 `MarketHome` header（`flex flex-wrap`：56px 图标 + 标题列 + 228px SourceStatusBar + 146px 按钮）标题列只剩 16px，副标题折 15 行、header 总高 508px≈屏幕 60%。
- 方案：`MarketHome.tsx` 右侧集群容器加 `max-lg:items-start max-lg:basis-full`——窄屏（<1024px）换行独占一行，标题列拿满剩余宽度；桌面端 `max-lg:` 不生效布局零变化。纯响应式 CSS，无新 i18n/逻辑改动。
- 验证：live 7788 移动端 390×844：副标题 15 行→2 行，header 508px→158px，信息全保留；桌面 1280px 零变化；tsc 0 错，市场+页面 vitest 872/872，全量 12300 pass/0 fail（零回归）。
