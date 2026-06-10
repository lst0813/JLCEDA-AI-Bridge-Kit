# Binary Notes

这个工具包为了方便迁移，直接包含了几个二进制/第三方文件。

## 已包含文件

- `plugin/jlceda-mcp-bridge_v0.0.17.eext`
  - 嘉立创 EDA 专业版插件包。
  - 用途：让嘉立创通过 WebSocket 连接本地脚本。
- `runtime/node.exe`
  - 便携 Node.js 运行时。
  - 用途：不依赖目标电脑预装 Node.js。
  - 注意：文件约 87 MB，GitHub 会提示大文件 warning，但低于 100 MB 硬限制。
- `websocat.exe`
  - 备用 WebSocket 工具。
  - 用途：早期测试和应急调试。
- `node_modules/ws`
  - Node WebSocket 库。
  - 许可证：MIT，仓库内保留了 `node_modules/ws/LICENSE`。

## 风险和建议

- 如果目标是严格发布，建议把大文件放到 GitHub Release 资产里，而不是长期放 Git 仓库历史中。
- 如果目标电脑的杀软或 SmartScreen 拦截 `runtime/node.exe`，可以删除 `runtime/node.exe`，改为在目标电脑安装官方 Node.js。
- 插件版本和嘉立创 EDA 版本可能存在兼容性变化。遇到异常时，先确认插件版本、权限和 WebSocket URL。
