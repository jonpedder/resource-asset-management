function stringsOnly(values = {}) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value === null || value === undefined ? '' : String(value)]));
}

export function workflowBaseUrl(config) {
  if (config.workflow?.baseUrl) return String(config.workflow.baseUrl).replace(/\/$/, '');
  if (!config.workflow?.orgId || !config.workflow?.itemId) throw new Error('Workflow configuration is incomplete.');
  return `https://workflow.arcgis.com/${encodeURIComponent(config.workflow.orgId)}/${encodeURIComponent(config.workflow.itemId)}`;
}

function extendedPropertyRows(job) {
  const tables = Array.isArray(job?.extendedProperties) ? job.extendedProperties : [];
  return tables.flatMap(table => {
    const tableName = table.tableName || table.table || '';
    const rows = table.entries || table.properties || [];
    return Array.isArray(rows) ? rows.map(row => ({ ...row, tableName: row.tableName || tableName })) : [];
  });
}

export function jobExtendedProperty(job, qualifiedName) {
  const direct = !Array.isArray(job?.extendedProperties) ? job?.extendedProperties?.[qualifiedName] : undefined;
  if (direct !== undefined) return direct;
  const topLevelRows = Array.isArray(job?.properties) ? job.properties : [];
  const found = [...extendedPropertyRows(job), ...topLevelRows].find(row => {
    const name = row.propertyName || row.name || row.identifier || '';
    const qualified = name.includes('.') ? name : `${row.tableName || row.table || ''}.${name}`.replace(/^\./, '');
    return qualified === qualifiedName || name === qualifiedName;
  });
  return found?.value;
}

function assertStepAction(result, action) {
  const refused = (result?.stepResponses || []).find(response => response.status && response.status !== 'Success');
  if (refused) throw new Error(`${action} was refused: ${refused.statusDescription || refused.status}.`);
  if (result?.success === false) throw new Error(`${action} was not accepted by Workflow Manager.`);
  return result;
}

export class WorkflowClient {
  constructor({ baseUrl, getToken, getUsername = async () => '', fetchImpl = globalThis.fetch, WebSocketImpl = globalThis.WebSocket }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.getToken = getToken;
    this.getUsername = getUsername;
    this.fetch = fetchImpl.bind(globalThis);
    this.WebSocketImpl = WebSocketImpl;
  }

