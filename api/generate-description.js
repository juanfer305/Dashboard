async function parseBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (req.method === 'GET') {
    return {};
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
    return { text: raw };
  }
}

function buildDescription(text, documentType) {
  const base = String(text || '').trim();
  if (!base) {
    return 'Descripción pendiente. Completa el servicio para generar una propuesta más clara.';
  }

  const normalized = base.toLowerCase();
  const category = documentType === 'invoice' ? 'cuenta de cobro' : 'documento';

  if (normalized.includes('diseño') || normalized.includes('logo') || normalized.includes('marca')) {
    return `Servicio profesional de ${category} enfocado en identidad visual, diseño y material de comunicación para potenciar la presencia del cliente.`;
  }

  if (normalized.includes('desarrollo') || normalized.includes('web') || normalized.includes('app')) {
    return `Implementación de ${category} orientada a entregables técnicos, seguimiento y puesta en marcha con foco en resultados concretos.`;
  }

  if (normalized.includes('asesoría') || normalized.includes('consultoría')) {
    return `Asesoría estratégica para ${category} con análisis, recomendaciones y acompañamiento para tomar decisiones informadas.`;
  }

  return `Detalle profesional de ${category} con alcance claro, valor definido y enfoque en la solución entregada al cliente.`;
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
    res.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  const body = await parseBody(req);
  const text = body.text || '';
  const documentType = body.documentType || 'invoice';

  if (!text || String(text).trim().length < 3) {
    res.status(400).json({ success: false, error: 'Se requiere un texto base válido' });
    return;
  }

  const result = buildDescription(text, documentType);
  res.status(200).json({ success: true, result });
};

module.exports.default = module.exports;
