# nukegake（ぬけがけ）

> ビリだけは、嫌だ。

個人営業マン向け法人情報検索サービス。  
大阪府堺市からスタートし、statusを変えるだけで全国展開できる設計。

## 技術スタック

| 役割 | 技術 |
|---|---|
| フロントエンド | HTML / CSS / JavaScript |
| バックエンド | Google Apps Script |
| DB | Google スプレッドシート |
| 認証 | Firebase Auth（Googleログイン）|
| 決済 | Stripe |
| ホスティング | GitHub Pages |
| ドメイン | nukegake.jp |

## ディレクトリ構成

```
nukegake/
├── docs/               # GitHub Pages フロントエンド
│   ├── index.html      # 企業一覧ページ
│   ├── login.html      # ログインページ
│   ├── pricing.html    # 料金プランページ
│   ├── css/style.css   # スタイル
│   └── js/
│       ├── config.js   # 設定（GAS URL, Firebase設定）
│       ├── auth.js     # Firebase認証
│       ├── api.js      # GAS APIクライアント
│       └── app.js      # メインロジック
├── gas/                # Google Apps Script
│   ├── appsscript.json # GASマニフェスト
│   ├── Config.gs       # 設定・定数
│   ├── Setup.gs        # 初期セットアップ
│   ├── Step1_ImportCSV.gs   # NTA CSVインポート
│   ├── Step2_GoogleMaps.gs  # Google Maps補完
│   ├── WebApp.gs       # Web API（doGet/doPost）
│   ├── Auth.gs         # Firebase認証検証
│   └── Stripe.gs       # Stripe決済処理
└── scripts/
    └── download_nta_csv.sh  # CSVダウンロードスクリプト
```

## セットアップ手順

### 1. Firebase プロジェクト作成

1. [Firebase Console](https://console.firebase.google.com/) でプロジェクト作成
   - プロジェクト名: `nukegake`
2. Authentication → Googleを有効化
3. プロジェクト設定 → Webアプリを追加
4. `docs/js/config.js` の `FIREBASE` 設定を更新

### 2. Google Apps Script デプロイ

1. [script.google.com](https://script.google.com) でプロジェクト作成
2. `gas/` フォルダ内のファイルをすべてコピー
3. **初回のみ** `setupAll()` を実行してスプレッドシートを作成
4. スクリプトプロパティを設定:
   - `SPREADSHEET_ID` - 作成されたスプレッドシートのID（setupAllで自動設定）
   - `FIREBASE_PROJECT_ID` - FirebaseプロジェクトID（例: `nukegake`）
   - `MAPS_API_KEY` - Google Maps / Places API キー
   - `STRIPE_SECRET_KEY` - Stripe シークレットキー（`sk_live_xxx`）
   - `STRIPE_WEBHOOK_SECRET` - Stripe Webhook シークレット（`whsec_xxx`）
   - `STRIPE_PRICE_EARLY` - 早期限定プランのPrice ID
   - `STRIPE_PRICE_MONTHLY` - 月額プランのPrice ID
   - `STRIPE_PRICE_YEARLY` - 年額プランのPrice ID
5. デプロイ → 新しいデプロイ → Webアプリ
   - 実行者: 自分
   - アクセス権: 全員（匿名を含む）
6. デプロイURLを `docs/js/config.js` の `GAS_API_URL` に設定

### 3. Stripe セットアップ

1. [Stripe Dashboard](https://dashboard.stripe.com/) でアカウント作成
2. 商品・料金を作成:
   - 早期限定: 月額 ¥500（最大50名）
   - 月額: 月額 ¥980
   - 年額: 年額 ¥9,800
3. 各Price IDをGASスクリプトプロパティに設定
4. Webhook エンドポイントを追加: `https://script.google.com/macros/s/YOUR_ID/exec`
   - イベント: `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.deleted`
5. Webhook SigningSecretを `STRIPE_WEBHOOK_SECRET` に設定
6. PublishableKeyを `docs/js/config.js` の `STRIPE_PUBLISHABLE_KEY` に設定

### 4. STEP1: 企業データ投入

```bash
# CSVをダウンロードして堺市分を抽出
./scripts/download_nta_csv.sh

# scripts/sakai_filtered.csv をGoogle Driveにアップロード
# ファイルIDをスクリプトプロパティ CSV_FILE_ID に設定
```

GASで `importNtaCsv()` を実行。

### 5. STEP2: 電話番号・業種補完

GASで `enrichCompaniesWithMaps()` を実行。  
1回200件処理。全件処理まで複数回実行してください。

トリガー設定（任意）:
- 毎日深夜に `enrichCompaniesWithMaps` を実行

### 6. GitHub Pages 有効化

1. GitHubリポジトリの Settings → Pages
2. ソース: `docs/` フォルダ
3. カスタムドメイン: `nukegake.jp`（DNSは別途設定）

## 料金プラン

| プラン | 価格 | 閲覧 | 広告 |
|---|---|---|---|
| 無料 | ¥0 | 月10件 | あり |
| 早期限定 | 月額 ¥500 | 無制限 | なし |
| 月額 | 月額 ¥980 | 無制限 | なし |
| 年額 | 年額 ¥9,800 | 無制限 | なし |

## エリア展開

都道府県マスタ・市区町村マスタの `status` を `active` に変更するだけで  
追加コストゼロでエリア拡張できます。

```
現在 active: 大阪府 → 堺市（7区）
```

## 月額コスト目安

| サービス | 月額 |
|---|---|
| Firebase Auth | 無料（月10万認証まで）|
| Google Apps Script | 無料 |
| Google Spreadsheet | 無料 |
| GitHub Pages | 無料 |
| Google Maps Places API | 月$200クレジット内→実質無料 |
| Stripe | 決済手数料 3.6%（固定費なし）|

**合計: ほぼ無料（ユーザー増加前）**

## スプレッドシート構成

1. **都道府県マスタ** - 47都道府県 + statusカラム
2. **市区町村マスタ** - 全国市区町村 + statusカラム
3. **業種マスタ** - 13業種
4. **企業マスタ** - NTA CSV + Maps補完データ
5. **ユーザー管理** - 会員情報・プラン・Stripe顧客ID
6. **KPIダッシュボード** - 自動集計
