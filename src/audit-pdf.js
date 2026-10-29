const text = value => value == null ? '' : String(value);
const ascii = value => text(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[^\x20-\x7E]/g, '?');
const escapePdf = value => ascii(value).replace(/([\\()])/g, '\\$1');
const validHex = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
const rgb = hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
const color = hex => rgb(hex).map(value => value.toFixed(3)).join(' ');

function wrap(value, width = 88) {
  const words = ascii(value).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) return [''];
  const lines = []; let line = '';
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

function auditReportLines(request, entries, generatedAt, hasMap = false) {
  const equipment = [request.RequestedKind, request.RequestedType].filter(Boolean).join(' / ') || '-';
  const metadata = [
    ['Workflow Job', request.WFMJobId || '-'], ['Request GlobalID', request.GlobalID || '-'],
    ['Incident', request.IncidentName || '-'], ['Requestor', request.Requestor || '-'],
    ['Status', request.RequestStatus || '-'], ['Priority', request.Priority || '-'],
    ['Equipment', equipment], ['Quantity', request.QuantityRequested ?? '-'],
    ['Date needed', request.DateNeeded ? new Date(request.DateNeeded).toLocaleString() : '-'],
    ['Generated', generatedAt.toLocaleString()]
  ];
  const lines = [{ kind: 'request-title', text: request.RequestTitle || 'Resource Request', size: 14, gap: 24 }, ...(hasMap ? [{ kind: 'map', text: '', size: 0, gap: 252 }] : [])];
  for (const [label, value] of metadata) for (const [index, part] of wrap(`${label}: ${value}`, 82).entries()) lines.push({ kind: index ? 'meta-continuation' : 'meta', text: part, size: 9, gap: 13 });
  lines.push({ kind: 'section', text: 'AUDIT EVENTS', size: 12, gap: 28 });
  entries.forEach((entry, index) => {
    const stamp = entry.date ? new Date(entry.date).toLocaleString() : 'No timestamp';
    lines.push({ kind: 'event-heading', text: `${index + 1}. ${stamp} | ${entry.user || 'Workflow Manager'}${entry.persona ? ` | ${entry.persona}` : ''}`, size: 9, gap: 15 });
    for (const part of wrap(entry.title || 'Workflow change')) lines.push({ kind: 'event-title', text: part, indent: 14, size: 10, gap: 14 });
    for (const part of wrap(entry.detail ? `Details: ${entry.detail}` : '')) if (part) lines.push({ kind: 'event-detail', text: part, indent: 14, size: 9, gap: 13 });
    for (const part of wrap(entry.comment ? `Comment: ${entry.comment}` : '')) if (part) lines.push({ kind: 'event-comment', text: part, indent: 14, size: 9, gap: 13 });
    lines.push({ kind: 'spacer', text: '', gap: 10 });
  });
  return lines;
}

function paginate(lines) {
  const pages = []; let page = []; let y = 658;
  for (const line of lines) {
    const gap = line.gap || (line.size || 10) + 4;
    if (y - gap < 58 && page.length) { pages.push(page); page = []; y = 658; }
    page.push({ ...line, y }); y -= gap;
  }
  if (page.length) pages.push(page);
  return pages;
}

function textCommand(value, x, y, size, font, fill) {
  return `BT ${color(fill)} rg /${font} ${size} Tf ${x} ${y} Td (${escapePdf(value)}) Tj ET`;
}

function requestReportLines(request, generatedAt, approver) {
  const fields = [
    ['Request title', request.RequestTitle], ['Incident', request.IncidentName], ['Requestor', request.Requestor],
    ['Priority', request.Priority], ['Requested category', request.RequestedCategory], ['Requested kind', request.RequestedKind],
    ['Requested type', request.RequestedType], ['Quantity requested', request.QuantityRequested],
    ['Date needed', request.DateNeeded ? new Date(request.DateNeeded).toLocaleString() : '-'], ['Request status', request.RequestStatus],
    ['Workflow job', request.WFMJobId], ['Integration state', request.IntegrationState], ['Request GlobalID', request.GlobalID],
    ['Approver / report user', approver || '-'], ['Generated', generatedAt.toLocaleString()]
  ];
  const lines = [{ kind: 'request-title', text: request.RequestTitle || 'Resource Request', size: 14, gap: 24 }];
  for (const [label, value] of fields) for (const [index, part] of wrap(`${label}: ${value ?? '-'}`, 82).entries()) lines.push({ kind: index ? 'meta-continuation' : 'meta', text: part, size: 9, gap: 13 });
  lines.push({ kind: 'section', text: 'NOTES / JUSTIFICATION', size: 12, gap: 28 });
  for (const part of wrap(request.Notes || 'No notes or justification were provided.', 86)) lines.push({ kind: 'request-note', text: part, size: 10, gap: 14 });
  if (request.IntegrationError) {
    lines.push({ kind: 'section', text: 'WORKFLOW INTEGRATION MESSAGE', size: 12, gap: 28 });
    for (const part of wrap(request.IntegrationError, 86)) lines.push({ kind: 'request-note', text: part, size: 9, gap: 13 });
  }
  return lines;
}

