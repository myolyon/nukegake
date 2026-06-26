// ============================================================
// 設定ファイル
// GASをWebアプリとしてデプロイした後、
// GAS_API_URLをデプロイURLに書き換えること
// ============================================================

const CONFIG = {
  // GAS WebアプリのURL（デプロイ後に更新）
  GAS_API_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',

  // Firebase設定（Firebaseコンソールから取得）
  FIREBASE: {
    apiKey:            'YOUR_FIREBASE_API_KEY',
    authDomain:        'nukegake.firebaseapp.com',
    projectId:         'nukegake',
    storageBucket:     'nukegake.appspot.com',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId:             'YOUR_APP_ID',
  },

  // StripeのPublishableKey（Stripeダッシュボードから取得）
  STRIPE_PUBLISHABLE_KEY: 'pk_live_YOUR_KEY',

  // ページのベースURL
  BASE_URL: 'https://myolyon.github.io/nukegake',
};
