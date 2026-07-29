// ============================================
// Libro — app.js
// Maneja: navegación, movimientos (Supabase), clientes (Supabase),
// cuentas de cobro (Supabase + API externa de PDF/IA/email)
// ============================================

const state = {
  view: 'resumen',
  currentMonth: new Date(),
  movimientos: [],
  clientes: [],
  cuentas: [],
};

const fmtCOP = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + type;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3500);
}

// ---------- Navegación ----------
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});
document.querySelectorAll('[data-goto]').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.goto));
});

function switchView(view) {
  state.view = view;
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById('view-' + view).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
}

// ---------- Conexión Supabase (chequeo simple) ----------
async function checkConnection() {
  const dot = document.querySelector('#connStatus .dot');
  const text = document.getElementById('connStatusText');
  try {
    const { error } = await window.sb.from('movimientos').select('id').limit(1);
    if (error) throw error;
    dot.classList.add('ok');
    text.textContent = 'Conectado';
  } catch (e) {
    dot.classList.add('err');
    text.textContent = 'Sin conexión a la base de datos';
    console.error('Supabase connection error:', e);
    toast('No se pudo conectar a Supabase. Revisa js/config.js y el esquema SQL.', 'error');
  }
}

// ============================================
// MOVIMIENTOS
// ============================================

async function loadMovimientos() {
  const { data, error } = await window.sb
    .from('movimientos')
    .select('*')
    .order('fecha', { ascending: false });
  if (error) { console.error(error); return; }
  state.movimientos = data || [];
  renderResumen();
  renderMovimientosTable();
  renderCategoriaOptions();
}

function renderResumen() {
  const month = state.currentMonth;
  const monthLabel = month.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  document.getElementById('currentMonthLabel').textContent = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const inMonth = state.movimientos.filter(m => {
    const d = new Date(m.fecha + 'T00:00:00');
    return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
  });

  const ingresos = inMonth.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0);
  const gastos = inMonth.filter(m => m.tipo === 'gasto').reduce((s, m) => s + Number(m.monto), 0);
  const balance = ingresos - gastos;

  document.getElementById('totalIngresos').textContent = fmtCOP(ingresos);
  document.getElementById('totalGastos').textContent = fmtCOP(gastos);
  document.getElementById('totalBalance').textContent = fmtCOP(balance);
  document.getElementById('balanceCol').classList.toggle('negative', balance < 0);

  // recientes
  const recentList = document.getElementById('recentList');
  const recent = [...state.movimientos].slice(0, 6);
  recentList.innerHTML = recent.length ? recent.map(m => `
    <div class="tx-row">
      <div>
        <div class="desc">${escapeHtml(m.descripcion || m.categoria)}</div>
        <div class="meta">${m.categoria} · ${formatDate(m.fecha)}</div>
      </div>
      <div class="amt ${m.tipo}">${m.tipo === 'gasto' ? '-' : '+'} ${fmtCOP(m.monto)}</div>
    </div>
  `).join('') : '<p class="empty-state">Sin movimientos todavía.</p>';

  renderCharts();
}

function renderMovimientosTable() {
  const tbody = document.getElementById('txTableBody');
  const typeFilter = document.getElementById('filterType').value;
  const catFilter = document.getElementById('filterCategory').value;
  const searchFilter = document.getElementById('filterSearch').value.toLowerCase();

  const rows = state.movimientos.filter(m => {
    if (typeFilter && m.tipo !== typeFilter) return false;
    if (catFilter && m.categoria !== catFilter) return false;
    if (searchFilter && !(m.descripcion || '').toLowerCase().includes(searchFilter)) return false;
    return true;
  });

  document.getElementById('txEmpty').classList.toggle('hidden', rows.length > 0);

  tbody.innerHTML = rows.map(m => `
    <tr>
      <td>${formatDate(m.fecha)}</td>
      <td>${escapeHtml(m.descripcion || '—')}</td>
      <td>${escapeHtml(m.categoria)}</td>
      <td><span class="badge ${m.tipo}">${m.tipo}</span></td>
      <td class="right">${fmtCOP(m.monto)}</td>
      <td><button class="icon-btn" data-del-tx="${m.id}">✕</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-del-tx]').forEach(btn => {
    btn.addEventListener('click', () => deleteMovimiento(btn.dataset.delTx));
  });
}

function renderCategoriaOptions() {
  const cats = [...new Set(state.movimientos.map(m => m.categoria))].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  const filterSel = document.getElementById('filterCategory');
  const datalist = document.getElementById('categoriaList');
  const currentFilterVal = filterSel.value;

  filterSel.innerHTML = '<option value="">Toda categoría</option>' + cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  filterSel.value = currentFilterVal;

  datalist.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">`).join('');
}

