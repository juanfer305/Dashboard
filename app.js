// ============================================
// Dashboard — app.js
// Maneja: navegación, movimientos, créditos, clientes y cuentas de cobro
// ============================================

const state = {
  view: 'resumen',
  currentMonth: new Date(),
  movimientos: [],
  clientes: [],
  cuentas: [],
  creditos: [],
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
      <td class="actions-cell">
        <button class="btn-ghost btn-sm" data-edit-tx="${m.id}">Editar</button>
        <button class="btn-danger btn-sm" data-del-tx="${m.id}">Borrar</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-edit-tx]').forEach(btn => {
    btn.addEventListener('click', () => openEditMovimientoModal(btn.dataset.editTx));
  });
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
  if (!confirm('¿Estás seguro de que quieres borrar este movimiento?')) return;

  const { error } = await window.sb.from('movimientos').delete().eq('id', id);
  if (error) { toast('No se pudo eliminar', 'error'); return; }
  toast('Movimiento eliminado');
  loadMovimientos();
}

async function openEditMovimientoModal(movimientoId) {
  const movimiento = state.movimientos.find(m => String(m.id) === String(movimientoId));
  if (!movimiento) return;

  const modal = document.getElementById('editMovimientoModal');
  if (!modal) {
    console.error('Modal de edición de movimiento no encontrado');
    return;
  }

  document.querySelector('#editMovimientoForm [name="edit-tx-tipo"]').value = movimiento.tipo || 'ingreso';
  document.querySelector('#editMovimientoForm [name="edit-tx-monto"]').value = movimiento.monto || 0;
  document.querySelector('#editMovimientoForm [name="edit-tx-fecha"]').value = movimiento.fecha || '';
  document.querySelector('#editMovimientoForm [name="edit-tx-categoria"]').value = movimiento.categoria || '';
  document.querySelector('#editMovimientoForm [name="edit-tx-descripcion"]').value = movimiento.descripcion || '';
  document.getElementById('editMovimientoForm').dataset.movimientoId = movimientoId;

  openModal('editMovimientoModal');
}

document.getElementById('editMovimientoForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const movimientoId = e.target.dataset.movimientoId;
  const fd = new FormData(e.target);

  const { error } = await window.sb.from('movimientos').update({
    tipo: fd.get('edit-tx-tipo'),
    monto: Number(fd.get('edit-tx-monto')),
    fecha: fd.get('edit-tx-fecha'),
    categoria: fd.get('edit-tx-categoria'),
    descripcion: fd.get('edit-tx-descripcion'),
  }).eq('id', movimientoId);

  if (error) {
    toast('Error al actualizar: ' + error.message, 'error');
    return;
  }

  toast('Movimiento actualizado', 'success');
  closeModal('editMovimientoModal');
  loadMovimientos();
});

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
      <div class="client-card-actions">
        <button class="btn-ghost btn-sm" data-edit-client="${c.id}">Editar</button>
        <button class="btn-danger btn-sm" data-del-client="${c.id}">Borrar</button>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('[data-edit-client]').forEach(btn => {
    btn.addEventListener('click', () => openEditClientModal(btn.dataset.editClient));
  });
  grid.querySelectorAll('[data-del-client]').forEach(btn => {
    btn.addEventListener('click', () => deleteCliente(btn.dataset.delClient));
  });
}

async function openEditClientModal(clienteId) {
  const cliente = state.clientes.find(c => String(c.id) === String(clienteId));
  if (!cliente) return;

  const modal = document.getElementById('editClientModal');
  if (!modal) {
    console.error('Modal de edición de cliente no encontrado');
    return;
  }

  document.querySelector('#editClientForm [name="edit-nombre"]').value = cliente.nombre || '';
  document.querySelector('#editClientForm [name="edit-documento"]').value = cliente.documento || '';
  document.querySelector('#editClientForm [name="edit-correo"]').value = cliente.correo || '';
  document.querySelector('#editClientForm [name="edit-ciudad"]').value = cliente.ciudad || '';
  document.getElementById('editClientForm').dataset.clienteId = clienteId;

  openModal('editClientModal');
}

