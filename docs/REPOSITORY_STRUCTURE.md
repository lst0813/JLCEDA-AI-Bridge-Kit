# Repository Structure

This repository is organized around a stable JLCEDA read/review workflow.

## Main Path

```text
jlc-agent.cmd
  -> agent/jlc-agent.js
  -> plugin/jlceda-mcp-bridge_v0.0.17.eext
  -> current JLCEDA schematic sheet
```

Use these commands first:

```cmd
jlc-agent.cmd ping
jlc-agent.cmd current
jlc-agent.cmd read
jlc-agent.cmd review
```

## Directory Roles

```text
agent/          Main Node.js agent. Reads source/netlist, generates reports.
plugin/         JLCEDA extension package installed into JLCEDA.
runtime/        Bundled Node.js runtime used by jlc-agent.cmd.
examples/       Read-only RPC argument samples.
examples/write-tests/
                Archived write/edit validation plans and smoke inputs.
reports/latest/
                Latest read/review outputs only.
reports/archive/
                Historical validation outputs and smoke-test evidence.
docs/           User and AI handoff documentation.
scripts/        Lower-level bridge/debug helpers.
node_modules/   Local dependency for the agent runtime.
package.json    Optional npm metadata for dependency clarity.
```

Useful docs:

```text
docs/AGENT_USAGE.md          Command reference.
docs/AI_AGENT_GUIDE.md       Handoff notes for AI/script operators.
docs/AI_CAUTION_NOTES.md     Review evidence and false-positive cautions.
docs/EXPERIMENTAL_EDITS.md   Write/edit validation commands.
docs/PORTABLE_CHECKLIST.md   Copy-to-new-machine checklist.
docs/BINARY_NOTES.md         Bundled runtime and binary notes.
```

## Current Policy

- Treat `read` and `review` as the primary workflow.
- Keep write/edit helpers available but experimental.
- Keep `reports/latest` clean; move old evidence into `reports/archive`.
- Prefer `diagnostics.json` and `summary.md` when checking run status.
- Do not run multiple commands on port `9050` at the same time.

## Latest Report Files

`reports/latest` should normally contain:

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
current.json
```
