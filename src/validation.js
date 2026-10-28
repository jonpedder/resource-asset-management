export function assertLinkedRequest(request, job) {
  if (!request?.WFMJobId) throw new Error('Request has no linked Workflow Manager job.');
  if (!job?.jobId) throw new Error('Linked Workflow Manager job was not found.');
  if (request.WFMJobId !== job.jobId) throw new Error('Request and Workflow Manager job IDs do not match.');
  const globalId = job.requestGlobalId;
  if (!globalId || String(globalId).toLowerCase() !== String(request.GlobalID).toLowerCase()) {
    throw new Error('Request GlobalID does not match the Workflow Manager correlation property.');
  }
  return true;
}
