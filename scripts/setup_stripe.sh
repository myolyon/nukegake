#!/bin/bash
# ============================================================
# Stripe CLI を使って商品・料金を自動作成するスクリプト
#
# 事前準備:
#   brew install stripe/stripe-cli/stripe  # macOS
#   stripe login
#
# 使い方:
#   ./scripts/setup_stripe.sh
# ============================================================

set -e

echo "=== Stripe 商品・料金を作成 ==="
echo ""

# 早期限定プラン（¥500/月）
echo "早期限定プランを作成中..."
EARLY_PRODUCT=$(stripe products create \
  --name "nukegake 早期限定プラン" \
  --description "先着50名限定・月額500円・広告なし・無制限閲覧" \
  --format json)

EARLY_PRODUCT_ID=$(echo "$EARLY_PRODUCT" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")

EARLY_PRICE=$(stripe prices create \
  --product "$EARLY_PRODUCT_ID" \
  --unit-amount 500 \
  --currency jpy \
  --recurring[interval] month \
  --nickname "early" \
  --format json)

EARLY_PRICE_ID=$(echo "$EARLY_PRICE" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "  ✅ 早期限定: $EARLY_PRICE_ID"

# 月額プラン（¥980/月）
echo "月額プランを作成中..."
MONTHLY_PRODUCT=$(stripe products create \
  --name "nukegake 月額プラン" \
  --description "月額980円・広告なし・無制限閲覧" \
  --format json)

MONTHLY_PRODUCT_ID=$(echo "$MONTHLY_PRODUCT" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")

MONTHLY_PRICE=$(stripe prices create \
  --product "$MONTHLY_PRODUCT_ID" \
  --unit-amount 980 \
  --currency jpy \
  --recurring[interval] month \
  --nickname "monthly" \
  --format json)

MONTHLY_PRICE_ID=$(echo "$MONTHLY_PRICE" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "  ✅ 月額: $MONTHLY_PRICE_ID"

# 年額プラン（¥9800/年）
echo "年額プランを作成中..."
YEARLY_PRODUCT=$(stripe products create \
  --name "nukegake 年額プラン" \
  --description "年額9800円・広告なし・無制限閲覧（2ヶ月分お得）" \
  --format json)

YEARLY_PRODUCT_ID=$(echo "$YEARLY_PRODUCT" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")

YEARLY_PRICE=$(stripe prices create \
  --product "$YEARLY_PRODUCT_ID" \
  --unit-amount 9800 \
  --currency jpy \
  --recurring[interval] year \
  --nickname "yearly" \
  --format json)

YEARLY_PRICE_ID=$(echo "$YEARLY_PRICE" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "  ✅ 年額: $YEARLY_PRICE_ID"

echo ""
echo "=== 完了 ==="
echo ""
echo "以下をGASのスクリプトプロパティに設定してください:"
echo ""
echo "  STRIPE_PRICE_EARLY   = $EARLY_PRICE_ID"
echo "  STRIPE_PRICE_MONTHLY = $MONTHLY_PRICE_ID"
echo "  STRIPE_PRICE_YEARLY  = $YEARLY_PRICE_ID"
echo ""

# .env.stripe ファイルに保存
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cat > "$SCRIPT_DIR/.env.stripe" <<EOF
STRIPE_PRICE_EARLY=$EARLY_PRICE_ID
STRIPE_PRICE_MONTHLY=$MONTHLY_PRICE_ID
STRIPE_PRICE_YEARLY=$YEARLY_PRICE_ID
EOF

echo "Price ID を scripts/.env.stripe に保存しました"
echo ""
echo "次のステップ: Webhookエンドポイントを設定"
echo "  stripe listen --forward-to YOUR_GAS_URL  # ローカルテスト用"