async function deleteMovimiento(id) {
  const { error } = await window.sb.from('movimientos').delete().eq('id', id);
  if (error) { toast('No se pudo eliminar', 'error'); return; }
  toast('Movimiento eliminado');
  loadMovimientos();
}

document.getElementById('filterType').addEventListener('change', renderMovimientosTable);
document.getElementById('filterCategory').addEventListener('change', renderMovimientosTable);
document.getElementById('filterSearch').addEventListener('input', renderMovimientosTable);

document.getElementById('prevMonth').addEventListener('click', () => {
  state.currentMonth.setMonth(state.currentMonth.getMonth() - 1);
  renderResumen();
});
document.getElementById('nextMonth').addEventListener('click', () => {
  state.currentMonth.setMonth(state.currentMonth.getMonth() + 1);
  renderResumen();
});

// Modal movimiento
document.getElementById('openTxModal').addEventListener('click', () => {
  document.getElementById('txForm').reset();
  document.querySelector('#txForm [name="fecha"]').value = new Date().toISOString().slice(0, 10);
  openModal('txModal');
});

document.getElementById('txForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = {
    tipo: fd.get('tipo'),
    monto: Number(fd.get('monto')),
    fecha: fd.get('fecha'),
    categoria: fd.get('categoria'),
    descripcion: fd.get('descripcion'),
  };
  const { error } = await window.sb.from('movimientos').insert(payload);
  if (error) { toast('Error al guardar: ' + error.message, 'error'); return; }
  toast('Movimiento guardado', 'success');
  closeModal('txModal');
  loadMovimientos();
});

