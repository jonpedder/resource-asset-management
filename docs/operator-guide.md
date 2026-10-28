# Operator guide

## Operations workspace

Sign in, then use the **Resources** and **Facilities** tabs in the left inventory pane. Resources open first.

- Search and filter Resources by status, NIMS category, kind, or type.
- Search Facilities by name, type, or location.
- Selecting either inventory item highlights it and zooms the map at the configured selection scale.
- Selecting a Resource also opens the request form in the right pane. Facility selection remains map-focused.

The map uses the secured Web Map's symbology, labels, visibility ranges, pop-ups, and legend. Use Home, Layers, Basemap, Bookmarks, and Legend for map navigation.

## Submit a resource request

Select a Resource and complete the embedded request pane. Review the prefilled asset information, then enter the title, incident, priority, quantity, date needed, and notes or justification.

Select **Submit Asset Request**. The app creates the request record, creates or reuses exactly one Workflow Manager job, verifies `resource_request.globalid`, saves the `WFMJobId`, and reads the link back. A request is workflow-ready only when `IntegrationState=Linked` and `WFMJobId` is populated.

## Request Approval workspace

Search and filter by request status, needed dates, equipment, next step, or authorized persona. Select a request to see its details, timeline, current assignment, required persona, and audit history.

Workflow actions are enabled only when the linked job exists, its `resource_request.globalid` matches the request GlobalID, and the live current step is supported. Every action requires an operational or decision note.

## Workflow lifecycle

### Approved branch

1. Request Submitted — Logistics
2. Logistics Review — Logistics
3. Approve Request? — Approving Authority
4. Source / Commit Resource — Logistics
5. Notify Ready to Deploy — Logistics
6. Mobilize / Dispatch — Logistics
7. Deploy / In Use — Operations
8. Ready to Return? — Operations; Remain Deployed loops back to Deploy / In Use
9. Demobilize — Operations
10. Return & Restock — Logistics
11. Notify Resource Returned — Logistics
12. Request Closed — Workflow Administrator

### Denied branch

1. Record Denial — Approving Authority
2. Notify Request Denied — Approving Authority
3. Resubmit Request? — Requestor; Resubmit returns to Logistics Review, while Close proceeds to Request Closed

## Audit, contact, and reports

- **Contact requestor** creates an email containing request details and the signed-in user's signature.
- **Export CSV** downloads request metadata and Workflow Manager audit events.
- **Export PDF** under Audit History directly downloads a branded, paginated audit report.
- **Export request PDF** directly downloads a branded, paginated request report.
- Reports use the configured agency name, subtitle, colors, and logo, with an EOC fallback mark.

## Settings and Help

Use the cog immediately to the right of Sign out. Browser-local settings control branding, logo, labels, colors, layer visibility, and resource selection zoom scale. Workflow identifiers are deployment-controlled and read-only.

## Authority and recovery

Workflow Manager is authoritative. Never edit `RequestStatus` to simulate completing a step. If a request has no `WFMJobId`, or its `IntegrationState` is `Failed` or `ReconcileRequired`, review `IntegrationError` and reconcile it from the live job rather than fabricating a link.

## Personas

Persona filters are convenience views, not authorization. ArcGIS group membership and Workflow Manager roles enforce access.
