export class WorkflowClient {
  constructor({ baseUrl, getToken, fetchImpl = fetch }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.getToken = getToken;
    this.fetch = fetchImpl;
  }

  async call(path, { method = 'GET', body } = {}) {
    const token = await this.getToken();
    const response = await this.fetch(`${this.baseUrl}/${String(path).replace(/^\//, '')}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok || result.error) throw new Error(result.error?.message || result.message || `Workflow Manager request failed (${response.status}).`);
    return result;
  }
}
