function arcgisError(result, fallback) {
  if (result?.error) return new Error(result.error.message || fallback);
  return new Error(fallback);
}

export class FeatureServiceClient {
  constructor({ serviceUrl, token, fetchImpl = globalThis.fetch }) {
    this.serviceUrl = String(serviceUrl).replace(/\/$/, '');
    this.token = token;
    this.fetch = fetchImpl.bind(globalThis);
  }

  async post(path, values = {}) {
    const body = new URLSearchParams({ f: 'json', token: this.token, ...values });
    const response = await this.fetch(`${this.serviceUrl}/${String(path).replace(/^\//, '')}`, { method: 'POST', body });
    const result = await response.json();
    if (!response.ok || result.error) throw arcgisError(result, `Feature service request failed (${response.status}).`);
    return result;
  }

  async query(layerId, { where = '1=1', outFields = '*', returnGeometry = true, outSpatialReference } = {}) {
    const result = await this.post(`${layerId}/query`, {
      where,
      outFields,
      returnGeometry: String(returnGeometry),
      ...(outSpatialReference ? { outSR: String(outSpatialReference) } : {})
    });
    return result.features || [];
  }

  async oneByGlobalId(layerId, globalId, options = {}) {
    const escaped = String(globalId || '').replace(/'/g, "''");
    const rows = await this.query(layerId, { ...options, where: `GlobalID='${escaped}'` });
    if (rows.length !== 1) throw new Error(`Expected one feature for GlobalID ${globalId}; found ${rows.length}.`);
    return rows[0];
  }

  async facilities(layerId) {
    return this.query(layerId, { where: "Status IS NULL OR Status <> 'Closed'", outFields: '*', returnGeometry: true, outSpatialReference: 4326 });
  }

  async applyServiceEdits(edits, { rollbackOnFailure = true, useGlobalIds = true } = {}) {
    const result = await this.post('applyEdits', {
      edits: JSON.stringify(edits),
      rollbackOnFailure: String(rollbackOnFailure),
      useGlobalIds: String(useGlobalIds)
    });
    const failures = (result || []).flatMap(group => [
      ...(group.addResults || []), ...(group.updateResults || []), ...(group.deleteResults || [])
    ]).filter(edit => !edit.success);
    if (failures.length) throw new Error(failures[0].error?.description || failures[0].error?.message || 'One or more feature-service edits failed.');
    return result;
  }
}
