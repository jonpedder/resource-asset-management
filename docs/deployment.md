# Deployment

## Deployed ArcGIS content

The clean 2026-10-28 deployment is recorded in `deployment/deployment-manifest.json`. All items are private unless shared to the Workflow Manager role groups.

1. Hosted feature service: Resources (0), Facilities (1), ResourceRequests (2).
2. Web Map: dark-gray vector basemap with operational resource/facility renderers and popups.
3. Workflow Manager item, five assignable groups, active diagram, one-to-one extended-property table, and active Resource Request template.
4. Static application configuration in `app-config.json` contains identifiers and URLs only—no token or client secret.

## Local use

Serve the repository over HTTP, for example `npx http-server . -p 8000`, then open `http://localhost:8000/`. Direct `file://` use is unsupported.

## GitHub Pages

The `.github/workflows/pages.yml` workflow tests and deploys `main`. Complete the OAuth registration in the ArcGIS portal and set `oauthClientId` in `app-config.json` if an explicit OAuth application is required. Redirect origins are listed in the deployment manifest.

## Verification

Run `npm test`. For Workflow Manager, run `wf-discover.mjs` and a disposable `wf-job.mjs` smoke job. Never retry unknown job creation: query by `resource_request.globalid` first.