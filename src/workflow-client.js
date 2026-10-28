function stringsOnly(values = {}) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value === null || value === undefined ? '' : String(value)]));
}

export function workflowBaseUrl(config) {
  if (config.workflow?.baseUrl) return String(config.workflow.baseUrl).replace(/\/$/, '');
  if (!config.workflow?.orgId || !config.workflow?.itemId) throw new Error('Workflow configuration is incomplete.');
  return `https://workflow.arcgis.com/${encodeURIComponent(config.workflow.orgId)}/${encodeURIComponent(config.workflow.itemId)}`;
}

export function jobExtendedProperty(job, qualifiedName) {
  const direct = job?.extendedProperties?.[qualifiedName];
  if (direct !== undefined) return direct;
  const rows = Array.isArray(job?.extendedProperties) ? job.extendedProperties : job?.extendedProperties?.properties || job?.properties || [];
  const found = rows.find(row => `${row.tableName || row.table || ''}.${row.propertyName || row.name || ''}`.replace(/^\./, '') === qualifiedName || row.name === qualifiedName);
  return found?.value;
}

export class WorkflowClient {
  constructor({ baseUrl, getToken, fetchImpl = fetch }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.getToken = getToken;
    this.fetch = fetchImpl;
  }

  async call(path, { method = 'GET', body } = {}) {
    const token = await this.getToken();
    if (!token) throw new Error('An authenticated ArcGIS user session is required.');
    const response = await this.fetch(`${this.baseUrl}/${String(path).replace(/^\//, '')}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const contentType = response.headers.get('content-type') || '';
    const result = contentType.includes('json') ? await response.json() : { message: await response.text() };
    if (!response.ok || result.error) throw new Error(result.error?.message || result.message || `Workflow Manager request failed (${response.status}).`);
    return result;
  }

  getJob(jobId) { return this.call(`jobs/${encodeURIComponent(jobId)}`); }

  async findJobsByExtendedProperty(name, value) {
    const result = await this.call('jobs/search', { method: 'POST', body: { q: `${name} = "${String(value).replace(/["\\]/g, '\\$&')}"`, search: name, value: String(value) } });
    return result.jobs || result.results || result.items || [];
  }

  async createJob(jobTemplateId, options = {}) {
    const properties = stringsOnly(options.extendedProperties);
    const body = { jobTemplateId, numberOfJobs: 1, jobName: String(options.name || 'Resource Request'), extendedProperties: properties };
    const result = await this.call('jobs', { method: 'POST', body });
    const job = result.jobs?.[0] || result.job || result;
    const jobId = job.jobId || job.id || result.jobIds?.[0];
    if (!jobId) throw new Error('Workflow Manager did not return a job ID.');
    return { ...job, jobId };
  }

  addComment(jobId, comment) { return this.call(`jobs/${encodeURIComponent(jobId)}/comments`, { method: 'POST', body: { comment: String(comment) } }); }

  completeStep(jobId, stepId, response, note) {
    return this.call(`jobs/${encodeURIComponent(jobId)}/action`, { method: 'POST', body: { type: 'Complete', stepId, response, comments: String(note) } });
  }
}
