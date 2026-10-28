export function inspectLinks(requests, jobs) {
  const jobsById = new Map(jobs.map(job => [job.jobId, job]));
  const jobsByGlobalId = new Map();
  for (const job of jobs) {
    const key = String(job.requestGlobalId || '').toLowerCase();
    if (!key) continue;
    jobsByGlobalId.set(key, [...(jobsByGlobalId.get(key) || []), job]);
  }
  return requests.flatMap(request => {
    const issues = [];
    const key = String(request.GlobalID || '').toLowerCase();
    if (!request.WFMJobId) issues.push('blank-job-id');
    else if (!jobsById.has(request.WFMJobId)) issues.push('missing-job');
    if ((jobsByGlobalId.get(key) || []).length > 1) issues.push('duplicate-jobs');
    return issues.map(issue => ({ issue, objectId: request.OBJECTID, globalId: request.GlobalID, jobId: request.WFMJobId || '' }));
  });
}
