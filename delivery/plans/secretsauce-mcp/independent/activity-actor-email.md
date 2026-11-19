# Activity actor email

Base revision `26ad775`. Users investigating Activity need the human account email beside the recorded actor ID.

## Slice 1

Resolve local human actor IDs against current accounts after authorized event selection. Sanitize the current email with the existing evidence sanitizer and show it alongside the original ID in shared main and per-service Activity. An unrecognized actor or imported event keeps its original actor ID. Use a view-only field so downloads, retained data and filter behavior keep their existing contract.

Own Activity query/detail presentation, the evidence tests and the existing M46 browser scenario. Verify known, unknown, imported and Member-scoped rows, unchanged download contents, and the displayed email plus ID in the HTTPS browser. Build and publish one commit.

## Result

Build, all 17 focused evidence tests, and the M46 HTTPS browser scenario passed. The browser showed the account email beside the recorded ID on service Activity.