// ---------- Gráficos ----------
let trendChart, catChart;
function renderCharts() {
  const ctx1 = document.getElementById('chartTrend').getContext('2d');
  const ctx2 = document.getElementById('chartCategorias').getContext('2d');

  // últimos 6 meses
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(state.currentMonth);
    d.setMonth(d.getMonth() - i);
    months.push(d);
  }
  const ingresosSerie = months.map(d => sumMonth(d, 'ingreso'));
  const gastosSerie = months.map(d => sumMonth(d, 'gasto'));
  const labels = months.map(d => d.toLocaleDateString('es-CO', { month: 'short' }));

  if (trendChart) trendChart.destroy();
  trendChart = new Chart(ctx1, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Ingresos', data: ingresosSerie, borderColor: '#2F5D50', backgroundColor: 'rgba(47,93,80,0.08)', fill: true, tension: 0.3 },
        { label: 'Gastos', data: gastosSerie, borderColor: '#9A3B32', backgroundColor: 'rgba(154,59,50,0.08)', fill: true, tension: 0.3 },
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { family: 'Inter' } } } }, scales: { y: { ticks: { callback: v => (v / 1000) + 'k' } } } }
  });

  // categorías (gastos del mes actual)
  const monthGastos = state.movimientos.filter(m => {
    const d = new Date(m.fecha + 'T00:00:00');
    return m.tipo === 'gasto' && d.getMonth() === state.currentMonth.getMonth() && d.getFullYear() === state.currentMonth.getFullYear();
  });
  const byCat = {};
  monthGastos.forEach(m => { byCat[m.categoria] = (byCat[m.categoria] || 0) + Number(m.monto); });

  if (catChart) catChart.destroy();
  const palette = ['#9A3B32', '#B98A2E', '#2F5D50', '#736C5F', '#5C7A8A', '#C97B63'];
  catChart = new Chart(ctx2, {
    type: 'doughnut',
    data: {
      labels: Object.keys(byCat),
      datasets: [{ data: Object.values(byCat), backgroundColor: palette }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
}

function sumMonth(date, tipo) {
  return state.movimientos
    .filter(m => {
      const d = new Date(m.fecha + 'T00:00:00');
      return m.tipo === tipo && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
    })
    .reduce((s, m) => s + Number(m.monto), 0);
}

// ============================================
// CLIENTES
// ============================================

async function loadClientes() {
  const { data, error } = await window.sb.from('clientes').select('*').order('nombre');
  if (error) { console.error(error); return; }
  state.clientes = data || [];
  renderClientes();
  renderInvoiceClientSelect();
}

function renderClientes() {
  const grid = document.getElementById('clientList');
  document.getElementById('clientEmpty').classList.toggle('hidden', state.clientes.length > 0);
  grid.innerHTML = state.clientes.map(c => `
    <div class="client-card">
      <h4>${escapeHtml(c.nombre)}</h4>
      <p>${escapeHtml(c.documento || 'Sin documento')}</p>
      <p>${escapeHtml(c.correo || '')}</p>
      <p>${escapeHtml(c.ciudad || '')}</p>
    </div>
  `).join('');
}

function renderInvoiceClientSelect() {
  const sel = document.getElementById('invoiceClientSelect');
  sel.innerHTML = state.clientes.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('');
}

document.getElementById('openClientModal').addEventListener('click', () => {
  document.getElementById('clientForm').reset();
  openModal('clientModal');
});

document.getElementById('clientForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = {
    nombre: fd.get('nombre'),
    documento: fd.get('documento'),
    correo: fd.get('correo'),
    ciudad: fd.get('ciudad'),
  };
  const { error } = await window.sb.from('clientes').insert(payload);
  if (error) { toast('Error al guardar cliente: ' + error.message, 'error'); return; }
  toast('Cliente guardado', 'success');
  closeModal('clientModal');
  loadClientes();
});

// ============================================
// CUENTAS DE COBRO (usa tu API en Vercel)
// ============================================

async function loadCuentas() {
  const { data, error } = await window.sb.from('cuentas_cobro').select('*, clientes(nombre, correo)').order('fecha', { ascending: false });
  if (error) { console.error(error); return; }
  state.cuentas = data || [];
  renderCuentas();
}

function renderCuentas() {
  const tbody = document.getElementById('invoiceTableBody');
  document.getElementById('invoiceEmpty').classList.toggle('hidden', state.cuentas.length > 0);
  tbody.innerHTML = state.cuentas.map((c, i) => `
    <tr>
      <td>${String(state.cuentas.length - i).padStart(4, '0')}</td>
      <td>${escapeHtml(c.clientes?.nombre || '—')}</td>
      <td>${formatDate(c.fecha)}</td>
      <td class="right">${fmtCOP(c.valor)}</td>
      <td><span class="badge ${c.estado === 'enviada' ? 'enviada' : 'pendiente'}">${c.estado}</span></td>
      <td class="actions-cell">
        ${c.pdf_url ? `<a class="btn-ghost btn-sm" href="${c.pdf_url}" target="_blank" rel="noopener">Ver PDF</a>` : '<span class="badge pendiente">Sin PDF</span>'}
        <button class="btn-ghost btn-sm" data-send-email="${c.id}">Enviar por correo</button>
      </td>
    </tr>
  `).join('');
}

document.getElementById('invoiceTableBody').addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-send-email]');
  if (!button) return;
  const invoiceId = button.dataset.sendEmail;
  const cuenta = state.cuentas.find(c => String(c.id) === String(invoiceId));
  if (!cuenta) return;
  button.disabled = true;
  button.textContent = 'Enviando…';
  try {
    await sendInvoiceByEmail(cuenta);
    button.textContent = 'Enviado';
  } catch (err) {
    console.error(err);
    toast(err?.message || 'Error al enviar correo', 'error');
    button.textContent = 'Enviar por correo';
  } finally {
    button.disabled = false;
  }
});

