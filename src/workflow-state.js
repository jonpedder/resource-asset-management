export const WORKFLOW_TIMELINE_STEPS = Object.freeze([
  'Request Submitted',
  'Logistics Review',
  'Approve Request?',
  'Source / Commit Resource',
  'Notify Ready to Deploy',
  'Mobilize / Dispatch',
  'Deploy / In Use',
  'Ready to Return?',
  'Demobilize',
  'Return & Restock',
  'Notify Resource Returned',
  'Record Denial',
  'Notify Request Denied',
  'Resubmit Request?',
  'Request Closed'
]);

export function timelineForStep(currentStep) {
  return WORKFLOW_TIMELINE_STEPS.map(step => ({ step, pending: step === currentStep }));
}

export const STEP_STATUS = Object.freeze({
  'Request Submitted': 'Submitted',
  'Logistics Review': 'Under Review',
  'Approve Request?': 'Under Review',
  'Source / Commit Resource': 'Approved',
  'Notify Ready to Deploy': 'Approved',
  'Mobilize / Dispatch': 'En Route',
  'Deploy / In Use': 'Deployed',
  'Ready to Return?': 'Deployed',
  'Demobilize': 'Demobilizing',
  'Return & Restock': 'Returned',
  'Notify Resource Returned': 'Returned',
  'Request Closed': 'Closed',
  'Record Denial': 'Denied',
  'Notify Request Denied': 'Denied',
  'Resubmit Request?': 'Denied'
});

export const STEP_NEXT_ACTION = Object.freeze({
  'Request Submitted': 'Logistics must acknowledge the submission.',
  'Logistics Review': 'Logistics must validate the request and send it for approval.',
  'Approve Request?': 'The approving authority must approve or deny the request.',
  'Source / Commit Resource': 'Logistics must source and commit the requested resource.',
  'Notify Ready to Deploy': 'Send the ready-to-deploy email notification.',
  'Mobilize / Dispatch': 'Logistics must mobilize and dispatch the resource.',
  'Deploy / In Use': 'Operations must confirm the resource is deployed and in use.',
  'Ready to Return?': 'Operations must decide whether the resource is ready to return.',
  'Demobilize': 'Operations must demobilize the resource and coordinate its return.',
  'Return & Restock': 'Logistics must inspect, return, and restock the resource.',
  'Notify Resource Returned': 'Send the resource-returned email notification.',
  'Record Denial': 'The approving authority must record the denial reason.',
  'Notify Request Denied': 'Send the request-denied email notification.',
  'Resubmit Request?': 'The requestor must resubmit the request or close it.',
  'Request Closed': 'Acknowledge closeout to complete the workflow.'
});

export function statusForStep(stepName) {
  return STEP_STATUS[stepName] || null;
}

export const STEP_RESPONSIBLE = Object.freeze({
  'Request Submitted': 'Logistics',
  'Logistics Review': 'Logistics',
  'Approve Request?': 'Approving Authority',
  'Source / Commit Resource': 'Logistics',
  'Notify Ready to Deploy': 'Logistics',
  'Mobilize / Dispatch': 'Logistics',
  'Deploy / In Use': 'Operations',
  'Ready to Return?': 'Operations',
  'Demobilize': 'Operations',
  'Return & Restock': 'Logistics',
  'Notify Resource Returned': 'Logistics',
  'Record Denial': 'Approving Authority',
  'Notify Request Denied': 'Approving Authority',
  'Resubmit Request?': 'Requestor',
  'Request Closed': 'Workflow Administrator'
});

export function nextActionForStep(stepName) {
  return STEP_NEXT_ACTION[stepName] || '';
}

export const PERSONA_DESCRIPTIONS = Object.freeze({
  'Logistics': 'Validates requests, sources and commits resources, coordinates dispatch, and manages return and restocking.',
  'Approving Authority': 'Reviews operational need and formally approves or denies the resource request.',
  'Operations': 'Confirms deployment, determines readiness to return, and coordinates demobilization.',
  'Requestor': 'Submits the operational need and decides whether a denied request should be revised and resubmitted.',
  'Workflow Administrator': 'Acknowledges final closeout and maintains workflow completion and audit integrity.'
});

export function responsibleForStep(stepName) {
  return STEP_RESPONSIBLE[stepName] || '';
}

export function personaDescription(persona) {
  return PERSONA_DESCRIPTIONS[persona] || 'No persona description is available for this workflow stage.';
}
