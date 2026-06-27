#!/bin/bash
# ============================================================
# nukegake データ更新パイプライン
# CSV変換 → git commit → push を一射に実行する
#
# 使い方:
#   ./scripts/update.sh sakai ~/Downloads/27_osaka.csv
#   ./scripts/update.sh sakai   # → ~/Downloadsを自動検索
#
# 事前準備:
#   国税庁法人番号公表サイトからCSVをダウンロード
#   https://www.houjin-bangou.nta.go.jp/download/todofuken/
# ============================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

CITY="${1:-sakai}"
CSV_PATH="${2:-}"

# ---- CSV自動検索 (~/Downloads) ----
if [ -z "$CSV_PATH" ]; then
  echo "🔍 ~/DownloadsでCSVを検索中..."

  # 1. 最近更新の大阪府ファイル
  CSV_PATH=$(find ~/Downloads -maxdepth 2 \
    \( -name "27_*.csv" -o -name "*osaka*.csv" -o -name "*大阪*.csv" \) \
    2>/dev/null | sort -t_ -k1 | tail -1)

  # 2. 上記がなければZIP解冰を試みる
  if [ -z "$CSV_PATH" ]; then
    ZIP=$(find ~/Downloads -maxdepth 2 \
      \( -name "27_*.zip" -o -name "*osaka*.zip" \) \
      2>/dev/null | sort | tail -1)
    if [ -n "$ZIP" ]; then
      echo "📦 ZIP解冰中: $ZIP"
      UNZIP_DIR=$(mktemp -d)
      unzip -q "$ZIP" -d "$UNZIP_DIR"
      CSV_PATH=$(find "$UNZIP_DIR" -name "*.csv" | head -1)
      echo "   解冰先: $CSV_PATH"
    fi
  fi

  if [ -z "$CSV_PATH" ]; then
    echo ""
    echo "⚠️  CSVファイルが見つかりません。"
    echo ""
    echo "【手動ダウンロード手順】"
    echo "  1. 以下をブラウザで開く："
    echo "     https://www.houjin-bangou.nta.go.jp/download/todofuken/"
    echo "  2. 大阪府のCSVをダウンロード（ZIP形式）"
    echo "  3. 所定のファイルを指定して再実行："
    echo "     $0 $CITY ~/Downloads/27_osaka.csv"
    exit 1
  fi
fi

if [ ! -f "$CSV_PATH" ]; then
  echo "❌ ファイルが見つかりません: $CSV_PATH"
  exit 1
fi

echo ""
echo "=== ステップ1: CSV変換 ==="
echo "入力: $CSV_PATH"
echo "都市: $CITY"
python "$SCRIPT_DIR/convert.py" --input "$CSV_PATH" --city "$CITY"

OUTPUT_JSON="docs/data/${CITY}/companies.json"
COUNT=$(python -c "import json; d=json.load(open('$ROOT_DIR/$OUTPUT_JSON')); print(len(d))")

echo ""
echo "=== ステップ2: git commit ==="
cd "$ROOT_DIR"
git add "$OUTPUT_JSON"

if git diff --cached --quiet; then
  echo "⚠️  変更なし（データが最新状態）"
  exit 0
fi

DATE=$(date +%Y-%m-%d)
git commit -m "data: ${CITY} 企業データ更新 ${DATE} (${COUNT}件)"

echo ""
echo "=== ステップ3: git push ==="
git push origin main

echo ""
echo "✅ 完了: ${COUNT}件を ${OUTPUT_JSON} にデプロイしました"
echo "   🌐 https://nukegake.jp"