  async call(path, { method = 'GET', body } = {}) {
    const token = await this.getToken();
    if (!token) throw new Error('An authenticated ArcGIS user session is required.');
    const response = await this.fetch(`${this.baseUrl}/${String(path).replace(/^\//, '')}`, {
      method,
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const contentType = response.headers.get('content-type') || '';
    const result = contentType.includes('json') ? await response.json() : { message: await response.text() };
    if (!response.ok || result.error) throw new Error(result.error?.message || result.message || `Workflow Manager request failed (${response.status}).`);
    return result;
  }

  getJob(jobId) { return this.call(`jobs/${encodeURIComponent(jobId)}?extProps=true`); }

  async findJobsByExtendedProperty(name, value) {
    const escaped=String(value).replace(/'/g,"''");
    const fields=['jobId','jobName','jobStatus','closed','currentStep','currentStepId'];
    const result=await this.call('jobs/search',{method:'POST',body:{q:`${name} = '${escaped}'`,fields,num:10}});
    if(Array.isArray(result.jobs))return result.jobs;
    if(Array.isArray(result.items))return result.items;
    if(!Array.isArray(result.results))return [];
    const names=(result.fields||fields).map(field=>typeof field==='string'?field:field.name);
    return result.results.map(row=>Array.isArray(row)?Object.fromEntries(names.map((field,index)=>[field,row[index]])):row);
  }

  async createJob(jobTemplateId, options = {}) {
    const properties = Object.entries(stringsOnly(options.extendedProperties)).map(([identifier,value])=>({identifier,value}));
    const body = { numberOfJobs: 1, jobName: String(options.name || 'Resource Request'), extendedProperties: properties };
    const result = await this.call(`jobTemplates/${encodeURIComponent(jobTemplateId)}/job`, { method: 'POST', body });
    const job = result.jobs?.[0] || result.job || result;
    const jobId = job.jobId || job.id || result.jobIds?.[0];
    if (!jobId) throw new Error('Workflow Manager did not return a job ID.');
    return { ...job, jobId };
  }

  addComment(jobId, comment) { return this.call(`jobs/${encodeURIComponent(jobId)}/comments`, { method: 'POST', body: { comment: String(comment) } }); }

  async getComments(jobId) { const result=await this.call(`jobs/${encodeURIComponent(jobId)}/comments?_=${Date.now()}`); return result.jobComments||result.comments||[]; }

  async getHistory(jobId) { const result=await this.call(`jobs/${encodeURIComponent(jobId)}/history?_=${Date.now()}`); return result.jobHistory||result.history||[]; }

  assignStep(jobId, stepId, username) {
    return this.call(`jobs/${encodeURIComponent(jobId)}/${encodeURIComponent(stepId)}`, { method: 'POST', body: { assignedType: 'User', assignedTo: username } });
  }

  jobAction(jobId, type, stepId) {
    return this.call(`jobs/${encodeURIComponent(jobId)}/action`, { method: 'POST', body: { type, stepIds: stepId ? [stepId] : undefined } });
  }

  async finishStep(jobId, stepId) {
    const username = await this.getUsername();
    if (username) await this.assignStep(jobId, stepId, username).catch(() => undefined);
    await this.jobAction(jobId, 'Run', stepId).catch(() => undefined);
    let result = null, finishError = null;
    try { result = assertStepAction(await this.jobAction(jobId, 'Finish', stepId), 'Finish'); }
    catch (error) { finishError = error; }
    const job = await this.getJob(jobId);
    const currentSteps = job.currentSteps || [];
    const stillCurrent = currentSteps.some(step => step.stepId === stepId);
    if (stillCurrent) {
      if (finishError) throw finishError;
      throw new Error(`Workflow step ${stepId} did not complete.`);
    }
    return { result, currentSteps, alreadyAdvanced: Boolean(finishError) };
  }

  async sendStepInformation(jobId, stepId, response, note, timeoutMs = 20000) {
    if (!this.WebSocketImpl) throw new Error('This browser does not support the Workflow Manager notification connection.');
    const token = await this.getToken();
    const wsUrl = `${this.baseUrl.replace(/^http/i, 'ws')}/notificationWs?token=${encodeURIComponent(token)}`;
    const message = { jobId, stepId, ...(response === null || response === undefined ? { manualResponse: true } : { questionResponse: response }), ...(note ? { comment: note } : {}) };
    return new Promise((resolve, reject) => {
      const ws = new this.WebSocketImpl(wsUrl); let settled = false;
      const finish = (callback) => { if (settled) return; settled = true; clearTimeout(timer); try { ws.close(); } catch {} callback(); };
      const timer = setTimeout(() => finish(async () => {
        try { const job = await this.getJob(jobId); (job.currentSteps || []).some(step => step.stepId === stepId) ? reject(new Error('The workflow action timed out and the step is still current.')) : resolve(job.currentSteps || []); }
        catch (error) { reject(error); }
      }), timeoutMs);
      ws.onerror = () => finish(() => reject(new Error('The Workflow Manager notification connection failed.')));
      ws.onopen = () => {
        ws.send(JSON.stringify({ msgType: 'subscribe', jobIds: [jobId], token }));
        ws.send(JSON.stringify({ msgType: 'StepInformation', message, token }));
      };
      ws.onmessage = event => {
        let payload; try { payload = JSON.parse(String(event.data)); } catch { return; }
        if (payload.msgType === 'StepFinished' && payload.message?.stepIds?.includes(stepId)) finish(() => resolve(payload.message.currentSteps || []));
        else if (payload.msgType === 'StepError' || payload.msgType === 'StepInfoRequiredError') finish(() => reject(new Error(payload.message?.msg || `Workflow step ${stepId} reported an error.`)));
      };
    });
  }

  async waitForStepAdvance(jobId, stepId, { attempts = 8, delayMs = 500 } = {}) {
    let job = null;
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt) await new Promise(resolve => setTimeout(resolve, delayMs));
      job = await this.getJob(jobId);
      const currentSteps = job.currentSteps || [];
      if (!currentSteps.some(step => step.stepId === stepId)) return currentSteps;
    }
    throw new Error(`Workflow step ${stepId} did not complete after Workflow Manager acknowledged the response.`);
  }

  async completeStep(jobId, stepId, response, note, { persistComment = true } = {}) {
    const username = await this.getUsername();
    if (username) await this.assignStep(jobId, stepId, username).catch(() => undefined);
    await this.jobAction(jobId, 'Run', stepId).then(result => assertStepAction(result, 'Run')).catch(() => undefined);
    await new Promise(resolve => setTimeout(resolve, 350));
    let currentSteps;
    try {
      currentSteps = await this.sendStepInformation(jobId, stepId, response, note);
    } catch (firstError) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const job = await this.getJob(jobId).catch(() => null);
      const verifiedSteps = job?.currentSteps || [];
      if (job && !verifiedSteps.some(step => step.stepId === stepId)) currentSteps = verifiedSteps;
      else {
        await this.jobAction(jobId, 'Stop', stepId).catch(() => undefined);
        await new Promise(resolve => setTimeout(resolve, 350));
        await this.jobAction(jobId, 'Run', stepId).then(result => assertStepAction(result, 'Run'));
        await new Promise(resolve => setTimeout(resolve, 350));
        currentSteps = await this.sendStepInformation(jobId, stepId, response, note);
      }
    }
    currentSteps = await this.waitForStepAdvance(jobId, stepId);
    if (note && persistComment) {
      try { await this.addComment(jobId, note); }
      catch (error) { console.warn('Workflow advanced, but its audit comment could not be saved.', error); }
    }
    return currentSteps;
  }
}
