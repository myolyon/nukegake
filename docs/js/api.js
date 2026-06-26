// ============================================================
// GAS APIクライアント
// ============================================================

async function apiCall(action, params = {}) {
  const idToken = await getIdToken();
  const qs = new URLSearchParams({ action, ...(idToken ? { idToken } : {}), ...params });
  const url = CONFIG.GAS_API_URL + '?' + qs.toString();

  const res = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
  });

  if (!res.ok) throw new Error('APIエラー: ' + res.status);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function fetchCompanies({ prefecture = '', city = '', industry = '', page = 1 } = {}) {
  return apiCall('companies', { prefecture, city, industry, page: String(page) });
}

async function fetchPrefectures() {
  return apiCall('prefectures');
}

async function fetchCities(prefecture = '') {
  return apiCall('cities', { prefecture });
}

async function fetchIndustries() {
  return apiCall('industries');
}

async function createCheckoutSession(plan) {
  return apiCall('createCheckout', { plan, baseUrl: CONFIG.BASE_URL });
}
