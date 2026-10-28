# Consolidated build prompt: EOC Resource & Asset Management

Use this prompt in a new coding session to create a **new Git repository and new ArcGIS deployment from scratch**. Do not clone, repair, or reuse the existing application, feature service, Web Map, Workflow Manager item, job template, diagram, jobs, or hard-coded item IDs. Existing resources may be inspected only as functional reference.

---

## PROMPT START

You are a senior ArcGIS solution architect and web application engineer. Build and deploy a clean, production-ready **EOC Resource & Asset Management** solution consisting of:

1. A new Git repository containing a static ArcGIS Maps SDK for JavaScript web application.
2. A new hosted feature service with resource, facility, and resource-request data.
3. A new Web Map.
4. A new ArcGIS Workflow Manager item, groups/roles, extended properties, workflow diagram, and job template.
5. A fully tested, transactional integration between the resource-request table and Workflow Manager.
6. GitHub Pages deployment and operator documentation.

Do not reuse identifiers from any previous deployment. Provision new items and write all new URLs and IDs into a single configuration file. Never treat an edited status string as equivalent to completing a Workflow Manager step.

## 1. Non-negotiable architecture

Use these principles:

- **Workflow Manager is the workflow authority.** A user moves work by completing the current Workflow Manager step, not by manually editing `RequestStatus` or an extended property.
- The hosted `ResourceRequests` table is the application read model and must stay synchronized with Workflow Manager.
- Every request has exactly one Workflow Manager job.
- Linkage is bidirectional and immutable:
  - `ResourceRequests.WFMJobId` stores the exact Workflow Manager job ID.
  - Workflow extended property `resource_request.globalid` stores the request GlobalID.
- Creating a request is a verified saga/transaction, not independent best-effort writes.
- No approval action may be enabled unless the linked Workflow Manager job exists and its current step is the expected question step.
- No WebSocket should be opened until the job and current step have been verified through REST.
- All Workflow Manager extended-property values must be serialized as strings at the API boundary.
- Never embed ArcGIS tokens. Use OAuth/IdentityManager in the browser and environment-provided credentials in deployment scripts.
- Use ArcGIS Workflow Manager APIs and tested provisioning scripts, not browser automation.
- Reads and deployment verification must be repeatable and produce machine-readable reports.

## 2. New repository

Create a new repository with a clear name such as `eoc-resource-management-v2`. Use `main` as the default branch.

Recommended structure:

```text
/
  index.html                    # Operations Map / inventory / request intake
  approval.html                 # Persona queue and workflow actions
  settings.html                 # Branding, labels, defaults, diagnostic settings
  app-config.example.json       # No environment-specific secrets
  src/
    config.js
    auth-session.js
    request-saga.js
    workflow-client.js
    workflow-state.js
    reconciliation.js
    validation.js
  styles/
  tests/
  deployment/
    feature-service/
    webmap/
    workflow/
    verify/
  docs/
    architecture.md
    deployment.md
    operator-guide.md
    troubleshooting.md
    reset-runbook.md
  .github/workflows/
  README.md
  package.json
```

Use Node 22 or newer for scripts and tests. Use `node:test` or another minimal test runner. Configure GitHub Pages from `main` only after tests pass.

Do not commit vendor files accidentally. Prefer CDN modules or a deliberate `vendor/` directory with licensing documented.

## 3. ArcGIS content to provision

Provision new content in the signed-in ArcGIS organization.

### Hosted feature service

Create one hosted feature service named with a unique deployment suffix. It must contain:

### Layer 0: `Resources` — point layer

Required fields:

- `OBJECTID` — Object ID
- `GlobalID` — Global ID
- `ResourceName` — string, 200
- `NIMS_Category` — string, 100
- `NIMS_Kind` — string, 100
- `TypeClass` — string, 50
- `Quantity` — integer
- `Status` — string, 30; domain values: `Available`, `Committed`, `En Route`, `Out of Service`, `Demobilized`
- `OwningAgency` — string, 150
- `SiteName` — string, 150

### Layer 1: `Facilities` — point layer

Required fields:

- `OBJECTID`
- `GlobalID`
- `SiteName` — string, 150
- `FacilityType` — string, 80
- `Status` — string, 30
- `Capacity` — integer
- `Jurisdiction` — string, 150
- `Contact` — string, 150
- `ContactPhone` — string, 40

### Table 2: `ResourceRequests`

Required fields:

