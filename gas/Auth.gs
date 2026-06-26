// ============================================================
// STEP4: Firebase IDトークンの検証
//
// フロントエンドでFirebase Authによりログインした後、
// IDトークンをAPIリクエストに付与して送信する。
// GAS側でGoogleのトークン検証エンドポイントで検証する。
// ============================================================

// IDトークンを検証してユーザー情報を返す
// 検証失敗時はnullを返す
function verifyFirebaseToken(idToken) {
  if (!idToken) return null;

  try {
    const url = 'https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=' + encodeURIComponent(idToken);
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return null;

    const payload = JSON.parse(res.getContentText());

    // 発行者の確認
    if (!payload.iss || !payload.iss.startsWith('https://securetoken.google.com/')) return null;

    // Firebaseプロジェクトの確認
    const config = getConfig();
    if (payload.aud !== config.FIREBASE_PROJECT_ID) return null;

    // 有効期限の確認
    if (!payload.exp || Date.now() / 1000 > parseInt(payload.exp)) return null;

    return {
      uid:   payload.sub || payload.user_id,
      email: payload.email,
      name:  payload.name || '',
    };
  } catch (e) {
    Logger.log('Token verification error: ' + e.message);
    return null;
  }
}

// ユーザーをスプレッドシートに登録または更新
function upsertUser(userInfo) {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET.USER);
  const data = sheet.getDataRange().getValues();
  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');

  // 既存ユーザーを検索（メールで検索）
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === userInfo.email) {
      // 最終ログイン日時を更新
      sheet.getRange(i + 1, 8).setValue(now);
      return {
        uid:     data[i][0],
        email:   data[i][1],
        name:    data[i][2],
        plan:    data[i][3],
        expires: data[i][4],
      };
    }
  }

  // 新規ユーザー登録
  const newRow = [
    userInfo.uid,
    userInfo.email,
    userInfo.name,
    PLAN.FREE,  // デフォルトは無料プラン
    '',         // 有効期限
    '',         // Stripe顧客ID
    now,        // 登録日
    now,        // 最終ログイン
  ];
  sheet.appendRow(newRow);

  return {
    uid:     userInfo.uid,
    email:   userInfo.email,
    name:    userInfo.name,
    plan:    PLAN.FREE,
    expires: '',
  };
}

// メールアドレスでユーザー情報を取得
function getUserByEmail(email) {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET.USER);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === email) {
      return {
        uid:        data[i][0],
        email:      data[i][1],
        name:       data[i][2],
        plan:       data[i][3],
        expires:    data[i][4],
        stripeId:   data[i][5],
      };
    }
  }
  return null;
}

// プランが有効かどうかを確認
function isPlanActive(user) {
  if (!user) return false;
  if (user.plan === PLAN.FREE) return true;

  if (!user.expires) return false;
  const expiresDate = new Date(user.expires);
  return expiresDate > new Date();
}
