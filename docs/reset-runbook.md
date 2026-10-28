# Reset runbook

Reset scripts must default to dry-run and target disposable jobs by an explicit test prefix. Never delete all production jobs by default.

After cleanup, verify no matching test jobs or test requests remain.
