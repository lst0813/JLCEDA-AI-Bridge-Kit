# Experimental Edits

The project focus is stable schematic read/review. The commands below remain
available only for controlled write validation.

## Dry Run First

```cmd
jlc-agent.cmd edit --file examples/write-tests/edit-plan-wire.json
```

Apply only after checking the dry-run output:

```cmd
jlc-agent.cmd edit --file examples/write-tests/edit-plan-wire.json --apply
```

## Allowed Edit Tools

The edit command only allows this small whitelist:

```text
jlc.schematic.wire.create
jlc.schematic.netlabel.attach_pin
jlc.schematic.connect_pins
jlc.schematic.place_device
jlc.schematic.select
jlc.schematic.clear_selection
jlc.schematic.save
```

## Smoke Tests

```cmd
jlc-agent.cmd smoke-fast --find R_AI_TEST3
jlc-agent.cmd smoke-fast --designator R_AI_FAST_0611B --apply
```

Without `--apply`, `smoke-fast` only reads the schematic and optionally finds
an existing designator. With `--apply`, it places one non-BOM/non-PCB 0603
resistor and verifies the result from source readback.

Important result fields:

```text
verified
timings
sourceVerification.componentExists
sourceVerification.designatorMatches
sourceVerification.nameMatches
sourceVerification.bomDisabled
sourceVerification.pcbDisabled
```

## Evidence Rule

Do not treat a tool response alone as proof of a good edit. Always run a fresh
`jlc-agent.cmd read` or `jlc-agent.cmd review` after applying changes.
