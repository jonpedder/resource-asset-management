# Troubleshooting

- **No approval actions:** verify WFMJobId, job existence, matching request GlobalID, and live current step.
- **Submission timeout:** search by request GlobalID before retrying; never create a duplicate job.
- **Status mismatch:** Workflow Manager is authoritative; run reconciliation.
- **Job not found:** mark the request ReconcileRequired and do not open a WebSocket.
