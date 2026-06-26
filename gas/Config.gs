// ============================================================
// 設定ファイル
// 機密情報はスクリプトプロパティで管理する
// ファイル > プロジェクトのプロパティ > スクリプトのプロパティ
// ============================================================

function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    SPREADSHEET_ID:        props.getProperty('SPREADSHEET_ID') || '',
    STRIPE_SECRET_KEY:     props.getProperty('STRIPE_SECRET_KEY') || '',
    STRIPE_WEBHOOK_SECRET: props.getProperty('STRIPE_WEBHOOK_SECRET') || '',
    MAPS_API_KEY:          props.getProperty('MAPS_API_KEY') || '',
    FIREBASE_PROJECT_ID:   props.getProperty('FIREBASE_PROJECT_ID') || 'nukegake',
    // 早期限定プランの上限人数
    EARLY_LIMIT: 50,
  };
}

// シート名定数
const SHEET = {
  PREFECTURE: '都道府県マスタ',
  CITY:       '市区町村マスタ',
  INDUSTRY:   '業種マスタ',
  COMPANY:    '企業マスタ',
  USER:       'ユーザー管理',
  KPI:        'KPIダッシュボード',
};

// プラン定数
const PLAN = {
  FREE:    'free',
  EARLY:   'early',
  MONTHLY: 'monthly',
  YEARLY:  'yearly',
};

// 無料プランの閲覧上限
const FREE_LIMIT = 10;
