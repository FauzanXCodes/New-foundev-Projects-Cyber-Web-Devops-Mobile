# Example Scenarios

`scenarios.json` contains example workloads that mirror the app's built-in
presets. Each entry has a `name`, a `description`, and a full `workload` object
in the current schema.

## Included scenarios

- **Small development** - one small instance for part-time development work.
- **Portfolio web app** - an always-on small instance with storage, S3 hosting,
  and light egress.
- **Small production app** - redundant compute, a managed database, storage, and
  moderate egress.
- **Data-heavy app** - large compute and database with heavy object storage and
  transfer.

## Using them

- **In the app:** the built-in preset chips load the same configurations
  directly.
- **Import:** copy a single entry's `workload` object into a `.json` file and use
  the app's **Import JSON** action (import accepts a bare workload or a full
  export envelope).
- **Reference:** the file is a compact, accurate example of the workload schema
  described in [../docs/architecture.md](../docs/architecture.md).

Rates shown are the us-east-1 sample assumptions and are editable in the app.