- `OBJECTID`
- `GlobalID`
- `RequestTitle` — string, 200
- `RequestedCategory` — string, 100
- `RequestedKind` — string, 100
- `RequestedType` — string, 50
- `QuantityRequested` — integer
- `Priority` — string, 30
- `Requestor` — string, 150
- `IncidentName` — string, 150
- `DateNeeded` — date
- `RequestStatus` — string, 30
- `ResourceGlobalID` — GUID or string 38, referencing the selected resource
- `Notes` — string, 4000
- `ApprovedBy` — string, 150
- `ApprovedDate` — date
- `ReturnedDate` — date
- `StatusBadge` — string, 50, optional display helper
- `WFMJobId` — string, 100, indexed if supported
- `DenialReason` — string, 4000
- `IntegrationState` — string, 30; domain: `Pending`, `Linked`, `Failed`, `ReconcileRequired`
- `IntegrationError` — string, 2000
- `LastWorkflowSync` — date

`GlobalID`, `WFMJobId`, and Workflow Manager `resource_request.globalid` are the correlation keys. Enforce uniqueness of the relationship in application logic and reconciliation tests.

Create realistic synthetic seed records only. Do not import stale request records or Workflow Manager jobs from the previous solution.

### Web Map

Create a new Web Map containing the `Resources` and `Facilities` layers. Configure:

- A suitable dark basemap.
- Resource symbology by `Status`, with quantity influencing size if practical.
- Facility symbology by `FacilityType`.
- Labels using `ResourceName` and `SiteName` where readable.
- Popups exposing operational fields.
- Initial extent suitable for the deployment’s region, configurable rather than hard-coded.

Store the new Web Map ID in app configuration.

## 4. Workflow Manager provisioning

Create a new Workflow Manager item titled **EOC Resource Request Workflow v2**.

Create or resolve these assignable groups and grant appropriate Workflow Manager roles:

- `EOC — Requestors`
- `EOC — Logistics Section`
- `EOC — Approving Authority`
- `EOC — Operations Section`
- A Workflow Manager administration group

Read every role assignment back after writing it. Fail deployment if a role or assignable-group setting did not persist.

### Extended-property table

Create a one-to-one table named `resource_request`, alias `Resource Request`, with these properties:

- `globalid`: String(38), visible, non-editable
- `request_title`: String(200), visible, non-editable
- `requested_category`: String(100), visible, non-editable
- `requested_kind`: String(100), visible, non-editable
- `requested_type`: String(50), visible, non-editable
- `quantity_requested`: Integer, visible
- `priority`: String(30), visible
- `incident_name`: String(150), visible
- `request_status`: String(30), visible
- `denial_reason`: String(4000), visible

Although definitions can be typed, coerce values to strings when creating or updating jobs because Workflow Manager’s job boundary requires string values.

### Job template

Create an active job template named **Resource Request**:

- Category: `Emergency Management`
- Default name: `RR_[index]`
- Duration: 14 days
- Default status: `Ready`
- Final status: `Closed`
- Initial assignment: `EOC — Logistics Section`
- Associated with the new diagram and `resource_request` table

### Workflow diagram

Create and activate a new diagram titled **EOC Resource Request / Approval v2**. Use stable logical step keys in the deployment spec, but accept that ArcGIS will generate deployment IDs.

Required flow:

1. `Request Submitted`
   - Manual acknowledgement; may auto-start but must be explicitly and reliably completed according to supported Workflow Manager behavior.
   - Assign next step to Logistics.
2. `Logistics Review`
   - Manual.
   - Validate NIMS category/kind/type, quantity, priority, incident, and inventory availability.
   - Assign approval step to Approving Authority.
3. `Approve Request?`
   - Question step with exactly:
     - `Approved`, numeric response `1`
     - `Denied`, numeric response `0`
4. Approved branch:
   - Optional notification to Logistics; if email is not fully configured, use a reliable manual/no-op audit step rather than allowing email to stall the workflow.
   - `Source / Commit Resource` — Logistics manual step.
   - `Mobilize / Dispatch` — Logistics manual step.
   - `Deploy / In Use` — Operations manual step.
   - `Ready to Return?` — question or manual checkpoint.
   - `Demobilize` — Operations/Logistics manual step.
   - `Return & Restock` — Logistics manual step.
   - `Request Closed` — final acknowledgement, then close job.
5. Denied branch:
   - Record denial and denial reason.
   - Optional resubmission decision with an explicit path back to approval.
   - Otherwise close the request/job.

