/* ============================================
   Domphu — Money Tracker  |  js/app.js
   Vanilla JS + LocalStorage + Chart.js
   ============================================ */

// ============ CONSTANTS ============
const CAT_EXPENSE = [
  { id:'makanan',    label:'Makanan',    icon:'🍔', color:'#f87171' },
  { id:'transport',  label:'Transport',  icon:'🚗', color:'#60a5fa' },
  { id:'hiburan',    label:'Hiburan',    icon:'🎮', color:'#fbbf24' },
  { id:'belanja',    label:'Belanja',    icon:'🛍️', color:'#c084fc' },
  { id:'kesehatan',  label:'Kesehatan',  icon:'💊', color:'#34d399' },
  { id:'tagihan',    label:'Tagihan',    icon:'📄', color:'#fb923c' },
  { id:'pendidikan', label:'Pendidikan', icon:'📚', color:'#22d3ee' },
  { id:'lainnya',    label:'Lainnya',    icon:'📦', color:'#94a3b8' },
];
const CAT_INCOME = [
  { id:'gaji',       label:'Gaji',       icon:'💼', color:'#4ade80' },
  { id:'bisnis',     label:'Bisnis',     icon:'📈', color:'#a3e635' },
  { id:'freelance',  label:'Freelance',  icon:'💻', color:'#38bdf8' },
  { id:'investasi',  label:'Investasi',  icon:'📊', color:'#f59e0b' },
  { id:'hadiah',     label:'Hadiah',     icon:'🎁', color:'#f472b6' },
  { id:'lainnya',    label:'Lainnya',    icon:'📦', color:'#94a3b8' },
];
const CATEGORIES = [...new Map([...CAT_EXPENSE, ...CAT_INCOME].map(c => [c.id, c])).values()];
const CAT_MAP    = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

// ============ STATE ============
let transactions = JSON.parse(localStorage.getItem('dm_txs') || '[]');
let budgets      = JSON.parse(localStorage.getItem('dm_budgets') || '[]');
let theme        = localStorage.getItem('dm_theme') || 'dark';

// active month = {year, month}  (0-indexed month)
const now = new Date();
let activeMonth = { year: now.getFullYear(), month: now.getMonth() };

let currentTab   = 'dashboard';
let selectedType = 'expense';
let selectedCat  = '';
let barChartInst = null;
let donutInst    = null;

// ============ HELPERS ============
const $  = id => document.getElementById(id);
const fmt = n  => 'Rp ' + Math.abs(n).toLocaleString('id-ID');
const fmtSign = (n, type) => (type === 'income' ? '+ ' : '- ') + fmt(n);

function monthKey(y, m) { return `${y}-${String(m+1).padStart(2,'0')}` }
function txMonthKey(tx)  { return monthKey(new Date(tx.date).getFullYear(), new Date(tx.date).getMonth()) }
function activeKey()     { return monthKey(activeMonth.year, activeMonth.month) }

function getCat(id) { return CAT_MAP[id] || CATEGORIES[CATEGORIES.length-1] }

function save() {
  localStorage.setItem('dm_txs', JSON.stringify(transactions));
}
function saveBudgets() {
  localStorage.setItem('dm_budgets', JSON.stringify(budgets));
}

// Transactions for the active month
function monthTxs(y, m) {
  const key = monthKey(y, m);
  return transactions.filter(tx => txMonthKey(tx) === key);
}
function activeTxs() { return monthTxs(activeMonth.year, activeMonth.month) }

// ============ INIT ============
(function init() {
  applyTheme();
  setDefaultDate();
  buildCatPills();
  buildCatSelects();
  bindEvents();
  initSpinner();
  initModal();
  renderAll();
})();

function setDefaultDate() {
  const today = new Date().toISOString().split('T')[0];
  $('txDate').value = today;
}

function buildCatPills() {
  renderCatPills();
}

function renderCatPills() {
  const cats = selectedType === 'expense' ? CAT_EXPENSE : CAT_INCOME;
  const wrap = $('catPills');
  wrap.innerHTML = cats.map(c =>
    `<button class="cat-pill" data-cat="${c.id}">${c.icon} ${c.label}</button>`
  ).join('');
  wrap.querySelectorAll('.cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedCat = btn.dataset.cat;
    });
  });
  selectedCat = '';
}

