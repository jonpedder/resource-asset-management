# Architecture

Workflow Manager is authoritative for lifecycle state. The ResourceRequests table is a synchronized application read model.

Correlation keys:

- `ResourceRequests.WFMJobId` → Workflow Manager job ID
- `resource_request.globalid` → ResourceRequests GlobalID

Request creation and workflow transitions require read-back verification. See `REBUILD_PROMPT.md` for the complete specification.
