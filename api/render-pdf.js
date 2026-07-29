async function parseBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (!chunks.length) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return { state: raw };
  }
}

function escapePdfText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildPdf(state) {
  const invoice = state?.invoice || state || {};
  const cliente = state?.cliente || state?.client || {};
  const fecha = invoice.fecha || state?.fecha || 'Sin fecha';
  const descripcion = invoice.descripcion || state?.descripcion || 'Sin descripción';
  const valor = invoice.valor ?? state?.valor ?? 0;
  const nombreCliente = cliente.nombre || 'Cliente';
  const documento = cliente.documento || '';
  const correo = cliente.correo || '';
  const text = [
    'Cuenta de cobro',
    `Cliente: ${nombreCliente}`,
    documento ? `Documento: ${documento}` : '',
    correo ? `Correo: ${correo}` : '',
    `Fecha: ${fecha}`,
    `Descripción: ${descripcion}`,
    `Valor: ${Number(valor).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`,
  ].filter(Boolean).join(' | ');

  const escapedText = escapePdfText(text);
  const content = `BT /F1 12 Tf 50 760 Td (${escapedText}) Tj ET`;
  const contentLength = Buffer.byteLength(content, 'utf8');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${contentLength} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  const offsets = [];
  let pdf = '%PDF-1.4\n';
  let currentOffset = pdf.length;
  offsets.push(currentOffset);

  objects.forEach((obj, index) => {
    if (index === 0) {
      pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
    } else {
      pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
    }
    currentOffset = Buffer.byteLength(pdf, 'utf8');
    offsets.push(currentOffset);
  });

  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const body = await parseBody(req);
  const rawState = body.state;
  let state = rawState;

  if (typeof rawState === 'string') {
    try {
      state = JSON.parse(rawState);
    } catch {
      state = { raw: rawState };
    }
  }

  const pdfBuffer = buildPdf(state);
  res.setHeader('Content-Type', 'application/pdf');
  res.status(200).end(pdfBuffer);
};

module.exports.default = module.exports;