function buildCatSelects() {
  const allOpts = CATEGORIES.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');
  const expOpts = CAT_EXPENSE.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');
  $('budgetCat').innerHTML = '<option value="">Pilih kategori...</option>' + expOpts;
  $('filterCat').innerHTML = '<option value="">Semua Kategori</option>' + allOpts;
}

// ============ EVENTS ============
function bindEvents() {
  // Tabs
  document.querySelectorAll('.nav-tab').forEach(t =>
    t.addEventListener('click', () => switchTab(t.dataset.tab))
  );

  // FAB → goto transaksi
  $('fabBtn').addEventListener('click', () => switchTab('transaksi'));

  // Link buttons
  document.querySelectorAll('.link-btn[data-goto]').forEach(b =>
    b.addEventListener('click', () => switchTab(b.dataset.goto))
  );

  // Month nav
  $('prevMonth').addEventListener('click', () => shiftMonth(-1));
  $('nextMonth').addEventListener('click', () => shiftMonth(1));

  // Theme
  $('themeToggle').addEventListener('click', toggleTheme);

  // Type toggle
  document.querySelectorAll('.type-btn').forEach(b =>
    b.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(x => x.classList.remove('active','income','expense'));
      b.classList.add('active', b.dataset.type);
      selectedType = b.dataset.type;
      renderCatPills();
    })
  );
  // init active state
  document.querySelector('.type-btn[data-type="expense"]').classList.add('active','expense');

  // Submit tx → show confirm first
  $('submitBtn').addEventListener('click', confirmTransaction);

  // Filters
  $('searchInput').addEventListener('input', renderTxList);
  $('filterCat').addEventListener('change', renderTxList);
  $('filterType').addEventListener('change', renderTxList);

  // Budget submit → show confirm first
  $('budgetSubmitBtn').addEventListener('click', confirmBudget);
}

// ============ TAB SWITCH ============
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.nav-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab)
  );
  document.querySelectorAll('.page').forEach(p =>
    p.classList.toggle('active', p.id === 'page-' + tab)
  );
}

// ============ MONTH ============
function shiftMonth(delta) {
  activeMonth.month += delta;
  if (activeMonth.month > 11) { activeMonth.month = 0; activeMonth.year++; }
  if (activeMonth.month < 0)  { activeMonth.month = 11; activeMonth.year--; }
  renderAll();
}

function updateMonthLabel() {
  const d = new Date(activeMonth.year, activeMonth.month, 1);
  $('monthLabel').textContent = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

// ============ RENDER ALL ============
function renderAll() {
  updateMonthLabel();
  renderKPIs();
  renderBarChart();
  renderDonut();
  renderRecentList();
  renderBudgetStatus();
  renderTxList();
  renderBudgetCards();
}

// ============ KPI ============
function renderKPIs() {
  const txs = activeTxs();
  const income  = txs.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);
  const expense = txs.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);
  const balance = income - expense;
  const savePct = income > 0 ? Math.round((balance / income) * 100) : 0;

  $('kpiBalance').textContent  = fmt(balance);
  $('kpiBalance').style.color  = balance >= 0 ? 'var(--accent)' : 'var(--red)';
  $('kpiIncome').textContent   = fmt(income);
  $('kpiExpense').textContent  = fmt(expense);
  $('kpiSaving').textContent   = savePct + '%';

  const incTx = txs.filter(t=>t.type==='income').length;
  const expTx = txs.filter(t=>t.type==='expense').length;
  $('kpiIncomeSub').textContent  = incTx + ' transaksi';
  $('kpiExpenseSub').textContent = expTx + ' transaksi';
  $('kpiBalanceSub').textContent = balance >= 0 ? '▲ Surplus bulan ini' : '▼ Defisit bulan ini';
  $('kpiBalanceSub').style.color = balance >= 0 ? 'var(--green)' : 'var(--red)';
}