async function deleteCliente(clienteId) {
  if (!confirm('¿Estás seguro de que quieres borrar este cliente?')) return;

  const { error } = await window.sb.from('clientes').delete().eq('id', clienteId);
  if (error) {
    toast('No se pudo borrar: ' + error.message, 'error');
    return;
  }

  toast('Cliente eliminado', 'success');
  loadClientes();
}

document.getElementById('editClientForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const clienteId = e.target.dataset.clienteId;
  const fd = new FormData(e.target);

  const { error } = await window.sb.from('clientes').update({
    nombre: fd.get('edit-nombre'),
    documento: fd.get('edit-documento'),
    correo: fd.get('edit-correo'),
    ciudad: fd.get('edit-ciudad'),
  }).eq('id', clienteId);

  if (error) {
    toast('Error al actualizar: ' + error.message, 'error');
    return;
  }

  toast('Cliente actualizado', 'success');
  closeModal('editClientModal');
  loadClientes();
});


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
        ${c.pdf_url ? `<a class="btn-ghost btn-sm" href="${c.pdf_url}" target="_blank" rel="noopener">Ver PDF</a>` : ''}
        <button class="btn-ghost btn-sm" data-edit-cuenta="${c.id}">Editar</button>
        <button class="btn-ghost btn-sm" data-open-vercel="${c.id}">Abrir en Vercel</button>
      </td>
    </tr>
  `).join('');

  // Event listeners
  tbody.querySelectorAll('[data-edit-cuenta]').forEach(btn => {
    btn.addEventListener('click', () => openEditCuentaModal(btn.dataset.editCuenta));
  });
  tbody.querySelectorAll('[data-open-vercel]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cuenta = state.cuentas.find(c => String(c.id) === btn.dataset.openVercel);
      if (cuenta) window.open(`${window.CONFIG.INVOICE_API_BASE}?cuentaId=${cuenta.id}`, '_blank');
    });
  });
}

document.getElementById('openInvoiceModal').addEventListener('click', () => {
  const url = `${window.CONFIG.INVOICE_API_BASE}?action=new`;
  window.open(url, '_blank');
  toast('Abierta la app de cuentas de cobro en una nueva pestaña', 'success');
});

// ============================================
// CRÉDITOS
// ============================================

async function loadCreditos() {
  const { data, error } = await window.sb.from('creditos').select('*, clientes(nombre)').order('fecha', { ascending: false });
  if (error) { console.error(error); return; }
  state.creditos = data || [];
  renderCreditos();
}

function renderCreditos() {
  const tbody = document.getElementById('creditTableBody');
  const openCreditos = state.creditos.filter(c => Number(c.saldo_restante) > 0);
  const pagosRecibidos = state.creditos.reduce((sum, c) => sum + Number(c.pagado), 0);
  const saldoPendiente = state.creditos.reduce((sum, c) => sum + Number(c.saldo_restante), 0);

  document.getElementById('totalCreditosAbiertos').textContent = openCreditos.length;
  document.getElementById('totalPagosRecibidos').textContent = fmtCOP(pagosRecibidos);
  document.getElementById('totalSaldoPendiente').textContent = fmtCOP(saldoPendiente);
  document.getElementById('creditEmpty').classList.toggle('hidden', state.creditos.length > 0);

  tbody.innerHTML = state.creditos.map(c => `
    <tr>
      <td>${escapeHtml(c.clientes?.nombre || 'Cliente no encontrado')}</td>
      <td>${formatDate(c.fecha)}</td>
      <td class="right">${fmtCOP(c.monto)}</td>
      <td class="right">${fmtCOP(c.saldo_restante)}</td>
      <td><span class="badge ${c.saldo_restante > 0 ? 'pendiente' : 'enviada'}">${c.saldo_restante > 0 ? 'Pendiente' : 'Pagado'}</span></td>
      <td class="actions-cell">
        <button class="btn-ghost btn-sm" data-pay-credit="${c.id}">Abonar</button>
        <button class="btn-danger btn-sm" data-del-credit="${c.id}">Eliminar</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-pay-credit]').forEach(btn => {
    btn.addEventListener('click', () => openPaymentModal(btn.dataset.payCredit));
  });
  tbody.querySelectorAll('[data-del-credit]').forEach(btn => {
    btn.addEventListener('click', () => deleteCredito(btn.dataset.delCredit));
  });
}

