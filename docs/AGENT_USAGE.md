# JLCEDA Agent 使用说明

本项目推荐统一从 `jlc-agent.cmd` 进入：

```cmd
jlc-agent.cmd ping
jlc-agent.cmd tools
jlc-agent.cmd current
jlc-agent.cmd read
jlc-agent.cmd review
```

旧的 `ping.cmd`、`list-tools.cmd`、`get-source.cmd`、`call-tool.cmd` 仍然保留，
但它们只是兼容包装，最终会转到 `jlc-agent.cmd`。

## 主要命令

检查桥接是否能连通：

```cmd
jlc-agent.cmd ping
```

列出扩展暴露的工具：

```cmd
jlc-agent.cmd tools
```

读取当前原理图并生成结构化报告：

```cmd
jlc-agent.cmd read --report-dir reports/latest
```

运行基础审图规则和 DRC 状态检查：

```cmd
jlc-agent.cmd review --report-dir reports/latest
```

直接调用扩展 RPC：

```cmd
jlc-agent.cmd rpc --method getDocumentSource --args-file examples/source-fast.json
jlc-agent.cmd rpc --method schematic.getNetlist --args-file examples/netlist-fast.json
```

## 报告文件

常用输出包括：

```text
reports/latest/summary.md
reports/latest/risks.md
reports/latest/connectors.md
reports/latest/components.csv
reports/latest/nets.csv
reports/latest/source.schsrc
reports/latest/netlist.json
reports/latest/diagnostics.json
```

`read` 和 `review` 是主流程。它们会保持同一个桥接会话，连续读取 current、
source、netlist、diagnostics，并在失败时也尽量写出 `diagnostics.json`。

如果嘉立创当前焦点是 PCB、封装、库文件或其他非原理图页面，命令会返回
`status: "failed"`，提示你切回原理图，而不是生成误导性的报告。

## 速度说明

- 不要同时运行多个占用 `9050` 的命令。
- 扩展是 WebSocket client，本地命令是临时 server。
- `source`、`netlist`、`read`、`review` 会尽量使用直接 RPC，例如
  `getDocumentSource` 和 `schematic.getNetlist`，避免 `tools.call` 里重复的
  `data + toolResult` payload。
- 第一次冷启动可能慢在扩展重连等待；一旦扩展连上，source/netlist 读取通常是
  毫秒级。
- 命令总耗时才是用户体感速度；`diagnostics.timings` 记录的是扩展连上之后各
  读图步骤的耗时。

## JSON 参数

复杂参数优先写到 JSON 文件里：

```cmd
jlc-agent.cmd call --tool jlc.schematic.verify_netlist --args-file args.json
```

很小的参数也可以直接内联：

```cmd
jlc-agent.cmd call --tool jlc.bridge.ping --args-json "{}"
```

## 实验性小步改图

改图相关能力保留用于验证，但不是当前主线。详细说明见：

```text
docs/EXPERIMENTAL_EDITS.md
```

## 旧调试文件

`websocat.exe`、`call-tool.ps1`、`list-tools.ps1`、`test-ping.ps1` 是旧调试
备用入口。日常使用优先走 `jlc-agent.cmd`。