function pageCommands(page, pageNumber, pageCount, branding, hasLogo, hasMap, reportTitle = 'WORKFLOW AUDIT HISTORY') {
  const colors = branding.colors;
  const logoOffset = 82;
  const commands = [
    `${color(colors.navy)} rg 0 700 612 92 re f`,
    `${color(colors.accent)} rg 0 695 612 5 re f`,
    `${color(colors.panelAlt)} rg 0 0 612 34 re f`,
    textCommand(branding.appName, 36 + logoOffset, 758, 15, 'F2', colors.text),
    textCommand(branding.subtitle, 36 + logoOffset, 740, 8, 'F1', colors.muted),
    textCommand(reportTitle, 36 + logoOffset, 718, 10, 'F2', colors.accent),
    textCommand(`Generated by ${branding.appName}`, 36, 13, 7, 'F1', colors.muted),
    textCommand(`Page ${pageNumber} of ${pageCount}`, 520, 13, 7, 'F1', colors.muted)
  ];
  if (hasLogo) {
    commands.push('1 1 1 rg 30 712 70 68 re f');
    const scale = Math.min(62 / branding.logo.width, 58 / branding.logo.height);
    const width = branding.logo.width * scale; const height = branding.logo.height * scale;
    commands.push(`q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${(65 - width / 2).toFixed(2)} ${(746 - height / 2).toFixed(2)} cm /Logo Do Q`);
  } else {
    commands.push(`${color(colors.accent)} RG 2 w 34 716 56 56 re S`);
    commands.push(textCommand('EOC', 45, 738, 14, 'F2', colors.accent));
  }
  for (const line of page) {
    if (line.kind === 'request-title') {
      commands.push(`${color(colors.panelAlt)} rg 36 ${(line.y - 7).toFixed(2)} 540 24 re f`);
      commands.push(textCommand(line.text, 44, line.y, line.size, 'F2', colors.text));
    } else if (line.kind === 'map' && hasMap) {
      commands.push(`${color(colors.border)} RG 1 w 36 ${(line.y - 226).toFixed(2)} 540 220 re S`);
      commands.push(`q 540 0 0 220 36 ${(line.y - 226).toFixed(2)} cm /MapImage Do Q`);
    } else if (line.kind === 'section') {
      commands.push(`${color(colors.accent)} rg 36 ${(line.y - 7).toFixed(2)} 540 22 re f`);
      commands.push(textCommand(line.text, 44, line.y, line.size, 'F2', colors.background));
    } else if (line.kind === 'event-heading') {
      commands.push(`${color(colors.border)} RG .7 w 36 ${(line.y - 5).toFixed(2)} m 576 ${(line.y - 5).toFixed(2)} l S`);
      commands.push(textCommand(line.text, 40, line.y, line.size, 'F2', colors.navy));
    } else if (line.kind !== 'spacer') {
      const isLabel = line.kind === 'meta';
      const fill = line.kind === 'event-comment' ? colors.navy : line.kind === 'event-detail' ? colors.muted : colors.background;
      commands.push(textCommand(line.text, 44 + (line.indent || 0), line.y, line.size || 9, isLabel || line.kind === 'event-title' ? 'F2' : 'F1', fill));
    }
  }
  return commands.join('\n');
}