function renderCreditosClientSelect() {
  const sel = document.getElementById('creditClientSelect');
  sel.innerHTML = state.clientes.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('');
}

document.getElementById('openCreditModal').addEventListener('click', () => {
  document.getElementById('creditForm').reset();
  document.querySelector('#creditForm [name="fecha"]').value = new Date().toISOString().slice(0, 10);
  renderCreditosClientSelect();
  openModal('creditModal');
});

document.getElementById('creditForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const monto = Number(fd.get('monto'));
  const payload = {
    cliente_id: fd.get('clienteId'),
    fecha: fd.get('fecha'),
    monto,
    saldo_restante: monto,
    pagado: 0,
    descripcion: fd.get('descripcion'),
  };
  const { error } = await window.sb.from('creditos').insert(payload);
  if (error) { toast('Error al guardar crédito: ' + error.message, 'error'); return; }
  toast('Crédito guardado', 'success');
  closeModal('creditModal');
  loadCreditos();
});

function openPaymentModal(creditoId) {
  const credito = state.creditos.find(c => String(c.id) === String(creditoId));
  if (!credito) return;
  const form = document.getElementById('paymentForm');
  form.reset();
  form.querySelector('[name="creditoId"]').value = creditoId;
  form.querySelector('[name="pago-fecha"]').value = new Date().toISOString().slice(0, 10);
  openModal('paymentModal');
}

document.getElementById('paymentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const creditoId = fd.get('creditoId');
  const pagoMonto = Number(fd.get('pago-monto'));
  const credito = state.creditos.find(c => String(c.id) === creditoId);
  if (!credito) {
    toast('No se encontró el crédito', 'error');
    return;
  }
  const nuevoPagado = Number(credito.pagado) + pagoMonto;
  const nuevoSaldo = Number(credito.monto) - nuevoPagado;
  const { error } = await window.sb.from('creditos').update({
    pagado: nuevoPagado,
    saldo_restante: nuevoSaldo < 0 ? 0 : nuevoSaldo,
  }).eq('id', creditoId);
  if (error) {
    toast('Error al registrar pago: ' + error.message, 'error');
    return;
  }
  toast('Abono registrado', 'success');
  closeModal('paymentModal');
  loadCreditos();
});

async function deleteCredito(creditoId) {
  if (!confirm('¿Eliminar este crédito?')) return;
  const { error } = await window.sb.from('creditos').delete().eq('id', creditoId);
  if (error) { toast('Error al eliminar crédito: ' + error.message, 'error'); return; }
  toast('Crédito eliminado', 'success');
  loadCreditos();
}



async function openEditCuentaModal(cuentaId) {
  const cuenta = state.cuentas.find(c => String(c.id) === cuentaId);
  if (!cuenta) return;

  const modal = document.getElementById('editCuentaModal');
  if (!modal) {
    console.error('Modal de edición no encontrado');
    return;
  }

  document.querySelector('#editCuentaForm [name="edit-descripcion"]').value = cuenta.descripcion || '';
  document.querySelector('#editCuentaForm [name="edit-valor"]').value = cuenta.valor || 0;
  document.querySelector('#editCuentaForm [name="edit-estado"]').value = cuenta.estado || 'pendiente';
  document.getElementById('editCuentaForm').dataset.cuentaId = cuentaId;

  openModal('editCuentaModal');
}

document.getElementById('editCuentaForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const cuentaId = e.target.dataset.cuentaId;
  const fd = new FormData(e.target);

  const { error } = await window.sb.from('cuentas_cobro').update({
    descripcion: fd.get('edit-descripcion'),
    valor: Number(fd.get('edit-valor')),
    estado: fd.get('edit-estado'),
  }).eq('id', cuentaId);

  if (error) {
    toast('Error al actualizar: ' + error.message, 'error');
    return;
  }

  toast('Cuenta de cobro actualizada', 'success');
  closeModal('editCuentaModal');
  loadCuentas();
});

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
await Promise.all([loadMovimientos(), loadClientes(), loadCuentas(), loadCreditos()]);