document.getElementById('openInvoiceModal').addEventListener('click', () => {
  if (state.clientes.length === 0) {
    toast('Primero agrega un cliente en la pestaña Clientes', 'error');
    return;
  }
  document.getElementById('invoiceForm').reset();
  document.querySelector('#invoiceForm [name="fecha"]').value = new Date().toISOString().slice(0, 10);
  document.getElementById('invoiceHint').textContent = '';
  openModal('invoiceModal');
});

// Botón "Mejorar con IA" -> llama a /api/generate-description de tu proyecto Vercel
document.getElementById('btnMejorarDesc').addEventListener('click', async () => {
  const input = document.getElementById('invoiceDescripcion');
  const text = input.value.trim();
  if (text.length < 3) { toast('Escribe al menos una idea corta primero', 'error'); return; }

  const hint = document.getElementById('invoiceHint');
  hint.textContent = 'Mejorando descripción…';
  try {
    const res = await fetchWithTimeout(`${window.CONFIG.INVOICE_API_BASE}/api/generate-description`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, documentType: 'invoice' }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Error desconocido');
    input.value = data.result;
    hint.textContent = '';
  } catch (err) {
    console.error(err);
    hint.textContent = '';
    toast('No se pudo mejorar el texto: ' + err.message + ' — revisa CORS_SETUP.md', 'error');
  }
});

// Envío del formulario: guarda en Supabase + pide el PDF a /api/render-pdf
document.getElementById('invoiceForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const clienteId = fd.get('clienteId');
  const clienteIdString = typeof clienteId === 'string' ? clienteId : String(clienteId ?? '');
  const cliente = state.clientes.find(c => String(c.id) === clienteIdString);
  const payload = {
    cliente_id: clienteIdString,
    fecha: fd.get('fecha'),
    descripcion: fd.get('descripcion'),
    valor: Number(fd.get('valor')),
    estado: 'pendiente',
  };

  const hint = document.getElementById('invoiceHint');
  hint.textContent = 'Generando PDF…';

  try {
    // 1) Construimos el "state" que tu app de facturación espera en localStorage (axyra_invoice_state_v4)
    const invoiceState = buildInvoiceState(cliente, payload);

    // 2) Pedimos el PDF a tu API de render
    const res = await fetchWithTimeout(`${window.CONFIG.INVOICE_API_BASE}/api/render-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: JSON.stringify(invoiceState) }),
    }, 60000);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || `Error ${res.status}`);
    }

    const blob = await res.blob();
    const fileName = `cuenta-de-cobro-${cliente?.nombre || 'cliente'}.pdf`;

    const { data: insertData, error: insertError } = await window.sb.from('cuentas_cobro').insert({
      cliente_id: clienteIdString,
      fecha: fd.get('fecha'),
      descripcion: fd.get('descripcion'),
      valor: Number(fd.get('valor')),
      estado: 'pendiente',
    }).select('id').single();

    if (insertError || !insertData) {
      throw insertError || new Error('No se pudo guardar la cuenta de cobro');
    }

    const invoiceId = insertData.id;
    const storageResult = await uploadPdfToStorage(invoiceId, blob, fileName);
    if (!storageResult.url) {
      throw new Error('No se pudo subir el PDF a Supabase Storage');
    }

    const { error: updateError } = await window.sb.from('cuentas_cobro').update({ pdf_url: storageResult.url }).eq('id', invoiceId);
    if (updateError) throw updateError;

    toast('Cuenta de cobro generada y guardada', 'success');
    hint.textContent = '';
    closeModal('invoiceModal');
    loadCuentas();

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();

  } catch (err) {
    console.error(err);
    hint.textContent = '';
    toast('No se pudo generar el PDF: ' + err.message + ' — revisa CORS_SETUP.md', 'error');
  }
});

const STORAGE_BUCKET = 'invoices';

function buildInvoiceState(cliente, payload) {
  const lineItem = {
    descripcion: payload.descripcion || 'Servicios profesionales',
    cantidad: 1,
    precio_unitario: payload.valor || 0,
    total: payload.valor || 0,
  };

  const clienteBase = {
    nombre: cliente?.nombre || '',
    documento: cliente?.documento || '',
    correo: cliente?.correo || '',
    ciudad: cliente?.ciudad || '',
  };

  return {
    cliente: clienteBase,
    client: clienteBase,
    fecha: payload.fecha,
    descripcion: payload.descripcion,
    valor: payload.valor,
    total: payload.valor,
    items: [lineItem],
    lines: [lineItem],
    invoice: {
      fecha: payload.fecha,
      descripcion: payload.descripcion,
      valor: payload.valor,
      total: payload.valor,
      items: [lineItem],
    },
    impuestos: [],
  };
}

async function uploadPdfToStorage(invoiceId, blob, filename) {
  const storagePath = `${invoiceId}.pdf`;
  const { error } = await window.sb.storage.from(STORAGE_BUCKET).upload(storagePath, blob, { upsert: true });
  if (error) {
    console.error('Storage upload error:', error);
    return { error };
  }

  const { data: urlData, error: urlError } = await window.sb.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, 60 * 60 * 24 * 7);
  if (urlError) {
    console.warn('Signed URL generation failed, falling back to public URL', urlError);
    const { data: publicData, error: publicError } = window.sb.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    if (publicError) {
      console.error('Public URL error:', publicError);
      return { error: publicError };
    }
    return { url: publicData.publicUrl };
  }

  return { url: urlData.signedUrl };
}

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      const base64 = typeof result === 'string' ? (result.split(',')[1] || '') : '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function regenerateInvoicePdf(cuenta) {
  const cliente = state.clientes.find(c => String(c.id) === String(cuenta.cliente_id));
  if (!cliente) throw new Error('No se encontró el cliente para regenerar el PDF');

  const payload = {
    cliente_id: cuenta.cliente_id,
    fecha: cuenta.fecha,
    descripcion: cuenta.descripcion,
    valor: Number(cuenta.valor),
  };

  const invoiceState = buildInvoiceState(cliente, payload);
  const res = await fetchWithTimeout(`${window.CONFIG.INVOICE_API_BASE}/api/render-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: JSON.stringify(invoiceState) }),
  }, 60000);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `Error ${res.status}`);
  }

  return await res.blob();
}