Validate all path expressions, question response values, path assignments, group IDs, `proceedNext`, automatic-step behavior, and the active diagram version. The deployment must fail if a new smoke-test job cannot traverse the expected steps.

## 5. Web application requirements

### `index.html` — Operations Map

Build an accessible responsive command-center interface with:

- Header branding, authenticated ArcGIS user, sign out, Requests, Request Approval, and Settings actions.
- Resource inventory list and map synchronized by selection.
- Search and collapsible multi-select filters for status, NIMS category, kind, and type.
- Resources and facilities from the new Web Map.
- Status symbology and facility-type symbology.
- Resource details including quantity, owner, site, status, and NIMS typing.
- An ICS 213RR-style request form launched from a selected resource.
- Request form fields: title, category, kind, type, quantity, priority, requestor, incident, needed date, notes.
- Requestor defaults to authenticated user where appropriate.
- New requests always begin at `Submitted`; operators must not choose an arbitrary workflow status during creation.
- A requests drawer/list with status and linkage diagnostics.
- Clear success message containing request ObjectID/GlobalID and verified Workflow Manager job ID.

### `approval.html` — workflow queue

Build a queue with:

- Personas: `All Personas`, `Requestor`, `Logistics`, `Approver`, `Operations`.
- Filters for status, needed date, equipment/type, search, and sorting.
- Request detail, linked job ID, current Workflow Manager step, assignment, and audit history.
- Available actions derived from the **live current Workflow Manager step**, not merely `RequestStatus`.
- At `Approve Request?`, display only `Approved` and `Denied` from the live question definition.
- Require a decision note.
- Disable actions and display an immediate diagnostic when:
  - `WFMJobId` is blank,
  - linked job returns not found,
  - request GlobalID and workflow extended property do not match,
  - current step is not the expected step,
  - duplicate jobs exist.
- Do not hide these errors behind a WebSocket timeout.

### `settings.html`

Provide configuration/preview for branding, subtitle, optional logo, labels, colors, and reasonable filter defaults. Persist non-secret UI preferences safely. Environment-specific ArcGIS IDs should come from a deployment-generated config, not operator-editable browser storage.

## 6. Transactional request creation

Implement request submission as this exact verified saga:

1. Disable submit and generate a client correlation ID.
2. Add one `ResourceRequests` row with:
   - `RequestStatus = 'Submitted'`
   - `IntegrationState = 'Pending'`
   - blank `WFMJobId`
3. Read the new row back and obtain `OBJECTID` and `GlobalID`.
4. Before creating a job, search Workflow Manager for `resource_request.globalid = <GlobalID>`.
   - Zero results: continue.
   - One result: reuse it only if the request link is missing and all identifiers match.
   - More than one: stop and set `ReconcileRequired`; never create another.
5. Create exactly one job from the new Resource Request template with all extended properties populated.
6. Read the job back and verify:
   - correct job template,
   - correct diagram,
   - initial current step,
   - `resource_request.globalid` equals request GlobalID.
7. Update the feature row with exact `WFMJobId`, `IntegrationState = 'Linked'`, blank error, and sync timestamp.
8. Read the feature row back and verify `WFMJobId` exactly.
9. Add a Workflow Manager audit comment recording the feature ObjectID, GlobalID, authenticated user, and correlation ID.
10. Report success only after all read-backs pass.

Failure handling:

- If feature creation fails: create no job.
- If job creation fails: keep the request as `Failed`, record a safe error, and offer retry; do not silently claim success.
- If job was created but linking fails: delete the new job if safe; otherwise mark `ReconcileRequired` and show both identifiers.
- Retry must be idempotent and search by GlobalID before job creation.
- Never create a second job merely because a prior call timed out; verify first.

## 7. State synchronization

Define one explicit mapping between Workflow Manager steps and request status:

- Request Submitted → `Submitted`
- Logistics Review → `Under Review`
- Approve Request? → `Under Review`
- Approved notification / Source → `Approved` then `Sourced`
- Mobilize / Dispatch → `En Route`
- Deploy / In Use → `Deployed`
- Demobilize → `Demobilizing`
- Return & Restock → `Returned`
- Closed → `Closed`
- Denied branch → `Denied`

Complete the Workflow Manager step first, verify the resulting current step, and only then update the request read model. If the second write fails, mark `ReconcileRequired`; the reconciler must repair from Workflow Manager as authority.

Do not let users manually change `request_status` in Workflow Manager as a substitute for completing a step.

## 8. Reconciliation and diagnostics

Implement a script and an administrator UI report that identify:

- Requests with blank `WFMJobId`.
- Requests linked to missing/deleted jobs.
- Jobs whose `resource_request.globalid` has no request.
- Multiple jobs for one request GlobalID.
- Multiple requests referencing one job ID.
- Request/job GlobalID mismatch.
- Request status inconsistent with current Workflow Manager step.
- Stale `Pending`, `Failed`, or `ReconcileRequired` records.

Default reconciliation to dry-run. Require an explicit `--apply` for repairs. Never bulk-create jobs for historical requests without a reviewed migration manifest.

Add an admin-only reset script that deletes test jobs by template/name prefix and verifies zero remaining. Never delete all production jobs by default.

## 9. Authentication and security

- Register a new ArcGIS OAuth application for the new GitHub Pages origin and local development origin.
- Use ArcGIS Maps SDK `IdentityManager`.
- Share the feature service, Web Map, Workflow item, templates, and companion items with the correct groups.
- Verify sharing through read-back as a non-admin test user when possible.
- Do not store tokens in files, Git, localStorage, URLs, command lines, or logs.
- HTML must escape all feature and workflow text before rendering.
- Authorization must be enforced by ArcGIS groups/roles, not persona dropdown labels alone.

## 10. Automated tests

Create tests before deployment for:

- Job payload extended-property values are strings.
- Exact extraction and preservation of case-sensitive job IDs.
- Request creation call order and read-back verification.
- Idempotent retry after timeout.
- Duplicate-job prevention.
- Rollback/compensation when linking fails.
- Status mapping from live Workflow Manager steps.
- Approval actions available only at the approval question step.
- Blank/orphaned/mismatched links disable actions immediately.
- Approved and denied question responses use `1` and `0` exactly.
- Required decision note.
- HTML escaping.
- Queue filters and persona ownership.
- Configuration contains no old item IDs or service URLs.

Add deployment integration tests that create a uniquely named smoke-test request/job, traverse:

```text
Request Submitted → Logistics Review → Approve Request?
```

Then test both branches in separate disposable jobs:

- Approved branch through close.
- Denied branch through close or resubmission as designed.

For every step, assert the current step ID/name, assignment, job state, and corresponding request status. Delete smoke-test data afterward and verify cleanup.

## 11. Deployment gates

Do not announce completion until all gates pass:

1. New repository exists and has no references to old ArcGIS IDs.
2. Unit tests pass.
3. Hosted service schemas match the manifest.
4. Web Map loads both operational layers.
5. Workflow groups are assignable and roles persist.
6. Diagram is active and template references its active version.
7. A smoke-test request creates one feature and one linked job.
8. `WFMJobId` and `resource_request.globalid` pass bidirectional read-back.
9. Job advances to approval without manual property edits.
10. Approval from the web app advances the real Workflow Manager question step.
11. Request status synchronizes only after step verification.
12. Approved and denied end-to-end tests pass.
13. Reconciliation reports zero orphan, duplicate, or mismatched records.
14. GitHub Pages loads under the registered OAuth redirect URL.
15. Final test data is removed, leaving a clean deployment.

## 12. Required deliverables

Return:

- New Git repository URL and final commit hash.
- GitHub Pages URLs for Operations Map and Approval.
- New hosted feature-service item ID and URL.
- New Web Map ID.
- New OAuth app/client ID and required redirect URIs (never a secret).
- New Workflow Manager item ID.
- New diagram ID and active version.
- New job-template ID.
- Group names and IDs with role verification.
- Deployment manifest containing new IDs.
- Test report with unit and end-to-end results.
- Reconciliation report showing zero inconsistencies.
- Operator guide and reset/recovery runbook.

## 13. Implementation conduct

- Start by producing an execution plan and proposed names; then provision in dependency order.
- Use idempotent scripts and read every important write back.
- Stop immediately on any failed verification rather than layering repairs over an uncertain state.
- Never create a second job to compensate for an unknown first result; query by request GlobalID first.
- Do not migrate old jobs or requests until the clean system passes every gate.
- Preserve the current operational concept and visual style, but rewrite the integration cleanly.
- Keep a deployment journal of created item IDs so a failed build can be safely torn down.

## PROMPT END

---

## Optional context for the new session

The desired application concept is a dark, FEMA/NIMS-oriented command center with an inventory map, facilities, ICS 213RR request intake, persona-based workflow queues, approval/denial, sourcing, mobilization, deployment, demobilization, return, and closeout. The rebuild must use entirely new ArcGIS items and must not inherit stale records or jobs.
