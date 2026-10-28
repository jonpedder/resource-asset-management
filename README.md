# Resource & Asset Management

Clean rebuild of an ArcGIS EOC Resource & Asset Management solution with Workflow Manager integration.

## Status

Initial repository scaffold only. ArcGIS items have not been provisioned.

## Components

- Operations Map and resource-request intake
- Resource approval and lifecycle queue
- Hosted Resources, Facilities, and ResourceRequests data
- ArcGIS Workflow Manager request lifecycle
- Transactional request/job linkage and reconciliation

## Start

1. Copy `app-config.example.json` to `app-config.json` after provisioning new ArcGIS items.
2. Follow `docs/REBUILD_PROMPT.md` for the complete build specification.
3. Run `npm test` before deployment.

## Local development

Serve the repository through a local HTTP server. Do not open HTML files directly from disk because ArcGIS OAuth redirect handling requires an HTTP origin.

## Security

Never commit tokens, client secrets, generated credentials, or `app-config.json` containing environment-specific private settings.
