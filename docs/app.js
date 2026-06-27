const DATA_URL = './data/sakai/companies.json';
const FAV_KEY = 'nukegake_favs';
const RECENT_KEY = 'nukegake_recent';
const RECENT_MAX = 20;
const SEARCH_DELAY = 50;

let allCompanies = [];
let currentView = 'all';
let searchQuery = '';
let searchTimer = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadData();
  setupSearch();
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
      trackEvent('search', { query: searchQuery, view: currentView });
      render();
    }, SEARCH_DELAY);
  });

  clear.addEventListener('click', () => {
    input.value = '';
    searchQuery = '';
    clear.classList.remove('visible');
    input.focus();
    render();
  });
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentView = tab.dataset.view;
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
  const companies = getFilteredCompanies();

  if (companies.length === 0) {
    const msg = currentView === 'favorites'
      ? '★ お気に入りはまだありません'
      : currentView === 'recent'
      ? '最近見た企業はありません'
      : '該当する企業が見つかりませんでした';
    results.innerHTML = `<p class="empty">${msg}</p>`;
    return;
  }

  const countHtml = `<p class="result-count">${companies.length.toLocaleString()} 件</p>`;
  const cardsHtml = companies.map(createCardHtml).join('');
  results.innerHTML = countHtml + cardsHtml;

  results.querySelectorAll('.btn-fav').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      toggleFavorite(id);
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
}

function createCardHtml(c) {
  const favs = getFavorites();
  const isFav = favs.includes(c.id);
  const favClass = isFav ? 'btn-fav active' : 'btn-fav';
  const favStar = isFav ? '★' : '☆';

  const telBtn = c.tel
    ? `<a href="tel:${esc(c.tel)}" class="btn-tel" data-id="${c.id}" aria-label="電話する">📞</a>`
    : `<span class="btn-tel no-tel" aria-label="電話番号なし">—</span>`;

  return `
    <div class="company-card">
      <div class="card-info">
        <div class="card-name">${esc(c.name)}</div>
        <div class="card-industry">${esc(c.industry)}</div>
        <div class="card-address">📍 ${esc(c.address)}</div>
      </div>
      <div class="card-actions">
        <button class="${favClass}" data-id="${c.id}" aria-label="お気に入り">${favStar}</button>
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
  if (idx === -1) {
    favs.push(id);
    trackEvent('favorite_add', { company_id: id });
  } else {
    favs.splice(idx, 1);
  }
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
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
