export async function createLinkedRequest(options) {
  const correlationId = options.correlationId || globalThis.crypto?.randomUUID?.() || `corr-${Date.now()}`;
  let request;
  let job;
  try {
    request = await options.createRequest({
      ...options.attributes,
      RequestStatus: 'Submitted',
      IntegrationState: 'Pending',
      IntegrationError: '',
      WFMJobId: ''
    });
    if (!request?.OBJECTID || !request?.GlobalID) throw new Error('Request read-back did not return OBJECTID and GlobalID.');
    const existing = await options.findJobsByRequestGlobalId(request.GlobalID);
    if (existing.length > 1) {
      await options.markRequest?.(request.OBJECTID, 'ReconcileRequired', 'Multiple Workflow Manager jobs reference this request.');
      throw new Error('Multiple Workflow Manager jobs reference this request.');
    }
    job = existing[0] || await options.createJob(request, correlationId);
    if (!job?.jobId) throw new Error('Workflow Manager did not return a job ID.');
    await options.verifyJob(job.jobId, request.GlobalID);
    await options.linkRequest(request.OBJECTID, job.jobId);
    await options.verifyRequestLink(request.OBJECTID, job.jobId);
    let auditWarning = '';
    try {
      await options.addAuditComment?.(job.jobId, { objectId: request.OBJECTID, globalId: request.GlobalID, correlationId });
    } catch (error) {
      auditWarning = `The request and workflow job were linked, but the initial audit comment could not be saved: ${error.message || error}`;
    }
    return { request, jobId: job.jobId, correlationId, reusedJob: Boolean(existing[0]), auditWarning };
  } catch (error) {
    if (request?.OBJECTID && !job?.jobId) await options.markRequest?.(request.OBJECTID, 'Failed', String(error.message || error));
    else if (request?.OBJECTID && job?.jobId) {
      const deleted = await options.deleteJobIfSafe?.(job.jobId);
      if (!deleted) await options.markRequest?.(request.OBJECTID, 'ReconcileRequired', String(error.message || error));
    }
    throw error;
  }
}