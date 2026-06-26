#!/bin/bash
# ============================================================
# 国税庁 法人番号公表サイト CSVダウンロード＆フィルタリング
#
# 使い方:
#   chmod +x scripts/download_nta_csv.sh
#   ./scripts/download_nta_csv.sh
#
# 出力:
#   scripts/sakai_filtered.csv  ← このファイルをGoogle Driveにアップロード
#
# 必要なツール: curl, unzip, iconv (macOS/Linuxに標準搭載)
#
# 堺市の市区町村コード（5桁）:
#   27141 堺市堺区
#   27142 堺市中区
#   27143 堺市東区
#   27144 堺市西区
#   27145 堺市南区
#   27146 堺市北区
#   27147 堺市美原区
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="$SCRIPT_DIR/tmp_nta"
OUTPUT_FILE="$SCRIPT_DIR/sakai_filtered.csv"

# 大阪府の都道府県コード
PREF_CODE="27"

# 堺市の市区町村コード（カンマ区切り）
SAKAI_CODES="27141|27142|27143|27144|27145|27146|27147"

echo "=== 国税庁CSVダウンロード開始 ==="
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

# 国税庁から大阪府のCSV（ZIP）をダウンロード
# ※ファイル名・URLは変更される場合があります
# 最新のURLは https://www.houjin-bangou.nta.go.jp/download/zenken/ から確認してください
NTA_URL="https://www.houjin-bangou.nta.go.jp/download/zenken/index.html"

echo ""
echo "【重要】国税庁のURLは定期的に変更されます。"
echo "以下のサイトから最新のダウンロードURLを確認してください:"
echo "  $NTA_URL"
echo ""

# 大阪府のCSV ZIPファイルを自動検索
echo "大阪府のCSVを検索中..."
DOWNLOAD_PAGE=$(curl -s "$NTA_URL" 2>/dev/null || echo "")

# URLを手動で設定（自動取得できない場合）
CSV_ZIP_URL=""

if [ -z "$CSV_ZIP_URL" ]; then
  echo ""
  echo "CSVのZIPファイルURLを直接入力してください:"
  echo "（例: https://www.houjin-bangou.nta.go.jp/download/zenken/...大阪...zip）"
  read -p "URL: " CSV_ZIP_URL
fi

if [ -z "$CSV_ZIP_URL" ]; then
  echo "URLが入力されませんでした。処理を中断します。"
  echo ""
  echo "別の方法:"
  echo "1. ブラウザで $NTA_URL を開く"
  echo "2. 大阪府のCSVをダウンロード"
  echo "3. ZIPを解凍してCSVファイルを $WORK_DIR/ に配置"
  echo "4. 以下のコマンドを手動実行:"
  echo "   grep -E '^[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,27,(${SAKAI_CODES//|/|}),.*,.*,.*,.*,.*,.*,.*,,,' osaka.csv > $OUTPUT_FILE"
  exit 1
fi

echo "ダウンロード中: $CSV_ZIP_URL"
curl -L -o osaka.zip "$CSV_ZIP_URL"
echo "解凍中..."
unzip -o osaka.zip

# CSVファイルを探す
CSV_FILE=$(find . -name "*.csv" | head -1)
if [ -z "$CSV_FILE" ]; then
  echo "エラー: CSVファイルが見つかりません"
  exit 1
fi

echo "CSVファイル: $CSV_FILE"

# 文字コードを確認・変換（Shift-JISの場合はUTF-8に変換）
FILE_ENCODING=$(file -b --mime-encoding "$CSV_FILE" 2>/dev/null || echo "unknown")
echo "文字コード: $FILE_ENCODING"

if echo "$FILE_ENCODING" | grep -qi "iso-2022\|shift\|sjis\|euc"; then
  echo "UTF-8に変換中..."
  iconv -f SHIFT-JIS -t UTF-8 "$CSV_FILE" > osaka_utf8.csv
  CSV_FILE="osaka_utf8.csv"
fi

echo "堺市のデータを抽出中..."

# CSVのフィルタリング
# 列構成（0-indexed）:
#  [1]  法人番号
#  [9]  都道府県コード
#  [10] 市区町村コード
#  [24] 最新履歴 (1=最新)
#  [20] 廃業等年月日 (空=現役)
#  [26] 検索対象除外 (1=除外)

# AWKで絞り込み（ヘッダー行 + 堺市の現役企業のみ）
awk -F',' '
  NR==1 { print; next }
  {
    corp_no = $2
    pref    = $10
    city    = $11
    closed  = $21
    latest  = $25
    exclude = $27

    # 最新履歴=1、廃業なし、除外なし、堺市
    if (latest == "1" && closed == "" && exclude != "1" &&
        (city == "27141" || city == "27142" || city == "27143" ||
         city == "27144" || city == "27145" || city == "27146" || city == "27147")) {
      print
    }
  }
' "$CSV_FILE" > "$OUTPUT_FILE"

COUNT=$(wc -l < "$OUTPUT_FILE")
echo ""
echo "=== 完了 ==="
echo "抽出件数: $((COUNT - 1)) 件"
echo "出力ファイル: $OUTPUT_FILE"
echo ""
echo "次のステップ:"
echo "1. $OUTPUT_FILE をGoogle Driveにアップロード"
echo "2. ファイルのIDをコピー（ドライブURL内の /d/XXXXXX/ 部分）"
echo "3. GASのスクリプトプロパティ CSV_FILE_ID にセット"
echo "4. GASで importNtaCsv() を実行"

# 一時ファイルを削除
cd "$SCRIPT_DIR"
rm -rf "$WORK_DIR"
