# AI Agent Guide

This note is for any AI or script that operates this kit.

## Primary Goal

Use the project as a stable JLCEDA schematic read/review tool first. Treat
write/edit commands as experimental validation helpers only.

Preferred flow:

```cmd
jlc-agent.cmd ping
jlc-agent.cmd current
jlc-agent.cmd read --report-dir reports/latest
jlc-agent.cmd review --report-dir reports/latest
```

The useful outputs are:

```text
reports/latest/diagnostics.json
reports/latest/summary.md
reports/latest/risks.md
reports/latest/components.csv
reports/latest/nets.csv
reports/latest/source.schsrc
reports/latest/netlist.json
```

## Connection Model

This is not a normal always-on MCP server.

```text
AI/script
  -> temporary local WebSocket listener on ws://127.0.0.1:9050
  -> jlceda-mcp-bridge extension
  -> active JLCEDA project and schematic sheet
```

Important facts:

- The extension is the WebSocket client.
- The local command listens first, then waits for the extension `hello`.
- Only one command should own port `9050` at a time.
- A command can spend time waiting for the extension reconnect loop even when
  the actual JLCEDA RPC is fast.
- `read` and `review` keep one bridge session open while reading current
  document metadata, source, netlist, and optional DRC data.

## What To Trust

Trust order for schematic review:

1. `diagnostics.json` for run status, failures, timings, and truncation.
2. `netlist.json` / `nets.csv` for electrical connectivity.
3. `source.schsrc` / `components.csv` for schematic object evidence.
4. Tool call success messages last.

Do not infer electrical correctness from visuals alone. A label-looking text
object is not necessarily a real net label, and a visually adjacent wire is not
necessarily electrically connected.

## Active Tab Rule

Before reviewing, the user should focus a schematic sheet in JLCEDA.

If the active tab is a PCB, footprint, library item, or another document type,
`read`/`review` should fail quickly and report that in `diagnostics.json`.
Do not convert that failure into a schematic conclusion.

## Review Scope

Current review is useful for:

- reading source and netlist in one stable pass
- listing components and nets
- spotting empty pins
- spotting single-end named nets
- spotting suspicious net-name variants
- reporting basic DRC availability and errors

It is not yet a full electrical sign-off system. Domain-specific rules still
need to be added for power trees, MCU minimum systems, connectors, isolation,
analog/digital boundaries, and current-source design checks.

## Failure Handling

Common failures:

- Timeout: JLCEDA/extension is closed, URL is wrong, or reconnect has not
  reached the listener yet.
- `EADDRINUSE`: another process is listening on port `9050`.
- Non-schematic document: focus a schematic sheet and rerun.
- Truncated source/netlist: increase `--max-chars` or inspect partial output.

Check port ownership:

```powershell
netstat -ano | findstr :9050
```

## Do Not

- Do not run multiple bridge commands concurrently on port `9050`.
- Do not treat edit/smoke commands as the main workflow.
- Do not claim the whole project is fully reviewed from a single basic pass.
- Do not delete or rewrite generated evidence unless it has been archived.
