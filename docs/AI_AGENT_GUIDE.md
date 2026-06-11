# AI Agent 接手说明

这份文档给后续接手的 AI 或脚本看。

## 首要目标

先把这个项目当成稳定的嘉立创原理图读图/审图工具。写图/改图命令只作为实验性
验证助手，不是主流程。

推荐流程：

```cmd
jlc-agent.cmd ping
jlc-agent.cmd current
jlc-agent.cmd read --report-dir reports/latest
jlc-agent.cmd review --report-dir reports/latest
```

优先查看这些输出：

```text
reports/latest/diagnostics.json
reports/latest/summary.md
reports/latest/risks.md
reports/latest/components.csv
reports/latest/nets.csv
reports/latest/source.schsrc
reports/latest/netlist.json
```

## 连接模型

这不是一个常驻 MCP Server。

```text
AI/脚本
  -> 临时本地 WebSocket 监听器 ws://127.0.0.1:9050
  -> jlceda-mcp-bridge 扩展
  -> 当前嘉立创工程和原理图页面
```

关键点：

- 嘉立创扩展是 WebSocket client。
- 本地命令要先监听，再等待扩展发送 `hello`。
- 同一时间只能有一个命令占用 `9050`。
- 命令总耗时可能主要花在等待扩展重连上，真正的 JLCEDA RPC 可能很快。
- `read` 和 `review` 会在同一个连接里读取 current、source、netlist 和可选 DRC。

## 证据优先级

审图时按下面顺序信任证据：

1. `diagnostics.json`：运行状态、失败原因、耗时、截断情况。
2. `netlist.json` / `nets.csv`：电气网络连接。
3. `source.schsrc` / `components.csv`：原理图对象和属性。
4. 工具调用返回 success：只能作为弱证据。

不要只凭视觉判断电气连接。看起来像网络标签的普通文字，不一定是真实 net label；
看起来贴近引脚的线，也不一定真的接入了网络。

## 当前页面规则

审图前必须让嘉立创焦点停在原理图页面。

如果当前页面是 PCB、封装、库文件或其他类型，`read` / `review` 应该快速失败，并在
`diagnostics.json` 里写明原因。不要把这种失败解释成原理图结论。

## 当前审图能力

现在的审图适合做：

- 一次稳定读取 source 和 netlist
- 列出组件和网络
- 标出空引脚
- 标出单端命名网络
- 标出疑似拼写错误或相近网络名
- 报告基础 DRC 调用状态和错误

它还不是完整电气签核系统。后续还需要增加电源树、MCU 最小系统、连接器一致性、
隔离地/模拟地/数字地、恒流源领域规则等检查。

## 常见失败

- 超时：嘉立创或扩展没开、URL 错误，或扩展还没重连到本地监听器。
- `EADDRINUSE`：另一个进程占用了 `9050`。
- 非原理图页面：切回原理图后重跑。
- source/netlist 被截断：提高 `--max-chars`，或人工检查部分输出。

检查端口：

```powershell
netstat -ano | findstr :9050
```

## 不要做

- 不要并发运行多个桥接命令。
- 不要把 edit/smoke 当成主工作流。
- 不要根据一次基础审图就宣称整个项目已完整验证。
- 不要删除或覆盖生成证据，除非已经归档。
