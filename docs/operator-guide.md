# Operator guide

## Operations workspace

Sign in, then use **Resources** and **Facilities** in the inventory pane.

- **Resource Report** downloads a mapped PDF with staging-hub, resource-kind, and NIMS typing totals.
- **Request Queue** opens the read-only request drawer; its badge shows the loaded request count.
- **Request Approval** opens the workflow-authoritative queue.
- Search and filter Resources by status, NIMS category, kind, or type. **Clear filters** removes checked filters.
- Search Facilities by name, type, or location and filter by Open, Standby, Limited Operations, Full, Evacuating, Closed, Out of Service, or an additional status found in the data.
- Selecting an item highlights and zooms to it. Selecting a Resource also opens the request form.
- Home restores extent; Layers changes visibility; Basemap changes context; Bookmarks opens saved extents; Legend explains resources, facilities, and movement paths.

## Submit a resource request

Select a Resource, review the prefilled asset information, and enter the title, incident, priority, quantity, date needed, and notes.

- **Cancel** or the request-pane **X** clears the selection and form.
- **Submit Asset Request** validates the form, creates the request, creates or reuses one Workflow Manager job, verifies `resource_request.globalid`, saves `WFMJobId`, and reads the link back.
- A request is workflow-ready only when `IntegrationState=Linked` and `WFMJobId` is populated.

## Request Approval workspace

- **Refresh queue** reloads requests and live workflow state.
- Search and filter by request status, dates, equipment, next step, or authorized persona. The arrow beside Authorized Persona toggles newest-first and oldest-first sorting.
- Select a request to verify its link and load its timeline.
- **Incident information & audit history** shows fields and events. **Resource movement map** shows the resource, facilities, and curved movement paths.
- **Export CSV** downloads request metadata and audit events. **Export PDF** downloads the branded audit report and movement map.
- For movement steps, choose a facility or enter a location. **Locate address** geocodes an address or reverse-geocodes coordinates. **Use home/staging location** restores the resource's recorded home location.
- Select an action, enter the required note, then select **Complete selected action**.
- **Contact requestor** opens a prepared email with request details and the signed-in user's signature.

Workflow actions are enabled only when the linked job exists, its request GlobalID matches, and the current live step is supported.

## Workflow lifecycle

### Approved branch

1. Request Submitted — Logistics
2. Logistics Review — Logistics
3. Approve Request? — Approving Authority
4. Source / Commit Resource — Logistics
5. Notify Ready to Deploy — Logistics
6. Mobilize / Dispatch — Logistics
7. Deploy / In Use — Operations
8. Ready to Return? — Operations; Remain Deployed loops to Deploy / In Use
9. Demobilize — Operations
10. Return & Restock — Logistics
11. Notify Resource Returned — Logistics
12. Request Closed — Workflow Administrator

### Denied branch

1. Record Denial — Approving Authority
2. Notify Request Denied — Approving Authority
3. Resubmit Request? — Requestor; Resubmit returns to Logistics Review and Close proceeds to Request Closed

## Reports and exports

- **Resource Report PDF:** current map, regional staging-hub totals, resource-kind totals, and NIMS category/kind/type totals.
- **Audit History CSV:** spreadsheet-ready selected-request metadata and Workflow Manager audit events.
- **Audit History PDF:** selected request, movement map, workflow history, comments, personas, page numbers, and generation details.
- **Help PDF:** complete branded Help & How-to guide with current interface illustrations and report samples.

PDFs use the configured agency name, subtitle, colors, and logo, with an EOC fallback mark. They download directly without a print dialog.

## Settings and Help

Use the cog beside Sign in or Sign out.

- **Preview logo** previews the entered HTTPS URL; a selected upload is previewed automatically.
- **Use default logo** clears the custom logo choice.
- **Save & reload** validates and stores browser-local overrides, then reloads.
- **Reset to defaults** removes browser-local overrides and restores deployment values.
- **Download help PDF** creates the branded, paginated operator guide.

Workflow identifiers are deployment-controlled and read-only.

## Authority and recovery

Workflow Manager is authoritative. Never edit `RequestStatus` to simulate completing a step. If a request has no `WFMJobId`, or its `IntegrationState` is `Failed` or `ReconcileRequired`, review `IntegrationError` and reconcile from the live job rather than fabricating a link.

Persona filters are convenience views, not authorization. ArcGIS group membership and Workflow Manager roles enforce access.