// ============ BAR CHART (6 months) ============
function renderBarChart() {
  const labels=[], incomes=[], expenses=[];
  for (let i=5; i>=0; i--) {
    let m = activeMonth.month - i, y = activeMonth.year;
    if (m < 0) { m += 12; y--; }
    const txs = monthTxs(y, m);
    const d = new Date(y, m, 1);
    labels.push(d.toLocaleDateString('id-ID',{month:'short'}));
    incomes.push(txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0));
    expenses.push(txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0));
  }

  const textColor = theme === 'dark' ? '#567492' : '#6b8aa8';
  const gridColor = theme === 'dark' ? '#1e2c3d' : '#d0dce8';

  if (barChartInst) barChartInst.destroy();
  barChartInst = new Chart($('barChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Pemasukan',
          data: incomes,
          backgroundColor: 'rgba(52,211,153,0.7)',
          borderRadius: 5,
          borderSkipped: false,
        },
        {
          label: 'Pengeluaran',
          data: expenses,
          backgroundColor: 'rgba(248,113,113,0.7)',
          borderRadius: 5,
          borderSkipped: false,
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: {
            color: textColor,
            font: { family: "'Bricolage Grotesque', sans-serif", size: 11 },
            usePointStyle: true, pointStyleWidth: 8,
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${fmt(ctx.raw)}`
          }
        }
      },
      scales: {
        x: { ticks: { color: textColor, font: { size: 11 } }, grid: { color: gridColor } },
        y: { ticks: { color: textColor, font: { size: 10 }, callback: v => 'Rp '+v.toLocaleString('id-ID') }, grid: { color: gridColor } }
      }
    }
  });
}

// ============ DONUT CHART ============
function renderDonut() {
  const txs = activeTxs().filter(t => t.type === 'expense');
  const totalExp = txs.reduce((s,t)=>s+t.amount,0);

  $('dcVal').textContent = fmt(totalExp);

  if (!txs.length) {
    $('donutChart').style.display = 'none';
    $('legendList').innerHTML = '<div class="empty-hint">Tidak ada pengeluaran</div>';
    if (donutInst) { donutInst.destroy(); donutInst = null; }
    return;
  }
  $('donutChart').style.display = 'block';

  const catTotals = {};
  txs.forEach(t => catTotals[t.category] = (catTotals[t.category]||0) + t.amount);
  const sorted = Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);

  const labels = sorted.map(([k]) => getCat(k).label);
  const data   = sorted.map(([,v]) => v);
  const colors = sorted.map(([k]) => getCat(k).color);

  if (donutInst) donutInst.destroy();
  donutInst = new Chart($('donutChart').getContext('2d'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }] },
    options: {
      cutout: '72%',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.raw)}` } } },
      animation: { duration: 500 },
    }
  });

  // Custom legend
  $('legendList').innerHTML = sorted.map(([k, v]) => {
    const cat = getCat(k);
    const pct = Math.round((v/totalExp)*100);
    return `<div class="legend-item">
      <span class="legend-dot" style="background:${cat.color}"></span>
      <span class="legend-name">${cat.icon} ${cat.label}</span>
      <span class="legend-amt">${fmt(v)}</span>
      <span class="legend-pct">${pct}%</span>
    </div>`;
  }).join('');
}

// ============ RECENT LIST ============
function renderRecentList() {
  const recent = activeTxs()
    .sort((a,b) => new Date(b.date)-new Date(a.date))
    .slice(0,6);

  if (!recent.length) {
    $('recentList').innerHTML = '<div class="empty-hint">Tidak ada transaksi bulan ini</div>';
    return;
  }

  $('recentList').innerHTML = recent.map(tx => {
    const cat = getCat(tx.category);
    return `<div class="mini-tx">
      <div class="mini-dot" style="background:${cat.color}20">${cat.icon}</div>
      <div class="mini-info">
        <div class="mini-name">${esc(tx.name)}</div>
        <div class="mini-meta">${cat.label} · ${fmtDate(tx.date)}</div>
      </div>
      <div class="mini-amt ${tx.type}">${fmtSign(tx.amount, tx.type)}</div>
    </div>`;
  }).join('');
}