function normalizeBranding(input = {}) {
  const source = input.colors || {};
  return {
    appName: ascii(input.appName || 'Resource & Asset Management').slice(0, 60),
    subtitle: ascii(input.subtitle || 'FEMA NIMS Common Operating Picture - Powered by ArcGIS Workflow Manager').slice(0, 100),
    logo: input.logo,
    mapImage: input.mapImage,
    colors: {
      navy: validHex(source.navy, '#003B5C'), background: validHex(source.background, '#071824'),
      panelAlt: validHex(source.panelAlt, '#123247'), accent: validHex(source.accent, '#F2A900'),
      text: validHex(source.text, '#F4F7F9'), muted: validHex(source.muted, '#AFC3CF'), border: validHex(source.border, '#28495B')
    }
  };
}

export async function loadPdfLogo(url) {
  if (!url || typeof document === 'undefined') return null;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`PDF image could not be loaded (${response.status}).`);
  const source = await response.blob(); let drawable; let objectUrl;
  try {
    if (source.type.includes('svg') || typeof createImageBitmap !== 'function') {
      objectUrl=URL.createObjectURL(source); const image=new Image(); image.decoding='async'; image.src=objectUrl;
      await image.decode(); drawable=image;
    } else {
      try { drawable=await createImageBitmap(source); }
      catch { objectUrl=URL.createObjectURL(source); const image=new Image(); image.decoding='async'; image.src=objectUrl; await image.decode(); drawable=image; }
    }
    const sourceWidth=drawable.width||drawable.naturalWidth; const sourceHeight=drawable.height||drawable.naturalHeight;
    if(!sourceWidth||!sourceHeight)throw new Error('The PDF image has no readable dimensions.');
    const maximum = 1200; const scale = Math.min(1, maximum / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(sourceWidth * scale)); canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext('2d'); if(!context)throw new Error('The PDF image canvas is unavailable.'); context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(drawable, 0, 0, canvas.width, canvas.height);
    const jpeg = await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The PDF image could not be converted.')), 'image/jpeg', .9));
    return { bytes: new Uint8Array(await jpeg.arrayBuffer()), width: canvas.width, height: canvas.height };
  } catch(error) { throw new Error(`The PDF image could not be decoded: ${error.message}`); }
  finally { drawable?.close?.(); if(objectUrl)URL.revokeObjectURL(objectUrl); }
}

function buildPdf(lines, brandingInput, reportTitle) {
  const branding = normalizeBranding(brandingInput); const pages = paginate(lines);
  const hasLogo = Boolean(branding.logo?.bytes?.length && branding.logo.width && branding.logo.height);
  const hasMap = Boolean(branding.mapImage?.bytes?.length && branding.mapImage.width && branding.mapImage.height);
  const objects = [null, '<< /Type /Catalog /Pages 2 0 R >>', null, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'];
  let nextId = 5; let logoId = null; let mapId = null;
  const addImage = image => { const id=nextId++; const hex=[...image.bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('').toUpperCase(); objects[id]=`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${hex.length + 1} >>\nstream\n${hex}>\nendstream`; return id; };
  if (hasLogo) logoId=addImage(branding.logo);
  if (hasMap) mapId=addImage(branding.mapImage);
  const kids = [];
  pages.forEach((page, index) => {
    const pageId = nextId++; const contentId = nextId++; kids.push(`${pageId} 0 R`);
    const commands = pageCommands(page, index + 1, pages.length, branding, hasLogo, hasMap, reportTitle);
    const imageRefs=[hasLogo&&`/Logo ${logoId} 0 R`,hasMap&&`/MapImage ${mapId} 0 R`].filter(Boolean).join(' ');
    const xObject = imageRefs ? ` /XObject << ${imageRefs} >>` : '';
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xObject} >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`;
  });
  objects[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  for (let id = 1; id < objects.length; id++) { offsets[id] = pdf.length; pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`; }
  const xref = pdf.length; pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

export function buildAuditPdf(request = {}, entries = [], generatedAt = new Date(), brandingInput = {}) {
  const hasMap=Boolean(brandingInput.mapImage?.bytes?.length);
  return buildPdf(auditReportLines(request, entries, generatedAt, hasMap), brandingInput, 'WORKFLOW AUDIT HISTORY');
}

export function buildRequestPdf(request = {}, generatedAt = new Date(), brandingInput = {}, approver = '') {
  return buildPdf(requestReportLines(request, generatedAt, approver), brandingInput, 'RESOURCE REQUEST REPORT');
}
