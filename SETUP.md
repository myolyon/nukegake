# セットアップガイド

全手順をこの順番でやると詰まりません。

---

## 1. Firebase（10分）

1. https://console.firebase.google.com/ → プロジェクト作成
   - 名前: `nukegake`
   - Googleアナリティクス: オフでOK

2. Authentication → Sign-in method → **Google** を有効化

3. Authentication → Settings → 承認済みドメインに追加:
   - `myolyon.github.io`
   - `nukegake.jp`

4. プロジェクト設定 → 全般 → 「アプリを追加」→ ウェブ（`</>`）
   - アプリ名: `nukegake`
   - Firebase Hostingはチェックしない

5. 表示された設定を `docs/js/config.js` の `FIREBASE` に貼り付け:
   ```js
   FIREBASE: {
     apiKey: "AIza...",
     authDomain: "nukegake-xxx.firebaseapp.com",
     projectId: "nukegake-xxx",
     ...
   }
   ```

---

## 2. GAS（15分）

1. https://script.google.com → 新しいプロジェクト作成
   - 名前: `nukegake_backend`

2. `gas/` フォルダ内のファイルをすべてGASエディタに追加
   （ファイル名を維持してコピペ）

3. `setupAll()` を実行（初回のみ）
   → スプレッドシートが自動作成されます

4. スクリプトプロパティを設定（プロジェクトの設定 → スクリプト プロパティ）:

   | キー | 値 |
   |---|---|
   | `SPREADSHEET_ID` | setupAllで自動設定されます |
   | `FIREBASE_PROJECT_ID` | FirebaseのプロジェクトID |
   | `MAPS_API_KEY` | Google Maps / Places APIキー |
   | `STRIPE_SECRET_KEY` | `sk_live_xxx` |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_xxx` |
   | `STRIPE_PRICE_EARLY` | 早期限定のPrice ID |
   | `STRIPE_PRICE_MONTHLY` | 月額のPrice ID |
   | `STRIPE_PRICE_YEARLY` | 年額のPrice ID |

5. デプロイ → 新しいデプロイ → 種類: ウェブアプリ
   - 実行者: **自分**
   - アクセス: **全員（匿名含む）**
   - → デプロイURLをコピー

6. `docs/js/config.js` の `GAS_API_URL` にデプロイURLを貼り付け

---

## 3. Stripe（10分）

```bash
# Stripe CLIでまとめて商品作成（stripe loginが必要）
./scripts/setup_stripe.sh
```

または手動でStripeダッシュボードから:
1. 商品カタログ → 「商品を追加」
2. 3プラン作成（早期¥500/月・月額¥980/月・年額¥9800/年）
3. 各Price IDをGASスクリプトプロパティに設定

Webhook設定:
1. Stripe Dashboard → Webhooks → 「エンドポイントを追加」
2. URL: `https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec`
3. イベント選択:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `customer.subscription.deleted`
4. 署名シークレット（`whsec_xxx`）を `STRIPE_WEBHOOK_SECRET` に設定

---

## 4. STEP1: 企業データ投入（20分）

```bash
# サンプルデータで即テスト（国税庁CSVが取れるまでの間）
./scripts/generate_sample_data.sh
```

本番データを入れる場合:
```bash
# 国税庁CSVをダウンロード（ブラウザから手動DLが確実）
# https://www.houjin-bangou.nta.go.jp/download/zenken/
# 大阪府のCSVをDL →解凍

# 自動フィルタリング
./scripts/download_nta_csv.sh --filter-only
# → scripts/sakai_filtered.csv が生成される
```

その後:
1. `scripts/sakai_filtered.csv` をGoogle Driveにアップロード
2. ファイルIDをGASプロパティ `CSV_FILE_ID` に設定
3. GASで `importNtaCsv()` を実行

---

## 5. GitHub Pages（2分）

GitHubリポジトリの Settings → Pages:
- Source: **Deploy from a branch**
- Branch: `main` / フォルダ: `/docs`
- Save

→ `https://myolyon.github.io/nukegake/` で公開されます

カスタムドメイン（nukegake.jp）を使う場合:
- DNSにCNAMEレコードを追加: `myolyon.github.io`
- GitHub Pages → Custom domain に `nukegake.jp` を入力

---

## 6. STEP2: 電話番号・業種補完（GAS）

1. GCPでPlaces APIを有効化
2. APIキーを `MAPS_API_KEY` に設定
3. GASで `enrichCompaniesWithMaps()` を実行
   - 1回200件。全件処理まで複数回実行
   - トリガーで毎日深夜に自動実行も可能

---

## CLIでデプロイする場合（上級者向け）

```bash
# claspをインストール
npm install -g @google/clasp

# Googleアカウントにログイン
clasp login

# GASにプッシュ
./scripts/setup_gas.sh create  # 初回
./scripts/setup_gas.sh push    # 更新時
./scripts/setup_gas.sh deploy  # デプロイ
```
