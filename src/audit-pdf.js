const text = value => value == null ? '' : String(value);
const ascii = value => text(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[^\x20-\x7E]/g, '?');
const escapePdf = value => ascii(value).replace(/([\\()])/g, '\\$1');

function wrap(value, width = 92) {
  const words = ascii(value).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let line = '';
  for (const word of words) {
    if (word.length > width) {
      if (line) { lines.push(line); line = ''; }
      for (let index = 0; index < word.length; index += width) lines.push(word.slice(index, index + width));
    } else if (!line) line = word;
    else if (`${line} ${word}`.length <= width) line += ` ${word}`;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

function auditLines(request, entries, generatedAt) {
  const equipment = [request.RequestedKind, request.RequestedType].filter(Boolean).join(' / ') || '-';
  const lines = [
    { text: 'WORKFLOW AUDIT HISTORY', size: 18, gap: 24 },
    { text: request.RequestTitle || 'Resource Request', size: 13, gap: 22 },
    { text: `Workflow Job: ${request.WFMJobId || '-'}` },
    { text: `Request GlobalID: ${request.GlobalID || '-'}` },
    { text: `Incident: ${request.IncidentName || '-'}` },
    { text: `Requestor: ${request.Requestor || '-'}` },
    { text: `Status: ${request.RequestStatus || '-'}    Priority: ${request.Priority || '-'}` },
    { text: `Equipment: ${equipment}    Quantity: ${request.QuantityRequested ?? '-'}` },
    { text: `Date needed: ${request.DateNeeded ? new Date(request.DateNeeded).toLocaleString() : '-'}` },
    { text: `Generated: ${generatedAt.toLocaleString()}`, gap: 22 },
    { text: 'AUDIT EVENTS', size: 13, gap: 20 }
  ];
  entries.forEach((entry, index) => {
    const stamp = entry.date ? new Date(entry.date).toLocaleString() : 'No timestamp';
    lines.push({ text: `${index + 1}. ${stamp} | ${entry.user || 'Workflow Manager'}${entry.persona ? ` | ${entry.persona}` : ''}`, size: 10 });
    for (const line of wrap(entry.title || 'Workflow change')) lines.push({ text: line, indent: 14, size: 10 });
    for (const line of wrap(entry.detail ? `Details: ${entry.detail}` : '')) if (line) lines.push({ text: line, indent: 14, size: 9 });
    for (const line of wrap(entry.comment ? `Comment: ${entry.comment}` : '')) if (line) lines.push({ text: line, indent: 14, size: 9 });
    lines.push({ text: '', gap: 8 });
  });
  return lines;
}

function paginate(lines) {
  const pages = []; let page = []; let y = 756;
  for (const line of lines) {
    const gap = line.gap || (line.size || 10) + 4;
    if (y - gap < 42 && page.length) { pages.push(page); page = []; y = 756; }
    page.push({ ...line, y }); y -= gap;
  }
  if (page.length) pages.push(page);
  return pages;
}

export function buildAuditPdf(request = {}, entries = [], generatedAt = new Date()) {
  const pages = paginate(auditLines(request, entries, generatedAt));
  const objects = [null, '<< /Type /Catalog /Pages 2 0 R >>', null, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const kids = [];
  pages.forEach((page, index) => {
    const pageId = 4 + index * 2; const contentId = pageId + 1; kids.push(`${pageId} 0 R`);
    const commands = page.map(line => `BT /F1 ${line.size || 10} Tf ${54 + (line.indent || 0)} ${line.y} Td (${escapePdf(line.text)}) Tj ET`).join('\n');
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`;
  });
  objects[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  for (let id = 1; id < objects.length; id++) { offsets[id] = pdf.length; pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`; }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}
