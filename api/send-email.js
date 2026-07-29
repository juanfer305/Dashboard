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
    return { text: raw };
  }
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
  const { to, subject, text, filename, pdfBase64 } = body;

  if (!to || !subject || !text) {
    res.status(400).json({ success: false, error: 'Faltan datos de correo' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'onboarding@resend.dev';

  if (apiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          text,
          attachments: pdfBase64 ? [{ filename: filename || 'attachment.pdf', content: pdfBase64 }] : [],
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'El proveedor de correo devolvió un error');
      }

      res.status(200).json({ success: true, provider: 'resend' });
      return;
    } catch (error) {
      console.error('Email send error:', error);
      res.status(500).json({ success: false, error: error.message || 'No se pudo enviar el correo' });
      return;
    }
  }

  console.log('[simulate-email] Email preparado', { to, subject, filename, pdfBase64Length: pdfBase64 ? pdfBase64.length : 0 });
  res.status(200).json({
    success: true,
    simulated: true,
    message: 'Correo preparado localmente. Define RESEND_API_KEY y RESEND_FROM para enviarlo de verdad.',
  });
};

module.exports.default = module.exports;
