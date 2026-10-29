const text = value => value == null ? '' : String(value).trim();
const dateValue = value => {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
};

function actionEntries(history, responsibleForStep) {
  const entries = [];
  for (const [index, item] of history.entries()) {
    const action = text(item.action);
    if (!/^(Created|Started|Completed|Closed)$/i.test(action)) continue;
    const stepName = text(item.stepName);
    const stepId = text(item.stepId);
    const date = item.date || item.createdDate || item.actionDate;
    if (/^Closed$/i.test(action)) {
      const duplicate = entries.find(entry => entry.stepId === stepId && /^Completed$/i.test(entry.action) && Math.abs(dateValue(entry.date) - dateValue(date)) <= 600000);
      if (duplicate) continue;
    }
    const phase = (stepName || stepId || 'Workflow').replace(/^rr-/i, '');
    entries.push({
      date,
      user: item.username || item.createdBy || 'Workflow Manager',
      title: [phase, action, item.result].filter(Boolean).join(' · '),
      phase,
      progress: action,
      detail: item.statusDescription || '',
      persona: responsibleForStep(stepName),
      comment: '',
      action,
      stepId,
      _order: index
    });
  }
  return entries;
}

export function auditEntryHeading(entry = {}) {
  const phase = text(entry.phase || entry.title || 'Workflow').replace(/^rr-/i, '');
  const progress = text(entry.progress || 'Update');
  return `Audit ${phase} - ${progress}`;
}

export function auditEntryIdentity(entry = {}, formatDate = value => new Date(value).toLocaleString()) {
  const identity = text(entry.user) || 'Workflow Manager';
  return `Identity: ${identity}${entry.date ? ` · ${formatDate(entry.date)}` : ''}`;
}

export function normalizeAuditEntries(history = [], comments = [], responsibleForStep = () => '') {
  const entries = actionEntries(history, responsibleForStep);
  const available = new Set(entries);
  const orderedComments = comments.map((item, index) => ({
    date: item.lastModified || item.date || item.createdDate || item.creationDate,
    user: item.lastModifiedBy || item.username || item.createdBy || item.userName || 'Workflow Manager',
    comment: text(item.comment || item.text || item.message),
    _order: index
  })).filter(item => item.comment).sort((a, b) => dateValue(a.date) - dateValue(b.date) || a._order - b._order);

  for (const item of orderedComments) {
    const time = dateValue(item.date);
    const match = [...available]
      .filter(entry => Math.abs(dateValue(entry.date) - time) <= 600000)
      .sort((a, b) => {
        const aUser = a.user === item.user ? 0 : 1;
        const bUser = b.user === item.user ? 0 : 1;
        return aUser - bUser || Math.abs(dateValue(a.date) - time) - Math.abs(dateValue(b.date) - time) || a._order - b._order;
      })[0];
    if (match) {
      match.comment = item.comment;
      available.delete(match);
    }
  }

  return entries
    .sort((a, b) => dateValue(b.date) - dateValue(a.date) || a._order - b._order)
    .map(({ _order, action, stepId, ...entry }) => entry);
}
