// ============================================================
// メインアプリケーションロジック（STEP3）
// ============================================================

const state = {
  prefecture: '',
  city:       '',
  industry:   '',
  page:       1,
  loading:    false,
};

document.addEventListener('DOMContentLoaded', () => {
  initAuth(onUserChange);
  loadFilters();
  loadCompanies();
  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById('btn-login')?.addEventListener('click', signInWithGoogle);
  document.getElementById('btn-logout')?.addEventListener('click', signOut);

  document.getElementById('filter-prefecture')?.addEventListener('change', async (e) => {
    state.prefecture = e.target.value;
    state.city = '';
    state.page = 1;
    await updateCityFilter();
    loadCompanies();
  });

  document.getElementById('filter-city')?.addEventListener('change', (e) => {
    state.city = e.target.value;
    state.page = 1;
    loadCompanies();
  });

  document.getElementById('filter-industry')?.addEventListener('change', (e) => {
    state.industry = e.target.value;
    state.page = 1;
    loadCompanies();
  });

  document.getElementById('btn-reset')?.addEventListener('click', () => {
    state.prefecture = '';
    state.city = '';
    state.industry = '';
    state.page = 1;
    document.getElementById('filter-prefecture').value = '';
    document.getElementById('filter-city').value = '';
    document.getElementById('filter-industry').value = '';
    loadCompanies();
  });
}

function onUserChange(user) {
  const loginBtn  = document.getElementById('btn-login');
  const logoutBtn = document.getElementById('btn-logout');
  const userInfo  = document.getElementById('user-info');
  const planBadge = document.getElementById('plan-badge');

  if (user) {
    loginBtn  && (loginBtn.style.display = 'none');
    logoutBtn && (logoutBtn.style.display = 'inline-block');
    if (userInfo) userInfo.textContent = user.name || user.email;
    if (planBadge) {
      const labels = { free: '無料', early: '早期限定', monthly: '月額', yearly: '年額' };
      planBadge.textContent = labels[user.plan] || '無料';
      planBadge.className = 'plan-badge plan-' + (user.plan || 'free');
    }
  } else {
    loginBtn  && (loginBtn.style.display = 'inline-block');
    logoutBtn && (logoutBtn.style.display = 'none');
    if (userInfo) userInfo.textContent = '';
    if (planBadge) {
      planBadge.textContent = '';
      planBadge.className = 'plan-badge';
    }
  }

  // ユーザー変更でリロード（表示件数が変わる場合があるため）
  loadCompanies();
}

async function loadFilters() {
  try {
    const [prefRes, indRes] = await Promise.all([fetchPrefectures(), fetchIndustries()]);

    const prefSelect = document.getElementById('filter-prefecture');
    if (prefSelect) {
      prefRes.prefectures.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.code;
        opt.textContent = p.name;
        prefSelect.appendChild(opt);
      });
    }

    const indSelect = document.getElementById('filter-industry');
    if (indSelect) {
      indRes.industries.forEach(i => {
        const opt = document.createElement('option');
        opt.value = i.code;
        opt.textContent = i.name;
        indSelect.appendChild(opt);
      });
    }
  } catch (e) {
    console.error('フィルター読み込みエラー:', e);
  }
}

async function updateCityFilter() {
  const citySelect = document.getElementById('filter-city');
  if (!citySelect) return;
  citySelect.innerHTML = '<option value="">市区町村を選択</option>';

  try {
    const res = await fetchCities(state.prefecture);
    res.cities.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.code;
      opt.textContent = c.name;
      citySelect.appendChild(opt);
    });
  } catch (e) {
    console.error('市区町村取得エラー:', e);
  }
}

async function loadCompanies() {
  if (state.loading) return;
  state.loading = true;

  const list    = document.getElementById('company-list');
  const counter = document.getElementById('result-count');
  const pager   = document.getElementById('pagination');
  const freeMsg = document.getElementById('free-limit-msg');

  if (list) list.innerHTML = '<div class="loading">読み込み中...</div>';
  if (freeMsg) freeMsg.style.display = 'none';

  try {
    const res = await fetchCompanies({
      prefecture: state.prefecture,
      city:       state.city,
      industry:   state.industry,
      page:       state.page,
    });

    if (counter) {
      counter.textContent = res.isPaid
        ? `${res.total.toLocaleString()}件`
        : `${Math.min(res.total, 10)}件（全${res.total.toLocaleString()}件中）`;
    }

    if (list) {
      if (res.companies.length === 0) {
        list.innerHTML = '<p class="no-results">該当する企業が見つかりませんでした</p>';
      } else {
        list.innerHTML = res.companies.map(renderCompanyCard).join('');
      }
    }

    renderPagination(pager, res);

    if (res.freeLimitReached && freeMsg) {
      freeMsg.style.display = 'block';
    }
  } catch (e) {
    console.error('企業一覧取得エラー:', e);
    if (list) list.innerHTML = '<p class="error">データの取得に失敗しました。時間をおいて再試行してください。</p>';
  } finally {
    state.loading = false;
  }
}

function renderCompanyCard(company) {
  const phone = company.phone
    ? `<a href="tel:${company.phone}" class="company-phone">${company.phone}</a>`
    : '<span class="no-data">電話番号なし</span>';

  const industry = company.industryName
    ? `<span class="industry-tag">${company.industryName}</span>`
    : '';

  const url = company.url
    ? `<a href="${company.url}" target="_blank" rel="noopener" class="company-url">Webサイト</a>`
    : '';

  return `
    <div class="company-card">
      <div class="company-header">
        <h3 class="company-name">${escHtml(company.name)}</h3>
        ${industry}
      </div>
      <p class="company-furigana">${escHtml(company.furigana)}</p>
      <p class="company-address">
        <span class="icon">📍</span>
        ${escHtml(company.prefecture)}${escHtml(company.city)}${escHtml(company.address)}
      </p>
      <div class="company-footer">
        ${phone}
        ${url}
        <span class="company-kind">${escHtml(company.kind)}</span>
      </div>
    </div>
  `;
}

function renderPagination(container, res) {
  if (!container) return;
  container.innerHTML = '';
  if (res.totalPages <= 1) return;

  const createBtn = (label, page, disabled = false) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.disabled = disabled;
    btn.className = 'page-btn' + (page === res.page ? ' active' : '');
    btn.addEventListener('click', () => {
      state.page = page;
      loadCompanies();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    return btn;
  };

  container.appendChild(createBtn('前へ', res.page - 1, res.page === 1));

  // 最大5ページ分のボタンを表示
  const start = Math.max(1, res.page - 2);
  const end   = Math.min(res.totalPages, start + 4);
  for (let p = start; p <= end; p++) {
    container.appendChild(createBtn(String(p), p));
  }

  container.appendChild(createBtn('次へ', res.page + 1, res.page === res.totalPages));
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
