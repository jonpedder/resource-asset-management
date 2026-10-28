export async function createLinkedRequest(options) {
  const request = await options.createRequest({
    ...options.attributes,
    RequestStatus: 'Submitted',
    IntegrationState: 'Pending',
    WFMJobId: ''
  });
  const existing = await options.findJobsByRequestGlobalId(request.GlobalID);
  if (existing.length > 1) throw new Error('Multiple Workflow Manager jobs reference this request.');
  const job = existing[0] || await options.createJob(request);
  await options.verifyJob(job.jobId, request.GlobalID);
  await options.linkRequest(request.OBJECTID, job.jobId);
  await options.verifyRequestLink(request.OBJECTID, job.jobId);
  return { request, jobId: job.jobId };
}