// ============ BUDGET STATUS ============
function renderBudgetStatus() {
  const txs = activeTxs().filter(t=>t.type==='expense');
  if (!budgets.length) {
    $('budgetStatusList').innerHTML = '<div class="empty-hint">Buat anggaran di tab Anggaran</div>';
    return;
  }

  $('budgetStatusList').innerHTML = budgets.map(b => {
    const spent = txs.filter(t=>t.category===b.category).reduce((s,t)=>s+t.amount,0);
    const pct   = Math.min(Math.round((spent/b.limit)*100), 100);
    const color = pct >= 90 ? 'var(--red)' : pct >= 70 ? 'var(--yellow)' : 'var(--green)';
    const cat   = getCat(b.category);
    return `<div class="bst-item">
      <div class="bst-top">
        <span class="bst-cat">${cat.icon} ${cat.label}</span>
        <span class="bst-nums">${fmt(spent)} / ${fmt(b.limit)}</span>
      </div>
      <div class="bst-track">
        <div class="bst-fill" style="width:${pct}%;background:${color}"></div>
      </div>
    </div>`;
  }).join('');
}

// ============ TX LIST (Transaksi tab) ============
function renderTxList() {
  const search   = $('searchInput').value.toLowerCase();
  const filterCat  = $('filterCat').value;
  const filterType = $('filterType').value;

  let txs = activeTxs()
    .filter(tx => !search || tx.name.toLowerCase().includes(search))
    .filter(tx => !filterCat  || tx.category === filterCat)
    .filter(tx => !filterType || tx.type === filterType)
    .sort((a,b) => new Date(b.date) - new Date(a.date));

  if (!txs.length) {
    $('txFullList').innerHTML = '<div class="empty-hint" style="padding:40px 0">Tidak ada transaksi ditemukan</div>';
    return;
  }

  // Group by date
  const groups = {};
  txs.forEach(tx => {
    const d = tx.date;
    if (!groups[d]) groups[d] = [];
    groups[d].push(tx);
  });

  $('txFullList').innerHTML = Object.entries(groups).map(([date, items]) => `
    <div class="date-group-label">${fmtDateFull(date)}</div>
    ${items.map(tx => txItemHTML(tx)).join('')}
  `).join('');
}

function txItemHTML(tx) {
  const cat = getCat(tx.category);
  return `<div class="tx-item">
    <div class="tx-icon-wrap" style="background:${cat.color}18">${cat.icon}</div>
    <div class="tx-body">
      <div class="tx-name">${esc(tx.name)}</div>
      <div class="tx-sub">
        <span class="tx-cat-tag">${cat.label}</span>
        ${tx.note ? `<span>${esc(tx.note)}</span>` : ''}
      </div>
    </div>
    <div class="tx-amount ${tx.type}">${fmtSign(tx.amount, tx.type)}</div>
    <button class="tx-del" onclick="deleteTx(${tx.id})">✕</button>
  </div>`;
}

// ============ MODAL ============
let modalCallback = null;

function showModal({ icon, title, rows, confirmLabel = 'Simpan', danger = false, onConfirm }) {
  $('modalIcon').textContent = icon;
  $('modalTitle').textContent = title;
  $('modalBody').innerHTML = rows.map(r =>
    `<div class="modal-row">
      <span class="modal-row-label">${r.label}</span>
      <span class="modal-row-val ${r.cls || ''}">${r.val}</span>
    </div>`
  ).join('');
  $('modalConfirm').textContent = confirmLabel;
  $('modalConfirm').classList.toggle('danger', !!danger);
  modalCallback = onConfirm;
  $('modalBackdrop').classList.add('show');
}

function closeModal() {
  $('modalBackdrop').classList.remove('show');
  modalCallback = null;
}

