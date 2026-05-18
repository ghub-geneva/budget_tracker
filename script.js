'use strict';

const MONTHS = ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12'];
const MONTH_LABELS = {
  '2026-01': 'January 2026', '2026-02': 'February 2026', '2026-03': 'March 2026',
  '2026-04': 'April 2026',   '2026-05': 'May 2026',      '2026-06': 'June 2026',
  '2026-07': 'July 2026',    '2026-08': 'August 2026',   '2026-09': 'September 2026',
  '2026-10': 'October 2026', '2026-11': 'November 2026', '2026-12': 'December 2026'
};
const SHORT_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const CATEGORIES = [
  { key: 'bills',         label: 'Bills',              color: '#6366f1' },
  { key: 'debts',         label: 'Debts',              color: '#f59e0b' },
  { key: 'needs',         label: 'Needs',              color: '#10b981' },
  { key: 'wants',         label: 'Wants',              color: '#3b82f6' },
  { key: 'miscellaneous', label: 'Miscellaneous',      color: '#8b5cf6' },
  { key: 'unexpected',    label: 'Unexpected Expenses',color: '#ef4444' }
];

let activeMonth           = '2026-05';
let activeTab             = 'dashboard';
let activeExpenseCategory = 'bills';
let txCategory            = null;
let donutChart            = null;
let trendChart            = null;
let annualOverviewChart   = null;
let annualStackedChart    = null;

// ── Storage ──────────────────────────────────────────────────
function loadData() {
  try { return JSON.parse(localStorage.getItem('budgetTracker2026') || '{}'); }
  catch { return {}; }
}

function saveData(data) {
  localStorage.setItem('budgetTracker2026', JSON.stringify(data));
}

function getMonthData(data, month) {
  if (!data[month]) {
    data[month] = {
      income: { main15: 0, main30: 0, graphics15: 0, graphics30: 0, municipal15: 0, municipal30: 0, additional: [] },
      expenses: { bills: [], debts: [], needs: [], wants: [], miscellaneous: [], unexpected: [] }
    };
  }
  return data[month];
}

// ── Calculations ─────────────────────────────────────────────
function totalIncome(md) {
  const i = md.income;
  const base = [i.main15, i.main30, i.graphics15, i.graphics30, i.municipal15, i.municipal30]
    .reduce((s, v) => s + (+v || 0), 0);
  const extra = (i.additional || []).reduce((s, f) => s + (+f.amount || 0), 0);
  return base + extra;
}

function categoryTotal(md, key) {
  return (md.expenses[key] || []).reduce((s, tx) => s + (+tx.amount || 0), 0);
}

function totalExpenses(md) {
  return CATEGORIES.reduce((s, c) => s + categoryTotal(md, c.key), 0);
}

