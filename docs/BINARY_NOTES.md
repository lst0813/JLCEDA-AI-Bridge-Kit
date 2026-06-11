# 二进制文件说明

这个工具包内置了少量二进制文件和第三方依赖，目的是在干净的 Windows 电脑上也能
直接运行，不必额外安装 Node.js。

## 已包含文件

```text
plugin/jlceda-mcp-bridge_v0.0.17.eext
runtime/node.exe
websocat.exe
node_modules/ws/
```

作用说明：

- `plugin/jlceda-mcp-bridge_v0.0.17.eext`：嘉立创扩展安装包。
- `runtime/node.exe`：`jlc-agent.cmd` 默认使用的便携 Node.js 运行时。
- `websocat.exe`：早期调试用 WebSocket 工具，现在只是备用。
- `node_modules/ws/`：Node Agent 使用的 WebSocket 库。

## 注意事项

- `runtime/node.exe` 体积较大，这是便携运行时的正常情况。
- `websocat.exe` 不属于推荐日常流程，只在调试时备用。
- `node_modules/ws` 保留自己的 MIT license 文件。
- 如果要严格公开发布，可以考虑把大二进制文件放到 GitHub Release assets，而不是
  长期放在仓库历史里。
