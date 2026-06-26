#!/bin/bash
# ============================================================
# Firebase CLIを使ったセットアップスクリプト
#
# 事前準備:
#   npm install -g firebase-tools
#   firebase login
#
# 使い方:
#   ./scripts/setup_firebase.sh YOUR_PROJECT_ID
#   例: ./scripts/setup_firebase.sh nukegake-abc123
# ============================================================

set -e

PROJECT_ID="${1:-}"
if [ -z "$PROJECT_ID" ]; then
  echo "使い方: $0 <firebase-project-id>"
  echo "例: $0 nukegake-abc123"
  echo ""
  echo "Firebase プロジェクトIDは以下で確認できます:"
  echo "  https://console.firebase.google.com/"
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== Firebase セットアップ: $PROJECT_ID ==="

# Firebase プロジェクトを選択
firebase use "$PROJECT_ID" --add 2>/dev/null || true

# Authentication 設定の確認
echo ""
echo "Firebase Authenticationの設定:"
echo "  1. https://console.firebase.google.com/project/$PROJECT_ID/authentication を開く"
echo "  2. 「Sign-in method」→「Google」を有効化"
echo "  3. 承認済みドメインに以下を追加:"
echo "     - myolyon.github.io"
echo "     - nukegake.jp"
echo ""

# Webアプリの設定を取得
echo "Webアプリ設定を取得中..."
APP_CONFIG=$(firebase apps:sdkconfig WEB --project "$PROJECT_ID" 2>/dev/null || echo "")

if [ -n "$APP_CONFIG" ]; then
  echo "Firebase設定を取得しました。docs/js/config.js を更新してください:"
  echo ""
  echo "$APP_CONFIG"
else
  echo "Webアプリがまだ登録されていません。"
  echo "以下の手順でWebアプリを追加してください:"
  echo "  1. https://console.firebase.google.com/project/$PROJECT_ID/overview を開く"
  echo "  2. 「アプリを追加」→「ウェブ」をクリック"
  echo "  3. アプリ名: nukegake"
  echo "  4. 表示された設定を docs/js/config.js の FIREBASE セクションに貼り付け"
fi

echo ""
echo "=== セットアップ完了 ==="
echo ""
echo "docs/js/config.js の FIREBASE 設定を更新することを忘れずに！"
