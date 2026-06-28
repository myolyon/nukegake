const DATA_URL = './data/sakai/companies.json';
const FAV_KEY = 'nukegake_favs';
const RECENT_KEY = 'nukegake_recent';
const RECENT_MAX = 20;
const SEARCH_DELAY = 50;
const PAGE_SIZE = 20;

let allCompanies = [];
let currentView = 'all';
let searchQuery = '';
let industryFilter = '';
let currentPage = 1;
let searchTimer = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadData();
  setupSearch();
  setupIndustryFilters();
  setupTabs();
  render();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
}

async function loadData() {
  try {
    const res = await fetch(DATA_URL);
    allCompanies = await res.json();
  } catch (e) {
    allCompanies = [];
    console.error('データ読み込み失敗:', e);
  }
}

function setupSearch() {
  const input = document.getElementById('search-input');
  const clear = document.getElementById('search-clear');

  input.addEventListener('input', () => {
    searchQuery = input.value;
    clear.classList.toggle('visible', searchQuery.length > 0);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      currentPage = 1;
      trackEvent('search', { query: searchQuery, view: currentView });
      render();
    }, SEARCH_DELAY);
  });

  clear.addEventListener('click', () => {
    input.value = '';
    searchQuery = '';
    clear.classList.remove('visible');
    currentPage = 1;
    input.focus();
    render();
  });
}

function setupIndustryFilters() {
  document.querySelectorAll('.industry-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.industry-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      industryFilter = chip.dataset.industry;
      currentPage = 1;
      render();
    });
  });
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentView = tab.dataset.view;
      currentPage = 1;
      render();
    });
  });
}

function getFilteredCompanies() {
  let list;
  if (currentView === 'favorites') {
    const favs = getFavorites();
    list = allCompanies.filter(c => favs.includes(c.id));
  } else if (currentView === 'recent') {
    const recent = getRecent();
    list = recent.map(id => allCompanies.find(c => c.id === id)).filter(Boolean);
  } else {
    list = allCompanies;
  }

  if (industryFilter) {
    list = list.filter(c => c.industry === industryFilter);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    list = list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.industry.toLowerCase().includes(q)
    );
  }

  return list;
}

function render() {
  const results = document.getElementById('results');
  const paginationEl = document.getElementById('pagination');
  const companies = getFilteredCompanies();
  const total = companies.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (currentPage > totalPages) currentPage = totalPages;

  if (total === 0) {
    const msg = currentView === 'favorites'
      ? '★ お気に入りはまだありません'
      : currentView === 'recent'
      ? '最近見た企業はありません'
      : '該当する企業が見つかりませんでした';
    results.innerHTML = `<p class="empty">${msg}</p>`;
    paginationEl.innerHTML = '';
    return;
  }

  const start = (currentPage - 1) * PAGE_SIZE;
  const paged = companies.slice(start, start + PAGE_SIZE);

  const countHtml = `<p class="result-count">${total.toLocaleString()} 件</p>`;
  const cardsHtml = paged.map(createCardHtml).join('');
  results.innerHTML = countHtml + cardsHtml;

  results.querySelectorAll('.btn-fav').forEach(btn => {
    btn.addEventListener('click', () => {
      toggleFavorite(Number(btn.dataset.id));
      render();
    });
  });

  results.querySelectorAll('.btn-tel[href]').forEach(link => {
    link.addEventListener('click', () => {
      const id = Number(link.dataset.id);
      const company = allCompanies.find(c => c.id === id);
      addToRecent(id);
      trackEvent('tel_click', { company_name: company ? company.name : '', industry: company ? company.industry : '' });
    });
  });

  renderPagination(paginationEl, currentPage, totalPages);
}

function renderPagination(el, page, totalPages) {
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  const prev = `<button class="page-btn" id="pg-prev" ${page === 1 ? 'disabled' : ''}>前へ</button>`;
  const info = `<span class="page-info">${page} / ${totalPages}</span>`;
  const next = `<button class="page-btn" id="pg-next" ${page === totalPages ? 'disabled' : ''}>次へ</button>`;
  el.innerHTML = prev + info + next;
  el.querySelector('#pg-prev')?.addEventListener('click', () => {
    currentPage--; render(); window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  el.querySelector('#pg-next')?.addEventListener('click', () => {
    currentPage++; render(); window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function createCardHtml(c) {
  const isFav = getFavorites().includes(c.id);
  const favStar = isFav ? '★' : '☆';

  let telBtn;
  if (c.isTelAvailable !== false && c.tel) {
    telBtn = `<a href="tel:${esc(c.tel)}" class="btn-tel" data-id="${c.id}" aria-label="電話する">📞</a>`;
  } else {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(c.name)}`;
    const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(c.address || c.name)}`;
    telBtn = `<div class="no-tel-actions">
      <a href="${searchUrl}" class="btn-action btn-web" target="_blank" rel="noopener noreferrer" aria-label="Web検索">🔍</a>
      <a href="${mapUrl}" class="btn-action btn-map" target="_blank" rel="noopener noreferrer" aria-label="地図を開く">📍</a>
    </div>`;
  }

  return `
    <div class="company-card">
      <div class="card-info">
        <div class="card-name">${esc(c.name)}</div>
        <div class="card-industry">${esc(c.industry)}</div>
        <div class="card-address">📍 ${esc(c.address)}</div>
      </div>
      <div class="card-actions">
        <button class="btn-fav${isFav ? ' active' : ''}" data-id="${c.id}" aria-label="お気に入り">${favStar}</button>
        ${telBtn}
      </div>
    </div>`;
}

function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch (e) { return []; }
}

function toggleFavorite(id) {
  const favs = getFavorites();
  const idx = favs.indexOf(id);
  if (idx === -1) { favs.push(id); trackEvent('favorite_add', { company_id: id }); }
  else { favs.splice(idx, 1); }
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
}

function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { return []; }
}

function addToRecent(id) {
  let recent = getRecent().filter(x => x !== id);
  recent.unshift(id);
  if (recent.length > RECENT_MAX) recent = recent.slice(0, RECENT_MAX);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

function trackEvent(name, params) {
  if (typeof gtag === 'function') gtag('event', name, params);
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
