export const STEP_STATUS = Object.freeze({
  'Request Submitted': 'Submitted',
  'Logistics Review': 'Under Review',
  'Approve Request?': 'Under Review',
  'Source / Commit Resource': 'Approved',
  'Mobilize / Dispatch': 'En Route',
  'Deploy / In Use': 'Deployed',
  'Ready to Return?': 'Deployed',
  'Demobilize': 'Demobilizing',
  'Return & Restock': 'Returned',
  'Request Closed': 'Closed',
  'Record Denial': 'Denied',
  'Resubmit Request?': 'Denied'
});

export const STEP_NEXT_ACTION = Object.freeze({
  'Request Submitted': 'Logistics must acknowledge the submission.',
  'Logistics Review': 'Logistics must validate the request and send it for approval.',
  'Approve Request?': 'The approving authority must approve or deny the request.',
  'Source / Commit Resource': 'Logistics must source and commit the requested resource.',
  'Mobilize / Dispatch': 'Logistics must mobilize and dispatch the resource.',
  'Deploy / In Use': 'Operations must confirm the resource is deployed and in use.',
  'Ready to Return?': 'Operations must decide whether the resource is ready to return.',
  'Demobilize': 'Operations must demobilize the resource and coordinate its return.',
  'Return & Restock': 'Logistics must inspect, return, and restock the resource.',
  'Record Denial': 'The approving authority must record the denial reason.',
  'Resubmit Request?': 'The requestor must resubmit the request or close it.',
  'Request Closed': 'Acknowledge closeout to complete the workflow.'
});

export function statusForStep(stepName) {
  return STEP_STATUS[stepName] || null;
}

export function nextActionForStep(stepName) {
  return STEP_NEXT_ACTION[stepName] || '';
}