// ── Formatting ────────────────────────────────────────────────
function fmt(n) {
  return '₱' + (+n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[+parts[1]-1]} ${+parts[2]}`;
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2400);
}

// ── Render ────────────────────────────────────────────────────
function render() {
  const data = loadData();
  const md   = getMonthData(data, activeMonth);
  const label = MONTH_LABELS[activeMonth];

  document.querySelectorAll('.month-badge').forEach(el => el.textContent = label);
  document.getElementById('monthSelect').value = activeMonth;

  if (activeTab === 'dashboard') renderDashboard(data, md);
  if (activeTab === 'income')    renderIncome(md);
  if (activeTab === 'expenses')  renderExpenses(md);
  if (activeTab === 'summary')   renderSummary(data);
}

// ── Dashboard ─────────────────────────────────────────────────
function renderDashboard(data, md) {
  const inc  = totalIncome(md);
  const exp  = totalExpenses(md);
  const net  = inc - exp;

  document.getElementById('totalIncome').textContent   = fmt(inc);
  document.getElementById('totalExpenses').textContent = fmt(exp);
  const netEl = document.getElementById('netBalance');
  netEl.textContent = fmt(net);
  netEl.className   = 'card-value ' + (net >= 0 ? 'positive' : 'negative');

  // Category progress bars
  const prog = document.getElementById('categoryProgress');
  prog.innerHTML = '';
  CATEGORIES.forEach(c => {
    const total = categoryTotal(md, c.key);
    const pct   = exp > 0 ? Math.min(100, total / exp * 100) : 0;
    prog.innerHTML += `
      <div class="progress-row">
        <div class="progress-label">
          <span class="dot" style="background:${c.color}"></span>
          <span>${c.label}</span>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar" style="width:${pct.toFixed(1)}%;background:${c.color}"></div>
        </div>
        <span class="progress-amount">${fmt(total)}</span>
      </div>`;
  });

  renderDonut(md, exp);
  renderTrend(data);
}

function renderDonut(md, exp) {
  const vals = CATEGORIES.map(c => categoryTotal(md, c.key));
  const hasData = vals.some(v => v > 0);

  if (donutChart) { donutChart.destroy(); donutChart = null; }

  donutChart = new Chart(document.getElementById('expenseDonut').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: CATEGORIES.map(c => c.label),
      datasets: [{
        data: hasData ? vals : [1],
        backgroundColor: hasData ? CATEGORIES.map(c => c.color) : ['#e2e8f0'],
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 14, font: { size: 11 }, usePointStyle: true, pointStyleWidth: 8, color: '#94a3b8' }
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const val = ctx.parsed;
              const pct = exp > 0 ? (val / exp * 100).toFixed(1) : 0;
              return ` ${fmt(val)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function renderTrend(data) {
  const incomes   = MONTHS.map(m => totalIncome(getMonthData(data, m)));
  const expenses  = MONTHS.map(m => totalExpenses(getMonthData(data, m)));

  if (trendChart) { trendChart.destroy(); trendChart = null; }

  trendChart = new Chart(document.getElementById('monthlyTrend').getContext('2d'), {
    type: 'bar',
    data: {
      labels: SHORT_LABELS,
      datasets: [
        { label: 'Income',   data: incomes,  backgroundColor: '#10b981', borderRadius: 5, borderSkipped: false },
        { label: 'Expenses', data: expenses, backgroundColor: '#ef4444', borderRadius: 5, borderSkipped: false }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, pointStyleWidth: 10, font: { size: 12 }, color: '#94a3b8' } },
        tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.parsed.y)}` } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: v => '₱' + v.toLocaleString('en-PH'), color: '#64748b' }, grid: { color: '#1e293b' } },
        x: { grid: { display: false }, ticks: { color: '#64748b' } }
      }
    }
  });
}

// ── Income ────────────────────────────────────────────────────
function renderIncome(md) {
  const i = md.income;
  document.getElementById('main15').value      = i.main15      || '';
  document.getElementById('main30').value      = i.main30      || '';
  document.getElementById('graphics15').value  = i.graphics15  || '';
  document.getElementById('graphics30').value  = i.graphics30  || '';
  document.getElementById('municipal15').value = i.municipal15 || '';
  document.getElementById('municipal30').value = i.municipal30 || '';
  renderAdditionalFunds(md);
  updateIncomeFooter(md);
}

function renderAdditionalFunds(md) {
  const list = document.getElementById('additionalFundsList');
  const funds = md.income.additional || [];
  if (funds.length === 0) {
    list.innerHTML = '<p class="empty-msg">No additional funds added.</p>';
    return;
  }
  list.innerHTML = funds.map((f, i) => `
    <div class="fund-item">
      <span class="fund-name">${escHtml(f.name)}</span>
      <span class="fund-amount">${fmt(f.amount)}</span>
      <button class="btn-icon remove-fund" data-index="${i}" title="Remove">&#x2715;</button>
    </div>`).join('');
}

function updateIncomeFooter(md) {
  const base = ['main15','main30','graphics15','graphics30','municipal15','municipal30']
    .reduce((s, id) => s + (+document.getElementById(id).value || 0), 0);
  const extra = (md.income.additional || []).reduce((s, f) => s + (+f.amount || 0), 0);
  document.getElementById('incomePageTotal').textContent = fmt(base + extra);
}

// ── Expenses ──────────────────────────────────────────────────
function renderExpenses(md) {
  const container = document.getElementById('expenseCategories');

  // Build tab bar + single category panel
  const tabsHtml = CATEGORIES.map(c => {
    const txs   = md.expenses[c.key] || [];
    const total = txs.reduce((s, tx) => s + (+tx.amount || 0), 0);
    const isActive = c.key === activeExpenseCategory;
    return `
      <button class="cat-tab${isActive ? ' active' : ''}" data-cat="${c.key}" style="--cat-color:${c.color}">
        <span class="cat-tab-dot" style="background:${c.color}"></span>
        <span class="cat-tab-label">${c.label}</span>
        <span class="cat-tab-total">${fmt(total)}</span>
      </button>`;
  }).join('');

  const grandTotal = CATEGORIES.reduce((s, cat) => {
    return s + (md.expenses[cat.key] || []).reduce((ss, tx) => ss + (+tx.amount || 0), 0);
  }, 0);

  const c    = CATEGORIES.find(c => c.key === activeExpenseCategory);
  const txs  = (md.expenses[c.key] || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const total = txs.reduce((s, tx) => s + (+tx.amount || 0), 0);
  const txHtml = txs.length === 0
    ? '<p class="empty-msg">No transactions yet.</p>'
    : txs.map((tx, i) => `
        <div class="tx-item">
          <span class="tx-date">${fmtDate(tx.date)}</span>
          <span class="tx-particular">${escHtml(tx.particular)}</span>
          <span class="tx-amount">${fmt(tx.amount)}</span>
          <button class="btn-icon remove-tx" data-cat="${c.key}" data-idx="${i}" title="Remove">&#x2715;</button>
        </div>`).join('');

  container.innerHTML = `
    <div class="expenses-topbar">
      <div class="cat-tabs">${tabsHtml}</div>
      <div class="expenses-grand-total">
        <span class="expenses-grand-label">Total Expenses</span>
        <span class="expenses-grand-amount">${fmt(grandTotal)}</span>
      </div>
    </div>
    <div class="category-section">
      <div class="category-header" style="border-left:4px solid ${c.color}">
        <div class="category-header-left">
          <span class="category-title">${c.label}</span>
          <span class="category-total">${fmt(total)} &mdash; ${txs.length} item${txs.length !== 1 ? 's' : ''}</span>
        </div>
        <button class="btn-add-tx" data-cat="${c.key}">+ Add</button>
      </div>
      <div class="tx-list">${txHtml}</div>
    </div>`;
}

// ── Annual Summary ────────────────────────────────────────────
function renderSummary(data) {
  const incomeVals = MONTHS.map(m => totalIncome(getMonthData(data, m)));
  const expVals    = MONTHS.map(m => totalExpenses(getMonthData(data, m)));
  const netVals    = MONTHS.map((_, i) => incomeVals[i] - expVals[i]);

  // Chart 1: Grouped bar (income vs expenses) + net line
  if (annualOverviewChart) { annualOverviewChart.destroy(); annualOverviewChart = null; }
  annualOverviewChart = new Chart(
    document.getElementById('annualOverviewChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: SHORT_LABELS,
      datasets: [
        { label: 'Income',   data: incomeVals, backgroundColor: 'rgba(52,211,153,0.75)', borderRadius: 5, borderSkipped: false, order: 2 },
        { label: 'Expenses', data: expVals,    backgroundColor: 'rgba(248,113,113,0.75)', borderRadius: 5, borderSkipped: false, order: 2 },
        {
          label: 'Net Balance', data: netVals, type: 'line', order: 1,
          borderColor: '#a5b4fc', backgroundColor: 'rgba(165,180,252,0.1)',
          borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#a5b4fc',
          pointHoverRadius: 6, tension: 0.35, fill: true, yAxisID: 'y'
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { color: '#94a3b8', usePointStyle: true, pointStyleWidth: 10, font: { size: 12 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: '#1e293b' }, ticks: { color: '#64748b', callback: v => '₱' + v.toLocaleString('en-PH') } },
        x: { grid: { display: false }, ticks: { color: '#64748b' } }
      }
    }
  });

  // Chart 2: Stacked bar — expense categories per month
  if (annualStackedChart) { annualStackedChart.destroy(); annualStackedChart = null; }
  annualStackedChart = new Chart(
    document.getElementById('annualStackedChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: SHORT_LABELS,
      datasets: CATEGORIES.map(c => ({
        label: c.label,
        data: MONTHS.map(m => categoryTotal(getMonthData(data, m), c.key)),
        backgroundColor: c.color + 'cc',
        borderColor: c.color,
        borderWidth: 0,
        borderRadius: 3,
        borderSkipped: false
      }))
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { color: '#94a3b8', usePointStyle: true, pointStyleWidth: 10, font: { size: 12 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } }
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: '#64748b' } },
        y: { stacked: true, beginAtZero: true, grid: { color: '#1e293b' }, ticks: { color: '#64748b', callback: v => '₱' + v.toLocaleString('en-PH') } }
      }
    }
  });

  // Table
  const tbody   = document.getElementById('annualTableBody');
  const incomeSum = incomeVals.reduce((s, v) => s + v, 0);
  const expSum    = expVals.reduce((s, v) => s + v, 0);
  const netSum    = netVals.reduce((s, v) => s + v, 0);
  tbody.innerHTML = '';

  tbody.innerHTML += `<tr class="row-income"><td>Income</td>${incomeVals.map(v => `<td>${fmt(v)}</td>`).join('')}<td>${fmt(incomeSum)}</td></tr>`;

  CATEGORIES.forEach(c => {
    const vals = MONTHS.map(m => categoryTotal(getMonthData(data, m), c.key));
    const sum  = vals.reduce((s, v) => s + v, 0);
    tbody.innerHTML += `<tr>
      <td><span class="dot" style="background:${c.color};margin-right:6px"></span>${c.label}</td>
      ${vals.map(v => `<td>${v > 0 ? fmt(v) : '<span style="color:#334155">—</span>'}</td>`).join('')}
      <td>${sum > 0 ? fmt(sum) : '<span style="color:#334155">—</span>'}</td>
    </tr>`;
  });

  tbody.innerHTML += `<tr class="row-total"><td>Total Expenses</td>${expVals.map(v => `<td>${fmt(v)}</td>`).join('')}<td>${fmt(expSum)}</td></tr>`;
  tbody.innerHTML += `<tr class="row-net"><td>Net Balance</td>${netVals.map(v => `<td class="${v >= 0 ? 'positive' : 'negative'}">${fmt(v)}</td>`).join('')}<td class="${netSum >= 0 ? 'positive' : 'negative'}">${fmt(netSum)}</td></tr>`;
}

// ── Modals ────────────────────────────────────────────────────
function openTxModal(catKey) {
  txCategory = catKey;
  const cat  = CATEGORIES.find(c => c.key === catKey);
  document.getElementById('txModalTitle').textContent = `Add to ${cat.label}`;
  document.getElementById('txDate').value       = '';
  document.getElementById('txParticular').value = '';
  document.getElementById('txAmount').value     = '';
  document.getElementById('txModalOverlay').classList.add('open');
  setTimeout(() => document.getElementById('txParticular').focus(), 60);
}

function closeTxModal() {
  document.getElementById('txModalOverlay').classList.remove('open');
  txCategory = null;
}

function saveTx() {
  if (!txCategory) return;
  const date       = document.getElementById('txDate').value;
  const particular = document.getElementById('txParticular').value.trim();
  const amount     = parseFloat(document.getElementById('txAmount').value);

  if (!particular) { document.getElementById('txParticular').focus(); return; }
  if (!amount || amount <= 0) { document.getElementById('txAmount').focus(); return; }

  const data = loadData();
  const md   = getMonthData(data, activeMonth);
  md.expenses[txCategory].push({ date, particular, amount });
  saveData(data);
  closeTxModal();
  render();
  showToast('Transaction added');
}

function openFundModal() {
  document.getElementById('fundName').value   = '';
  document.getElementById('fundAmount').value = '';
  document.getElementById('fundModalOverlay').classList.add('open');
  setTimeout(() => document.getElementById('fundName').focus(), 60);
}

function closeFundModal() {
  document.getElementById('fundModalOverlay').classList.remove('open');
}

function saveFund() {
  const name   = document.getElementById('fundName').value.trim();
  const amount = parseFloat(document.getElementById('fundAmount').value);
  if (!name)                { document.getElementById('fundName').focus(); return; }
  if (!amount || amount <= 0) { document.getElementById('fundAmount').focus(); return; }

  const data = loadData();
  const md   = getMonthData(data, activeMonth);
  md.income.additional.push({ name, amount });
  saveData(data);
  closeFundModal();
  render();
  showToast('Fund added');
}

// ── Utilities ─────────────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Seed Data ─────────────────────────────────────────────────
function seedData() {
  const existing = localStorage.getItem('budgetTracker2026');
  if (existing && existing !== '{}') return;
  const seed = {
    '2026-05': {
      income: {
        main15: 0, main30: 0, graphics15: 0, graphics30: 0,
        municipal15: 12687, municipal30: 0,
        additional: [{ name: 'Additional Funds', amount: 17500 }]
      },
      expenses: {
        bills: [
          { date: '2026-05-11', particular: 'Car Maintenance', amount: 17500 },
          { date: '2026-05-12', particular: 'Gas', amount: 2478 },
          { date: '2026-05-13', particular: 'Claude Pro', amount: 1378.74 },
          { date: '2026-05-13', particular: 'Namecheap Domain Renewal', amount: 1161.25 }
        ],
        debts: [
          { date: '2026-05-06', particular: 'Egg', amount: 560 },
          { date: '2026-05-12', particular: 'Shopee Spaylater', amount: 3302.47 }
        ],
        needs: [
          { date: '2026-05-04', particular: 'Sack of Rice', amount: 2700 },
          { date: '2026-05-04', particular: 'Laundry', amount: 750 },
          { date: '2026-05-04', particular: 'Bread', amount: 30 },
          { date: '2026-05-06', particular: 'Breakfast', amount: 500 },
          { date: '2026-05-06', particular: 'Buttaine', amount: 400 },
          { date: '2026-05-06', particular: 'Zonrox/Downy', amount: 600 },
          { date: '2026-05-07', particular: 'Lunch', amount: 500 },
          { date: '2026-05-08', particular: 'Dinner', amount: 803 },
          { date: '2026-05-09', particular: 'Breakfast', amount: 253 },
          { date: '2026-05-09', particular: 'Water Bottle', amount: 220 },
          { date: '2026-05-09', particular: 'Dinner', amount: 500 },
          { date: '2026-05-10', particular: "Food (Mother's Day)", amount: 1525 },
          { date: '2026-05-11', particular: 'Lunch', amount: 60 },
          { date: '2026-05-11', particular: 'Fare', amount: 100 },
          { date: '2026-05-11', particular: 'Dinner', amount: 272 },
          { date: '2026-05-12', particular: 'Lunch', amount: 223 },
          { date: '2026-05-12', particular: 'Others', amount: 141 },
          { date: '2026-05-12', particular: 'Dinner', amount: 172 },
          { date: '2026-05-13', particular: 'Breakfast', amount: 70 },
          { date: '2026-05-14', particular: 'Food', amount: 444 },
          { date: '2026-05-14', particular: 'Laundry', amount: 750 },
          { date: '2026-05-14', particular: 'Groceries', amount: 436.50 },
          { date: '2026-05-15', particular: 'Food', amount: 191 }
        ],
        wants: [
          { date: '2026-05-04', particular: 'Mixed Nuts', amount: 200 },
          { date: '2026-05-04', particular: 'Midnight Snacks', amount: 130 },
          { date: '2026-05-05', particular: '7/11', amount: 618 },
          { date: '2026-05-06', particular: 'Milktea', amount: 328 },
          { date: '2026-05-07', particular: 'Snacks', amount: 300 },
          { date: '2026-05-07', particular: '7/11 Store', amount: 538 },
          { date: '2026-05-08', particular: 'Snacks', amount: 300 },
          { date: '2026-05-10', particular: '7/11 (Ice Cream)', amount: 468 },
          { date: '2026-05-11', particular: 'Snacks', amount: 30 },
          { date: '2026-05-13', particular: 'Snacks', amount: 250 },
          { date: '2026-05-15', particular: 'Snacks', amount: 110 }
        ],
        miscellaneous: [
          { date: '2026-05-04', particular: 'Load (Sis)', amount: 53 },
          { date: '2026-05-05', particular: 'Papa Odet Allowance', amount: 1000 },
          { date: '2026-05-06', particular: 'John Allowance', amount: 800 },
          { date: '2026-05-07', particular: 'Massage', amount: 860 },
          { date: '2026-05-08', particular: 'John (VB)', amount: 1000 },
          { date: '2026-05-08', particular: 'Trapo', amount: 500 },
          { date: '2026-05-09', particular: "Mother's Day Gift", amount: 5000 },
          { date: '2026-05-09', particular: 'Load (Sis)', amount: 89 },
          { date: '2026-05-09', particular: 'John (Borrow)', amount: 1500 },
          { date: '2026-05-10', particular: 'Ninang Gift for Harold (Ebeb)', amount: 1500 },
          { date: '2026-05-10', particular: 'Church Offering', amount: 200 },
          { date: '2026-05-11', particular: 'John Allowance', amount: 500 },
          { date: '2026-05-12', particular: 'Kirsty Allowance', amount: 1500 },
          { date: '2026-05-13', particular: 'John (Allowance)', amount: 200 },
          { date: '2026-05-13', particular: 'John (Borrow)', amount: 1000 },
          { date: '2026-05-14', particular: 'Massage', amount: 860 },
          { date: '2026-05-15', particular: 'Misc/7-11', amount: 400 }
        ],
        unexpected: [
          { date: '2026-05-07', particular: 'Volleyball', amount: 400 },
          { date: '2026-05-08', particular: 'Beauty Care', amount: 4000 },
          { date: '2026-05-11', particular: "Papa Odet's Check-up", amount: 2400 },
          { date: '2026-05-11', particular: 'VB For Fun', amount: 1000 }
        ]
      }
    }
  };
  localStorage.setItem('budgetTracker2026', JSON.stringify(seed));
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  seedData();

  const TAB_TITLES = { dashboard: 'Dashboard', income: 'Income', expenses: 'Expenses', summary: 'Annual Summary', admin: 'Admin' };

  // Tab navigation
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.tab-content').forEach(s => s.classList.toggle('active', s.id === `tab-${activeTab}`));
      document.getElementById('topbarTitle').textContent = TAB_TITLES[activeTab] || '';
      render();
    });
  });

  // Month selector
  document.getElementById('monthSelect').addEventListener('change', e => {
    activeMonth = e.target.value;
    render();
  });

  // Income live total
  ['main15','main30','graphics15','graphics30','municipal15','municipal30'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      const data = loadData();
      updateIncomeFooter(getMonthData(data, activeMonth));
    });
  });

  // Save income
  document.getElementById('saveIncomeBtn').addEventListener('click', () => {
    const data = loadData();
    const md   = getMonthData(data, activeMonth);
    ['main15','main30','graphics15','graphics30','municipal15','municipal30'].forEach(id => {
      md.income[id] = +document.getElementById(id).value || 0;
    });
    saveData(data);
    render();
    showToast('Income saved');
  });

  // Add fund button
  document.getElementById('addFundBtn').addEventListener('click', openFundModal);
  document.getElementById('fundModalClose').addEventListener('click', closeFundModal);
  document.getElementById('fundModalCancel').addEventListener('click', closeFundModal);
  document.getElementById('fundModalSave').addEventListener('click', saveFund);
  document.getElementById('fundModalOverlay').addEventListener('click', e => {
    if (e.target.id === 'fundModalOverlay') closeFundModal();
  });
  document.getElementById('fundAmount').addEventListener('keydown', e => { if (e.key === 'Enter') saveFund(); });

  // Remove fund (delegation)
  document.getElementById('additionalFundsList').addEventListener('click', e => {
    const btn = e.target.closest('.remove-fund');
    if (!btn) return;
    const data = loadData();
    const md   = getMonthData(data, activeMonth);
    md.income.additional.splice(+btn.dataset.index, 1);
    saveData(data);
    render();
    showToast('Fund removed');
  });

  // Transaction modal
  document.getElementById('txModalClose').addEventListener('click', closeTxModal);
  document.getElementById('txModalCancel').addEventListener('click', closeTxModal);
  document.getElementById('txModalSave').addEventListener('click', saveTx);
  document.getElementById('txModalOverlay').addEventListener('click', e => {
    if (e.target.id === 'txModalOverlay') closeTxModal();
  });
  document.getElementById('txAmount').addEventListener('keydown', e => { if (e.key === 'Enter') saveTx(); });

  // Expense actions (delegation)
  document.getElementById('expenseCategories').addEventListener('click', e => {
    const tab = e.target.closest('.cat-tab');
    if (tab) { activeExpenseCategory = tab.dataset.cat; render(); return; }

    const addBtn = e.target.closest('.btn-add-tx');
    if (addBtn) { openTxModal(addBtn.dataset.cat); return; }

    const removeBtn = e.target.closest('.remove-tx');
    if (removeBtn) {
      const data = loadData();
      const md   = getMonthData(data, activeMonth);
      md.expenses[removeBtn.dataset.cat].splice(+removeBtn.dataset.idx, 1);
      saveData(data);
      render();
      showToast('Transaction removed');
    }
  });

  // Admin sub-tabs
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.toggle('active', p.id === `admin-${btn.dataset.admin}`));
    });
  });

  // Keyboard: Escape closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeTxModal(); closeFundModal(); }
  });

  render();
});
