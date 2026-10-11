# computer-use — Computer Use 解锁 Linux(X11) + 连接器平台

> PR 分支：`computer-use-linux`（上游 `NanmiCoder/cc-haha`）｜基座 `068b3ebd`
> 单一真相源 patch 目录：`modify/patches/computer-use/`；应用顺序见 `modify/patches/ORDER.md`
> 组补丁（提 PR 用）：`00-group.patch`｜项清单：`manifest.md`｜逐项说明：`items/<主题>-<项>/`

## 优化项（双层版）

| 优化项 | patch | 原链位 | 行数 | 文件数 |
|---|---|---|---|---|
| `computer-use-connector-linux` | `computer-use-connector-linux-patch1.patch` | 16 | +21−11 | 4 |
| `computer-use-linux` | `computer-use-linux-patch1.patch` | 18,32,33 | +1473−81 | 31 |

## 功能域概述

本组让 cc-haha 在 Linux 平台上补全两块平台能力：一是把 Computer Use（电脑操作）从 macOS/Windows 扩展到 **Linux（X11 桌面）**，走 Windows 同款的像素面兼容路线（screenshot/点击/键入/滚动等 legacy pixel 工具 + Python helper），并修复组件选择与解释器路径填写在 Linux/H5 场景下的两类洞；二是让**连接器目录（飞书/钉钉/企微等）声明并可用 Linux（x64/arm64）**，使 Linux 桌面与 H5/服务端场景的连接器卡片不再显示「当前平台不支持」。

## 明细

逐项「问题/需求 · 方案 · 验证」见 `items/`（2 项）：
- `items/computer-use-connector-linux/README.md`
- `items/computer-use-linux/README.md`
