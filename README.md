# JLCEDA AI Bridge Kit

这是一个把本地 AI/脚本连接到嘉立创 EDA 的便携工具包，核心插件是
`jlceda-mcp-bridge`。

它不是标准 MCP Server。嘉立创扩展本身是 WebSocket client，本地命令会临时
监听 `ws://127.0.0.1:9050`，等扩展连进来并发送 `hello` 后，再发起 RPC 风格
请求。

```text
AI/脚本 -> 本地 WebSocket 监听器 -> 嘉立创扩展 -> 当前工程/原理图
```

## 当前目标

这个仓库现在优先做成一个稳定的嘉立创读图/审图 Agent：

- 读取当前原理图 source 和 netlist
- 生成结构化审图报告
- 标记基础原理图风险
- 保留小步改图工具，但只作为实验/验证能力

它目前不是“全自动画完整原理图”的系统，也不应该把一次基础检查当成完整电气
签核。

## 推荐入口

日常优先使用：

```cmd
jlc-agent.cmd ping
jlc-agent.cmd tools
jlc-agent.cmd current
jlc-agent.cmd read
jlc-agent.cmd review
```

旧入口仍然保留，用于兼容：

```cmd
ping.cmd
list-tools.cmd
get-source.cmd
call-tool.cmd
```

这些旧入口会转到 `jlc-agent.cmd`。

## 安装和连接

1. 安装并打开嘉立创 EDA 专业版或目标私有化版本。
2. 导入扩展：

   ```text
   plugin/jlceda-mcp-bridge_v0.0.17.eext
   ```

3. 启用扩展，并允许外部访问/外部交互权限。
4. 把扩展 WebSocket URL 设置为：

   ```text
   ws://127.0.0.1:9050
   ```

5. 打开工程，并切到原理图页面。
6. 在本目录运行：

   ```cmd
   jlc-agent.cmd ping
   jlc-agent.cmd review
   ```

## 生成报告

`jlc-agent.cmd read` 和 `jlc-agent.cmd review` 默认会写入
`reports/latest`：

```text
summary.md
risks.md
connectors.md
components.csv
nets.csv
source.schsrc
source-info.json
netlist.json
drc.json
diagnostics.json
```

其中 `diagnostics.json` 最重要，记录本次读取是否成功、每一步耗时、source/netlist
是否截断，以及桥接或嘉立创返回的错误。

如果当前焦点不是原理图页面，`read` / `review` 会快速失败并写明原因，避免把
PCB、封装或其他页面误当成原理图来分析。

## 仓库结构

```text
agent/          主要 Node.js Agent，负责读图、解析和生成报告
plugin/         嘉立创扩展安装包
runtime/        便携 Node.js 运行时
examples/       只读 RPC 参数样例
examples/write-tests/
                实验性写图/改图验证样例
reports/latest/
                最近一次读图/审图输出
reports/archive/
                历史验证和烟测证据归档
docs/           使用说明和交接文档
scripts/        底层桥接/调试脚本
package.json    依赖和脚本说明
```

## 实验性改图

小步改图工具仍然保留，但不是主线能力。相关样例在
`examples/write-tests/`，说明见：

```text
docs/EXPERIMENTAL_EDITS.md
```

## 重要注意事项

- 同一时间只能有一个命令监听 `9050`。
- 扩展显示 `connecting` 不一定是异常；本地命令没有监听时，它本来就连不上。
- 刚跑完一个命令后如果下一个命令超时，等几秒再重试。
- 原理图检查优先使用 `read` / `review`，它们会在同一个连接里读取 current、
  source、netlist、diagnostics 和可选 DRC。
- 工具返回 success 不代表电气正确，最终以 source/netlist 回读为准。
- `websocat.exe`、`call-tool.ps1`、`list-tools.ps1`、`test-ping.ps1` 是旧调试
  备用入口，日常使用走 `jlc-agent.cmd`。

更多说明：

```text
docs/AGENT_USAGE.md
docs/REPOSITORY_STRUCTURE.md
docs/AI_AGENT_GUIDE.md
docs/AI_CAUTION_NOTES.md
docs/EXPERIMENTAL_EDITS.md
docs/PORTABLE_CHECKLIST.md
```
