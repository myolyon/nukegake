// ============================================================
// Web APIエンドポイント
// GASをWebアプリとしてデプロイし、フロントエンドからAPIを呼び出す
//
// GET  ?action=companies&prefecture=27&city=27141&industry=01&page=1&idToken=xxx
// GET  ?action=prefectures
// GET  ?action=cities&prefecture=27
// GET  ?action=login&idToken=xxx
// GET  ?action=createCheckout&plan=monthly&idToken=xxx
// POST Stripe Webhook
// ============================================================

function doGet(e) {
  const params = e.parameter || {};
  const action  = params.action || 'companies';
  const idToken = params.idToken || '';

  try {
    let result;

    switch (action) {
      case 'companies':
        result = apiGetCompanies(params, idToken);
        break;
      case 'prefectures':
        result = apiGetPrefectures();
        break;
      case 'cities':
        result = apiGetCities(params.prefecture);
        break;
      case 'industries':
        result = apiGetIndustries();
        break;
      case 'login':
        result = apiLogin(idToken);
        break;
      case 'createCheckout':
        result = apiCreateCheckout(params, idToken);
        break;
      default:
        result = { error: '不明なアクション: ' + action };
    }

    return jsonResponse(result);
  } catch (err) {
    Logger.log('doGet error: ' + err.message);
    return jsonResponse({ error: err.message }, 500);
  }
}

function doPost(e) {
  try {
    const rawBody  = e.postData.contents;
    const signature = e.parameter['stripe-signature'] ||
                      (e.headers && e.headers['Stripe-Signature']) || '';

    handleStripeWebhook(rawBody, signature);
    return jsonResponse({ received: true });
  } catch (err) {
    Logger.log('doPost error: ' + err.message);
    return jsonResponse({ error: err.message }, 400);
  }
}

// ============================================================
// 企業一覧取得（STEP3）
// ============================================================
function apiGetCompanies(params, idToken) {
  const config  = getConfig();
  const ss      = SpreadsheetApp.openById(config.SPREADSHEET_ID);

  // ログインユーザーのプランを確認
  let user = null;
  if (idToken) {
    const userInfo = verifyFirebaseToken(idToken);
    if (userInfo) user = getUserByEmail(userInfo.email);
  }

  const isPaid = user && user.plan !== PLAN.FREE && isPlanActive(user);

  // アクティブな都道府県・市区町村のみ
  const activePrefectures = getActivePrefectures(ss);
  const activeCities      = getActiveCities(ss);

  const companySheet = ss.getSheetByName(SHEET.COMPANY);
  const data = companySheet.getDataRange().getValues();

  // フィルタリング
  const prefCode  = params.prefecture || '';
  const cityCode  = params.city || '';
  const induCode  = params.industry || '';

  const filtered = data.slice(1).filter(row => {
    if (!row[0]) return false; // 空行スキップ

    const pref = String(row[4]);
    const city = String(row[5]);

    // activeエリアのみ表示
    if (!activePrefectures.has(pref)) return false;
    if (!activeCities.has(city)) return false;

    if (prefCode && pref !== prefCode) return false;
    if (cityCode && city !== cityCode) return false;
    if (induCode && String(row[10]) !== induCode) return false;

    return true;
  });

  const total = filtered.length;

  // 無料プランは10件まで
  const limit    = isPaid ? 10 : FREE_LIMIT;
  const page     = Math.max(1, parseInt(params.page || '1'));
  const pageSize = 10;

  // 無料ユーザーは最大10件、ページ送り不可
  const displayable = isPaid ? filtered : filtered.slice(0, FREE_LIMIT);
  const totalPages  = Math.ceil(displayable.length / pageSize);
  const start       = (page - 1) * pageSize;
  const paged       = displayable.slice(start, start + pageSize);

  const companies = paged.map(row => ({
    corporateNo:  row[0],
    name:         row[1],
    furigana:     row[2],
    kind:         row[3],
    prefCode:     row[4],
    cityCode:     row[5],
    prefecture:   row[6],
    city:         row[7],
    address:      row[8],
    phone:        row[9],
    industryCode: row[10],
    industryName: row[11],
    url:          row[12],
  }));

  return {
    companies,
    total,
    displayableTotal: displayable.length,
    page,
    pageSize,
    totalPages,
    isPaid,
    freeLimitReached: !isPaid && total > FREE_LIMIT,
  };
}

// ============================================================
// マスタ取得
// ============================================================
function apiGetPrefectures() {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET.PREFECTURE);
  const data = sheet.getDataRange().getValues();

  const prefectures = data.slice(1)
    .filter(row => row[2] === 'active')
    .map(row => ({ code: row[0], name: row[1] }));

  return { prefectures };
}

function apiGetCities(prefCode) {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET.CITY);
  const data = sheet.getDataRange().getValues();

  const cities = data.slice(1)
    .filter(row => row[4] === 'active' && (!prefCode || row[1] === prefCode))
    .map(row => ({ code: row[0], prefCode: row[1], name: row[3] }));

  return { cities };
}

function apiGetIndustries() {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET.INDUSTRY);
  const data = sheet.getDataRange().getValues();

  const industries = data.slice(1).map(row => ({ code: row[0], name: row[1] }));
  return { industries };
}

// ============================================================
// 認証（STEP4）
// ============================================================
function apiLogin(idToken) {
  const userInfo = verifyFirebaseToken(idToken);
  if (!userInfo) return { error: '認証に失敗しました' };

  const user = upsertUser(userInfo);
  return { user };
}

// ============================================================
// Stripe Checkout Session作成（STEP5）
// ============================================================
function apiCreateCheckout(params, idToken) {
  const userInfo = verifyFirebaseToken(idToken);
  if (!userInfo) return { error: '認証が必要です' };

  const planType  = params.plan;
  const baseUrl   = params.baseUrl || 'https://myolyon.github.io/nukegake';
  const successUrl = baseUrl + '/pricing.html';
  const cancelUrl  = baseUrl + '/pricing.html';

  const session = createCheckoutSession(userInfo.email, planType, successUrl, cancelUrl);
  return { url: session.url };
}

// ============================================================
// ユーティリティ
// ============================================================
function jsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function getActivePrefectures(ss) {
  const sheet = ss.getSheetByName(SHEET.PREFECTURE);
  const data = sheet.getDataRange().getValues();
  const set = new Set();
  data.slice(1).forEach(row => { if (row[2] === 'active') set.add(String(row[0])); });
  return set;
}

function getActiveCities(ss) {
  const sheet = ss.getSheetByName(SHEET.CITY);
  const data = sheet.getDataRange().getValues();
  const set = new Set();
  data.slice(1).forEach(row => { if (row[4] === 'active') set.add(String(row[0])); });
  return set;
}
