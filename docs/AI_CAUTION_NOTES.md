# AI Caution Notes

Connection success is not the same thing as schematic correctness.

## Main Principle

Every important conclusion should be backed by readback evidence:

- source readback for objects and attributes
- netlist readback for electrical connectivity
- diagnostics for status, errors, timings, and truncation

## Easy Mistakes

### Text Is Not A Net

Plain text such as `GND`, `+3V3`, or `SWDIO` does not prove electrical
connectivity. Prefer netlist evidence and real net-label/source attributes.

### Nearby Is Not Connected

Two objects that appear visually close may still be electrically separate.
Use netlist endpoints, source objects, or JLCEDA DRC to support the conclusion.

### Tool Success Is Weak Evidence

A tool call can return success while the design is still incomplete or the
active tab was wrong. For read/review work, the report files are the evidence.

### Basic Rules Are Not Sign-Off

The current rules catch common schematic hygiene risks, but they do not replace
engineering review. A design can pass the current basic checks and still have
wrong rails, missing decoupling, bad connector mapping, or unsafe isolation.

## Preferred Review Habit

1. Run `jlc-agent.cmd review --report-dir reports/latest`.
2. Open `reports/latest/diagnostics.json`.
3. Confirm `status`, `documentKind`, source/netlist lengths, and truncation.
4. Read `summary.md` and `risks.md`.
5. Use `components.csv` and `nets.csv` when checking details.

## Edit Warning

Write/edit helpers are kept only for controlled experiments. If any edit is
used, verify with a fresh `read` or `review` run before drawing conclusions.