function initModal() {
  $('modalCancel').addEventListener('click', closeModal);
  $('modalConfirm').addEventListener('click', () => {
    if (modalCallback) modalCallback();
    closeModal();
  });
  $('modalBackdrop').addEventListener('click', e => {
    if (e.target === $('modalBackdrop')) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

function confirmTransaction() {
  const name   = $('txName').value.trim();
  const amount = txSpinnerValue;
  const date   = $('txDate').value;
  const err    = $('formError');

  err.textContent = '';
  if (!name)               return (err.textContent = 'Keterangan tidak boleh kosong.');
  if (!amount || amount<=0) return (err.textContent = 'Jumlah harus lebih dari 0.');
  if (!date)               return (err.textContent = 'Pilih tanggal.');
  if (!selectedCat)        return (err.textContent = 'Pilih kategori terlebih dahulu.');

  const cat = getCat(selectedCat);
  const typeLabel = selectedType === 'income' ? 'Pemasukan' : 'Pengeluaran';
  const fmtDate = new Date(date).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });

  showModal({
    icon: cat.icon,
    title: 'Konfirmasi Transaksi',
    rows: [
      { label: 'Keterangan', val: name },
      { label: 'Jumlah',     val: fmt(amount), cls: selectedType },
      { label: 'Tipe',       val: typeLabel,   cls: selectedType },
      { label: 'Kategori',   val: cat.label },
      { label: 'Tanggal',    val: fmtDate },
      ...($('txNote').value.trim() ? [{ label: 'Catatan', val: $('txNote').value.trim() }] : []),
    ],
    confirmLabel: '✓ Simpan',
    onConfirm: addTransaction,
  });
}

function confirmBudget() {
  const cat   = $('budgetCat').value;
  const limit = parseFloat($('budgetLimit').value);
  const err   = $('budgetError');

  err.textContent = '';
  if (!cat)              return (err.textContent = 'Pilih kategori.');
  if (!limit || limit<=0) return (err.textContent = 'Masukkan batas yang valid.');

  const catObj   = getCat(cat);
  const existing = budgets.find(b => b.category === cat);

  showModal({
    icon: catObj.icon,
    title: existing ? 'Perbarui Anggaran' : 'Konfirmasi Anggaran',
    rows: [
      { label: 'Kategori',      val: catObj.label },
      { label: 'Batas Bulanan', val: fmt(limit), cls: 'accent' },
      ...(existing ? [{ label: 'Batas Lama', val: fmt(existing.limit) }] : []),
    ],
    confirmLabel: existing ? '✓ Perbarui' : '✓ Simpan',
    onConfirm: addBudget,
  });
}

// ============ ADD TX ============
function addTransaction() {
  const name   = $('txName').value.trim();
  const amount = txSpinnerValue;
  const date   = $('txDate').value;
  const note   = $('txNote').value.trim();
  const err    = $('formError');

  err.textContent = '';
  if (!name)              return (err.textContent = 'Keterangan tidak boleh kosong.');
  if (!amount || amount<=0) return (err.textContent = 'Jumlah harus lebih dari 0.');
  if (!date)              return (err.textContent = 'Pilih tanggal.');
  if (!selectedCat)       return (err.textContent = 'Pilih kategori terlebih dahulu.');

  transactions.unshift({ id: Date.now(), name, amount, type: selectedType, category: selectedCat, date, note });
  save();

  // Reset
  $('txName').value = '';
  $('txNote').value = '';
  resetTxSpinner();
  setDefaultDate();
  document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
  selectedCat = '';

  showToast('Transaksi disimpan!', 'success');

  // sync active month to tx date
  const txDate = new Date(date);
  activeMonth = { year: txDate.getFullYear(), month: txDate.getMonth() };
  renderAll();

  // Check budget
  checkBudgetAlert(selectedType === 'expense' ? selectedCat : null, amount);
}

window.deleteTx = function(id) {
  transactions = transactions.filter(t => t.id !== id);
  save();
  renderAll();
  showToast('Transaksi dihapus', 'error');
};

// ============ BUDGET SPINNER ============
let spinnerValue    = 0;
let txSpinnerValue  = 0;

function resetTxSpinner() {
  txSpinnerValue = 0;
  $('txSpinnerNum').value = '';
  $('txAmount').value = 0;
}

function resetSpinner() {
  spinnerValue = 0;
  $('spinnerNum').value = '';
  $('budgetLimit').value = 0;
}

function parseRpInput(str) {
  return parseInt(str.replace(/\D/g, ''), 10) || 0;
}

function initSpinner() {
  // TX amount input
  $('txSpinnerNum').addEventListener('input', e => {
    txSpinnerValue = parseRpInput(e.target.value);
    $('txAmount').value = txSpinnerValue;
  });
  $('txSpi
