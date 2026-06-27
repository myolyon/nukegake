// ============================================================
// メインアプリ（バックエンド不要・JSONから直接読み込む）
// ============================================================

const state = {
  prefecture: '',
  city:       '',
  industry:   '',
  page:       1,
  allData:    null,
};

document.addEventListener('DOMContentLoaded', async () => {
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
    prefectures.forEach(p => prefSel.appendChild(makeOption(p.code, p.name)));
  }

  const indSel = document.getElementById('filter-industry');
  if (indSel) {
    industries.forEach(i => indSel.appendChild(makeOption(i.code, i.name)));
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
  const list    = document.getElementById('company-list');
  const counter = document.getElementById('result-count');
  const pager   = document.getElementById('pagination');

  if (!list || !state.allData) return;

  const filtered = state.allData.companies.filter(c => {
    if (state.prefecture && c.prefCode     !== state.prefecture) return false;
    if (state.city       && c.cityCode     !== state.city)       return false;
    if (state.industry   && c.industryCode !== state.industry)   return false;
    return true;
  });

  const total      = filtered.length;
  const totalPages = Math.ceil(total / CONFIG.PER_PAGE);
  const start      = (state.page - 1) * CONFIG.PER_PAGE;
  const paged      = filtered.slice(start, start + CONFIG.PER_PAGE);

  if (counter) {
    counter.innerHTML = `<strong>${total.toLocaleString()}</strong> 件`;
  }

  if (paged.length === 0) {
    list.innerHTML = '<p class="no-results">該当する企業が見つかりませんでした</p>';
  } else {
    const parts = [];
    paged.forEach((c, i) => {
      parts.push(renderCard(c));
      // 5件ごとに矩形広告を挿入（最後の企業の後は除く）
      if ((i + 1) % 5 === 0 && i + 1 < paged.length) {
        parts.push(`
          <div class="ad-slot ad-rectangle">
            <ins class="adsbygoogle"
                 style="display:block"
                 data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
                 data-ad-slot="XXXXXXXXXX"
                 data-ad-format="rectangle"
                 data-full-width-responsive="false"></ins>
          </div>`);
      }
    });
    list.innerHTML = parts.join('');
    // AdSense初期化（動的挿入後）
    list.querySelectorAll('.adsbygoogle').forEach(() => {
      try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    });
  }

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
// ユーティリティ
// ============================================================
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
