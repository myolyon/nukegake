// ============================================================
// 設定ファイル
// 【Stripeを契約したらここだけ書き換える】
//
// Stripe Payment Linkの作り方:
// 1. https://dashboard.stripe.com に登録・ログイン
// 2. 左メニュー「Payment Links」→「+ 新規作成」
// 3. 商品を作成（例: nukegake月額 ¥980/月）
// 4. 生成されたURLをここに貼り付け
// ============================================================

const CONFIG = {
  // StripeのPayment Link URL（Stripeダッシュボードで取得）
  STRIPE_LINK_EARLY:   'https://buy.stripe.com/XXXXXXXXX', // 早期限定 ¥500/月
  STRIPE_LINK_MONTHLY: 'https://buy.stripe.com/XXXXXXXXX', // 月額 ¥980/月
  STRIPE_LINK_YEARLY:  'https://buy.stripe.com/XXXXXXXXX', // 年額 ¥9800/年

  // 企業データのパス（変更不要）
  DATA_URL: 'data/companies.json',

  // 無料プランの閲覧上限
  FREE_LIMIT: 10,
};
