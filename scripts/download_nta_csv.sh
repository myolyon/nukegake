#!/bin/bash
# ============================================================
# 国税庁 法人番号公表サイト CSVダウンロード＆フィルタリング
#
# 使い方:
#   chmod +x scripts/download_nta_csv.sh
#   ./scripts/download_nta_csv.sh
#
# 出力: scripts/sakai_filtered.csv  → Google Driveにアップロード
#
# 注意: 国税庁サイトは自動アクセスを制限している場合があります。
#       その場合は手動ダウンロード手順に従ってください。
#
# 堺市の市区町村コード（5桁）:
#   27141 堺市堺区  27142 堺市中区  27143 堺市東区
#   27144 堺市西区  27145 堺市南区  27146 堺市北区  27147 堺市美原区
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="$SCRIPT_DIR/tmp_nta"
OUTPUT_FILE="$SCRIPT_DIR/sakai_filtered.csv"

# 大阪府の最新CSVのURLを試みる（URLは変更される場合あり）
# 最新URLは https://www.houjin-bangou.nta.go.jp/download/zenken/ で確認
NTA_DOWNLOAD_PAGE="https://www.houjin-bangou.nta.go.jp/download/zenken/index.html"

CURL_OPTS=(
  -L
  --max-time 300
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  -H "Accept-Language: ja,en;q=0.5"
  -H "Accept-Encoding: gzip, deflate, br"
  -H "DNT: 1"
  -H "Connection: keep-alive"
  --compressed
)

echo "=== 国税庁CSVダウンロード ==="
echo ""

# ダウンロードページにアクセスしてURLを取得
echo "ダウンロードページを確認中..."
PAGE_CONTENT=$(curl "${CURL_OPTS[@]}" -s "$NTA_DOWNLOAD_PAGE" 2>/dev/null || echo "")

# 大阪府（コード27）のURLを正規表現で抽出
OSAKA_URL=""
if [ -n "$PAGE_CONTENT" ]; then
  OSAKA_URL=$(echo "$PAGE_CONTENT" | grep -oE 'href="[^"]*27[^"]*\.(zip|ZIP)[^"]*"' | head -1 | sed 's/href="//;s/"//')
  # 相対URLを絶対URLに変換
  if [[ "$OSAKA_URL" == /* ]]; then
    OSAKA_URL="https://www.houjin-bangou.nta.go.jp${OSAKA_URL}"
  fi
fi

if [ -z "$OSAKA_URL" ]; then
  echo ""
  echo "⚠️  自動でダウンロードURLを取得できませんでした。"
  echo ""
  echo "【手動ダウンロード手順】"
  echo "  1. 以下のURLをブラウザで開く:"
  echo "     $NTA_DOWNLOAD_PAGE"
  echo "  2. 「大阪府」のCSVをダウンロード（ZIP形式）"
  echo "  3. ZIPを解凍してできたCSVファイルを以下に配置:"
  echo "     $WORK_DIR/osaka.csv"
  echo "  4. 以下のコマンドを実行してフィルタリング:"
  echo "     $0 --filter-only"
  echo ""
  echo "【別の方法】"
  echo "  国税庁APIを使う場合は以下を参考にしてください:"
  echo "  https://www.houjin-bangou.nta.go.jp/webapi/"
  echo ""

  # サンプルデータを生成して続行するか確認
  read -p "テスト用サンプルデータを生成しますか？ [y/N]: " USE_SAMPLE
  if [[ "$USE_SAMPLE" =~ ^[Yy]$ ]]; then
    "$SCRIPT_DIR/generate_sample_data.sh"
    echo ""
    echo "✅ サンプルデータで続行します。"
    echo "   本番データは後で上書きできます。"
  fi
  exit 0
fi

# フィルタリングのみモード
if [ "${1:-}" = "--filter-only" ]; then
  CSV_FILE=$(find "$WORK_DIR" -name "*.csv" | head -1)
  if [ -z "$CSV_FILE" ]; then
    echo "エラー: $WORK_DIR にCSVファイルが見つかりません"
    exit 1
  fi
  filter_csv "$CSV_FILE"
  exit 0
fi

# ダウンロード実行
echo "ダウンロード中: $OSAKA_URL"
mkdir -p "$WORK_DIR"
curl "${CURL_OPTS[@]}" -o "$WORK_DIR/osaka.zip" "$OSAKA_URL"

echo "解凍中..."
cd "$WORK_DIR"
unzip -o osaka.zip

# CSVファイルを探す
CSV_FILE=$(find . -name "*.csv" | head -1)
if [ -z "$CSV_FILE" ]; then
  echo "エラー: CSVファイルが見つかりません"
  ls -la
  exit 1
fi

echo "CSVファイル: $CSV_FILE"
filter_csv "$CSV_FILE"

# 一時ファイルを削除
cd "$SCRIPT_DIR"
rm -rf "$WORK_DIR"

filter_csv() {
  local INPUT="$1"

  # 文字コード確認・変換
  if command -v nkf &>/dev/null; then
    echo "文字コード変換中 (nkf)..."
    nkf -w "$INPUT" > /tmp/osaka_utf8.csv && mv /tmp/osaka_utf8.csv "$INPUT"
  elif command -v iconv &>/dev/null; then
    echo "文字コード変換中 (iconv)..."
    iconv -f SHIFT-JIS -t UTF-8 "$INPUT" > /tmp/osaka_utf8.csv 2>/dev/null && mv /tmp/osaka_utf8.csv "$INPUT" || true
  fi

  echo "堺市のデータを抽出中..."

  # AWKで絞り込み
  # 列構成(1-indexed): [2]=法人番号, [7]=社名, [11]=都道府県コード
  # [12]=市区町村コード, [21]=廃業年月日, [25]=最新履歴, [27]=検索除外
  awk -F',' '
    NR==1 { print; next }
    {
      city    = $11
      closed  = $21
      latest  = $25
      exclude = $27

      gsub(/\r/, "", latest)
      gsub(/\r/, "", exclude)
      gsub(/\r/, "", closed)
      gsub(/\r/, "", city)

      if (latest == "1" && closed == "" && exclude != "1" &&
          (city == "27141" || city == "27142" || city == "27143" ||
           city == "27144" || city == "27145" || city == "27146" || city == "27147")) {
        print
      }
    }
  ' "$INPUT" > "$OUTPUT_FILE"

  COUNT=$(wc -l < "$OUTPUT_FILE")
  echo ""
  echo "=== 完了 ==="
  echo "抽出件数: $((COUNT - 1)) 件"
  echo "出力: $OUTPUT_FILE"
  echo ""
  echo "次のステップ:"
  echo "  1. $OUTPUT_FILE をGoogle Driveにアップロード"
  echo "  2. ファイルIDをGASスクリプトプロパティ CSV_FILE_ID に設定"
  echo "  3. GASで importNtaCsv() を実行"
}
