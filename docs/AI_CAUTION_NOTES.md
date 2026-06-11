# AI 审图注意事项

连接成功不等于原理图正确。

## 核心原则

任何重要结论都应该有回读证据支撑：

- 用 source 回读确认对象和属性。
- 用 netlist 回读确认电气连接。
- 用 diagnostics 确认状态、错误、耗时和截断情况。

## 容易误判的地方

### 普通文字不是网络

图上写着 `GND`、`+3V3`、`SWDIO`，不代表它一定参与电气连接。优先看 netlist，
以及 source 里真实的网络标签/网络属性。

### 视觉贴近不代表连接

两段图形看起来贴得很近，电气上也可能是断开的。要用 netlist endpoints、
source 对象或嘉立创 DRC 来支撑判断。

### success 是弱证据

工具返回 success 只能说明调用层面没有直接失败，不能说明原理图已经正确。读图/审图
时，报告文件才是证据。

### 基础规则不是签核

当前规则能抓一些常见原理图卫生问题，但不能替代工程审查。即使基础规则没有报错，
仍可能存在电源轨错误、去耦缺失、连接器映射错误、隔离不安全等问题。

## 推荐审图习惯

1. 运行 `jlc-agent.cmd review --report-dir reports/latest`。
2. 先打开 `reports/latest/diagnostics.json`。
3. 确认 `status`、source/netlist 长度、是否截断、是否有 errors。
4. 再看 `summary.md` 和 `risks.md`。
5. 需要细查时，用 `components.csv` 和 `nets.csv`。

## 改图提醒

写图/改图工具只保留给受控实验。任何写入之后，都要重新跑一次 `read` 或 `review`，
用回读结果确认。
