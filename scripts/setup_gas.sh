#!/bin/bash
# ============================================================
# GAS clasp セットアップ＆デプロイスクリプト
# claspを使ってコマンドラインからGASにコードをプッシュする
#
# 使い方（初回）:
#   npm install -g @google/clasp
#   clasp login
#   ./scripts/setup_gas.sh create
#
# 使い方（2回目以降の更新）:
#   ./scripts/setup_gas.sh push
# ============================================================

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  echo "使い方: $0 [create|push|deploy]"
  echo "  create  - 新しいGASプロジェクトを作成してプッシュ"
  echo "  push    - コードをGASにプッシュ（上書き更新）"
  echo "  deploy  - Webアプリとしてデプロイ"
  exit 1
}

CMD="${1:-push}"

case "$CMD" in
  create)
    echo "=== GASプロジェクトを作成 ==="
    cd "$REPO_ROOT"

    # 新規GASプロジェクトを作成
    clasp create --type webapp --title "nukegake_backend" --rootDir gas/

    echo ""
    echo "✅ プロジェクト作成完了"
    echo ".clasp.json のscriptIdを確認してください"
    echo ""
    # コードをプッシュ
    clasp push --rootDir gas/
    echo "✅ コードプッシュ完了"
    ;;

  push)
    echo "=== GASにコードをプッシュ ==="
    cd "$REPO_ROOT"
    clasp push --rootDir gas/ --force
    echo "✅ プッシュ完了"
    ;;

  deploy)
    echo "=== Webアプリとしてデプロイ ==="
    cd "$REPO_ROOT"
    clasp push --rootDir gas/ --force
    clasp deploy --description "nukegake-$(date +%Y%m%d-%H%M%S)"
    echo ""
    echo "✅ デプロイ完了"
    echo "デプロイURLをGASコンソールで確認:"
    echo "  https://script.google.com/home/projects/$(cat .clasp.json | python3 -c 'import sys,json;print(json.load(sys.stdin)[\"scriptId\"])')/deployments"
    ;;

  *)
    usage
    ;;
esac
