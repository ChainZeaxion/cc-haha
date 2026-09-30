# 09-disable-updates — 设置-关于-更新：禁止更新开关（链位 9，09-disable-updates.patch）

> 功能组：pr-2 — 会话基础功能（导出/刷新/禁止更新/思考开关）（pr-prepare/pr-2/）
> 链位 9，patch `09-disable-updates.patch`（本目录）

- 需求背景：桌面端 设置→关于→更新 区域加「禁止更新」开关，彻底关闭自动更新检查与下载（0.6.6 现状：启动延迟 5s 即 `checkForUpdates({silent:true})` 检查+可自动下载，AboutSettings 仅手动检查按钮，无开关）。语义=完全禁用（含手动）：启动检查跳过 + 手动「检查更新」按钮置灰。
- 方案：
  - `desktop/src/types/settings.ts` 加 `disableUpdates?: boolean`；`settingsStore.ts` 加字段 + hydrate + `setDisableUpdates`（乐观 set → `settingsApi.updateUser` → 失败回滚）。
  - `updateStore.ts` 两处守卫：`initialize()` 与 `checkForUpdates()` 各加 `if (useSettingsStore.getState().disableUpdates) return`——启动/手动检查全拦，`checkForUpdates` 外部调用方仅 AboutSettings 按钮一处，store 层守卫即全覆盖，自动下载随检查入口一并停。
  - `AboutSettings.tsx`：Check now 按钮 `disabled={disableUpdates}` + 新增 Switch（桌面+H5 共用「关于」tab）。
  - `src/server/remoteBrowserPolicy.ts`：`disableUpdates` 加进 `READ_SETTINGS`/`WRITE_SETTINGS` 白名单（H5 浏览器端走 `validateRemoteSettingsPatch`/`projectRemoteSettings`，漏改会 PUT 400 + 开关回弹——本项实际踩过的坑）。
  - i18n `update.disableUpdates`/`update.disableUpdatesDescription` 5 语言；测试 `updateStore.test.ts` +2、`remoteBrowserPolicy.test.ts` +3 断言。
- 验证：`tsc -b` 0；`updateStore.test.ts` 20/20；全量前端 vitest 6143 pass/2 fail（基线既有，零回归）；dev 7788 H5 关于页实测开关开→persisted=true+按钮置灰、关→恢复。
