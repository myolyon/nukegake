// ============================================================
// メインアプリ（バックエンド不要・JSONから直接読み込む）
// ============================================================

const state = {
  prefecture: '',
  city:       '',
  industry:   '',
  page:       1,
  allData:    null,  // companies.json のキャッシュ
};

document.addEventListener('DOMContentLoaded', async () => {
  // Stripe決済後のリダイレクト確認
  handlePaymentReturn();

  await loadData();
  renderFilters();
  renderCompanies();
  setupEvents();
});

// ============================================================
// データ読み込み
// ============================================================
async function loadData() {
  if (state.allData) return;
  try {
    const res = await fetch(CONFIG.DATA_URL);
    state.allData = await res.json();
  } catch (e) {
    console.error('データ読み込み失敗:', e);
    state.allData = { meta: { prefectures: [], cities: [], industries: [] }, companies: [] };
  }
}

// ============================================================
// フィルター描画
// ============================================================
function renderFilters() {
  const { prefectures, cities, industries } = state.allData.meta;

  const prefSel = document.getElementById('filter-prefecture');
  if (prefSel) {
    prefectures.forEach(p => {
      prefSel.appendChild(makeOption(p.code, p.name));
    });
  }

  const indSel = document.getElementById('filter-industry');
  if (indSel) {
    industries.forEach(i => {
      indSel.appendChild(makeOption(i.code, i.name));
    });
  }

  updateCityFilter();
}

function updateCityFilter() {
  const citySel = document.getElementById('filter-city');
  if (!citySel) return;
  citySel.innerHTML = '<option value="">市区町村を選択</option>';

  const cities = state.allData.meta.cities.filter(
    c => !state.prefecture || c.prefCode === state.prefecture
  );
  cities.forEach(c => citySel.appendChild(makeOption(c.code, c.name)));
}

function makeOption(value, text) {
  const opt = document.createElement('option');
  opt.value = value;
  opt.textContent = text;
  return opt;
}

// ============================================================
// イベント設定
// ============================================================
function setupEvents() {
  document.getElementById('filter-prefecture')?.addEventListener('change', e => {
    state.prefecture = e.target.value;
    state.city = '';
    state.page = 1;
    document.getElementById('filter-city').value = '';
    updateCityFilter();
    renderCompanies();
  });

  document.getElementById('filter-city')?.addEventListener('change', e => {
    state.city = e.target.value;
    state.page = 1;
    renderCompanies();
  });

  document.getElementById('filter-industry')?.addEventListener('change', e => {
    state.industry = e.target.value;
    state.page = 1;
    renderCompanies();
  });

  document.getElementById('btn-reset')?.addEventListener('click', () => {
    state.prefecture = '';
    state.city = '';
    state.industry = '';
    state.page = 1;
    document.getElementById('filter-prefecture').value = '';
    document.getElementById('filter-city').value = '';
    document.getElementById('filter-industry').value = '';
    updateCityFilter();
    renderCompanies();
  });
}

// ============================================================
// 企業一覧描画
// ============================================================
function renderCompanies() {
  const paid = isPaid();
  const list    = document.getElementById('company-list');
  const counter = document.getElementById('result-count');
  const pager   = document.getElementById('pagination');
  const freeMsg = document.getElementById('free-limit-msg');
  const adArea  = document.getElementById('ad-area');

  if (!list || !state.allData) return;

  // フィルタリング
  const filtered = state.allData.companies.filter(c => {
    if (state.prefecture && c.prefCode !== state.prefecture) return false;
    if (state.city       && c.cityCode  !== state.city)      return false;
    if (state.industry   && c.industryCode !== state.industry) return false;
    return true;
  });

  const total = filtered.length;

  // 無料は10件まで
  const displayable = paid ? filtered : filtered.slice(0, CONFIG.FREE_LIMIT);
  const totalPages  = Math.ceil(displayable.length / 10);
  const start       = (state.page - 1) * 10;
  const paged       = displayable.slice(start, start + 10);

  // 件数表示
  if (counter) {
    counter.innerHTML = paid
      ? `<strong>${total.toLocaleString()}</strong> 件`
      : `<strong>${Math.min(total, CONFIG.FREE_LIMIT)}</strong> 件（全${total.toLocaleString()}件中）`;
  }

  // 広告（有料ユーザーは非表示）
  if (adArea) adArea.style.display = paid ? 'none' : 'block';

  // 無料制限メッセージ
  if (freeMsg) {
    freeMsg.style.display = (!paid && total > CONFIG.FREE_LIMIT) ? 'block' : 'none';
  }

  // 一覧
  if (paged.length === 0) {
    list.innerHTML = '<p class="no-results">該当する企業が見つかりませんでした</p>';
  } else {
    list.innerHTML = paged.map(renderCard).join('');
  }

  // ページネーション
  renderPagination(pager, state.page, totalPages);
}

function renderCard(c) {
  const phone = c.phone
    ? `<a href="tel:${c.phone}" class="company-phone">${esc(c.phone)}</a>`
    : '<span class="no-data">電話番号なし</span>';

  const tag = c.industryName
    ? `<span class="industry-tag">${esc(c.industryName)}</span>`
    : '';

  return `
    <div class="company-card">
      <div class="company-header">
        <h3 class="company-name">${esc(c.name)}</h3>
        ${tag}
      </div>
      <p class="company-furigana">${esc(c.furigana)}</p>
      <p class="company-address">📍 ${esc(c.prefecture)}${esc(c.city)}${esc(c.address)}</p>
      <div class="company-footer">
        ${phone}
        <span class="company-kind">${esc(c.kind)}</span>
      </div>
    </div>`;
}

function renderPagination(container, page, totalPages) {
  if (!container) return;
  container.innerHTML = '';
  if (totalPages <= 1) return;

  const add = (label, p, disabled) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.disabled = disabled;
    btn.className = 'page-btn' + (p === page ? ' active' : '');
    btn.addEventListener('click', () => {
      state.page = p;
      renderCompanies();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    container.appendChild(btn);
  };

  add('前へ', page - 1, page === 1);
  const s = Math.max(1, page - 2);
  const e = Math.min(totalPages, s + 4);
  for (let p = s; p <= e; p++) add(String(p), p, false);
  add('次へ', page + 1, page === totalPages);
}

// ============================================================
// 有料判定（Stripe Payment後にlocalStorageに保存）
// ============================================================
function isPaid() {
  return localStorage.getItem('nukegake_paid') === '1';
}

function handlePaymentReturn() {
  const params = new URLSearchParams(location.search);
  if (params.get('paid') === '1') {
    localStorage.setItem('nukegake_paid', '1');
    // URLからパラメータを消す
    history.replaceState({}, '', location.pathname);
    // 有料表示を更新
    const badge = document.getElementById('plan-badge');
    if (badge) { badge.textContent = '有料会員'; badge.className = 'plan-badge plan-monthly'; }
  }
}

// ============================================================
// ユーティリティ
// ============================================================
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