async function sendInvoiceByEmail(cuenta) {
  const clientEmail = cuenta.clientes?.correo;
  if (!clientEmail) {
    throw new Error('El cliente no tiene correo registrado');
  }

  let pdfBlob;
  if (cuenta.pdf_url) {
    const pdfResponse = await fetch(cuenta.pdf_url);
    if (!pdfResponse.ok) {
      console.warn('No se pudo descargar PDF desde pdf_url, se regenerará');
      pdfBlob = await regenerateInvoicePdf(cuenta);
    } else {
      pdfBlob = await pdfResponse.blob();
    }
  } else {
    pdfBlob = await regenerateInvoicePdf(cuenta);
  }

  const pdfBase64 = await blobToBase64(pdfBlob);
  const filename = `cuenta-de-cobro-${cuenta.clientes?.nombre || 'cliente'}.pdf`;
  const body = {
    to: clientEmail,
    subject: `Cuenta de cobro - ${cuenta.clientes?.nombre || 'Cliente'}`,
    text: `Adjunto encontrarás la cuenta de cobro correspondiente al servicio facturado con fecha ${formatDate(cuenta.fecha)}.`,
    filename,
    pdfBase64,
  };

  const res = await fetchWithTimeout(`${window.CONFIG.INVOICE_API_BASE}/api/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, 30000);

  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.success) {
    throw new Error(result?.message || `Error al enviar correo (${res.status})`);
  }

  const { error } = await window.sb.from('cuentas_cobro').update({ estado: 'enviada' }).eq('id', cuenta.id);
  if (error) throw error;

  toast('Correo enviado y estado actualizado', 'success');
  loadCuentas();
}

// ============================================
// Utilidades
// ============================================

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

async function fetchWithTimeout(url, options = {}, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`La solicitud tardó demasiado (${timeout}ms)`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});
document.querySelectorAll('.modal-backdrop').forEach(bd => {
  bd.addEventListener('click', (e) => { if (e.target === bd) bd.classList.add('hidden'); });
});

// ============================================
// Init
// ============================================
await checkConnection();
await Promise.all([loadMovimientos(), loadClientes(), loadCuentas()]);
