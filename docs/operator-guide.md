# Operator guide

## Operations Map

Sign in, filter the inventory, select a resource, and choose **Create ICS 213RR request**. New requests always start as `Submitted`. Success is shown only after the request row and Workflow Manager job link are read back and verified.

## Approval queue

The queue shows the ResourceRequests read model. Workflow actions are valid only when the linked job exists, its `resource_request.globalid` matches the request GlobalID, and the live current step is expected. At **Approve Request?**, use response `1` for Approved or `0` for Denied and enter a decision note.

## Authority and recovery

Workflow Manager is authoritative. Never edit `RequestStatus` to simulate completing a step. If a workflow step completes but the request row fails to synchronize, set `IntegrationState=ReconcileRequired` and repair the read model from the live job.

## Personas

Persona filters are convenience views, not authorization. ArcGIS group membership and Workflow Manager roles enforce access.