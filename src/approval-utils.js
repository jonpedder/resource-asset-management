export const WORKFLOW_ACTIONS = Object.freeze({
  'Request Submitted': [{ label: 'Acknowledge submission', response: null }],
  'Logistics Review': [{ label: 'Complete logistics review', response: null }],
  'Approve Request?': [{ label: 'Approved', response: 1 }, { label: 'Denied', response: 0 }],
  'Source / Commit Resource': [{ label: 'Resource sourced / committed', response: null }],
  'Notify Ready to Deploy': [{ label: 'Send ready-to-deploy notification', mode: 'finish' }],
  'Mobilize / Dispatch': [{ label: 'Resource mobilized / dispatched', response: null }],
  'Deploy / In Use': [{ label: 'Resource deployed / in use', response: null }],
  'Ready to Return?': [{ label: 'Ready to return', response: 1 }, { label: 'Remain deployed', response: 0 }],
  'Demobilize': [{ label: 'Resource demobilized', response: null }],
  'Return & Restock': [{ label: 'Resource returned / restocked', response: null }],
  'Notify Resource Returned': [{ label: 'Send resource-returned notification', mode: 'finish' }],
  'Record Denial': [{ label: 'Denial recorded', response: null }],
  'Notify Request Denied': [{ label: 'Send request-denied notification', mode: 'finish' }],
  'Resubmit Request?': [{ label: 'Resubmit', response: 1 }, { label: 'Close without resubmission', response: 0 }],
  'Request Closed': [{ label: 'Acknowledge closeout', response: null }]
});

export function actionsForStep(stepName) { return WORKFLOW_ACTIONS[stepName] || []; }

export function requestorEmail(attributes = {}) {
  const candidates = [attributes.RequestorEmail, attributes.Requestor, attributes.Creator];
  return candidates.map(value => String(value || '').trim()).find(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) || '';
}

export function requestDetails(attributes = {}) {
  const date = attributes.DateNeeded ? new Date(attributes.DateNeeded).toLocaleDateString() : 'Not specified';
  return [
    ['Request', attributes.RequestTitle], ['Requested asset', [attributes.RequestedCategory, attributes.RequestedKind, attributes.RequestedType].filter(Boolean).join(' / ')],
    ['Quantity', attributes.QuantityRequested], ['Priority', attributes.Priority], ['Incident', attributes.IncidentName], ['Needed by', date],
    ['Status', attributes.RequestStatus], ['Workflow job', attributes.WFMJobId], ['Notes / justification', attributes.Notes]
  ].map(([label,value]) => `${label}: ${value || 'Not specified'}`).join('\n');
}

export function mailtoForRequest(attributes, approver) {
  const email = requestorEmail(attributes); if (!email) return '';
  const asset = [attributes.RequestedKind, attributes.RequestedType].filter(Boolean).join(' / ') || attributes.RequestedCategory || 'resource';
  const subject = `Resource request: ${asset}`;
  const body = `Hello ${attributes.Requestor || 'Requestor'},\n\n${requestDetails(attributes)}\n\nRegards,\n${approver || 'Approving Authority'}`;
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
