export const STEP_STATUS = Object.freeze({
  'Request Submitted': 'Submitted',
  'Logistics Review': 'Under Review',
  'Approve Request?': 'Under Review',
  'Source / Commit Resource': 'Approved',
  'Mobilize / Dispatch': 'En Route',
  'Deploy / In Use': 'Deployed',
  'Demobilize': 'Demobilizing',
  'Return & Restock': 'Returned',
  'Request Closed': 'Closed',
  'Record Denial': 'Denied'
});

export function statusForStep(stepName) {
  return STEP_STATUS[stepName] || null;
}
