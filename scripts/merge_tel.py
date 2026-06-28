#!/usr/bin/env python3
"""
電話番号マージスクリプト
既存 companies.json に電話番号データを追記する。
既存データは保持し、CSVで一致した企業の tel / isTelAvailable のみ更新する。

マッチング優先順位:
  1. 完全一致
  2. 正規化後一致（全角半角統一・空白除去・㈱→株式会社）
  3. 法人格除去後一致（前株・後株・有限会社 etc. を取り除いて比較）

CSV形式（デフォルト: ヘッダーなし）:
  会社名,電話番号

Usage:
  python scripts/merge_tel.py --input tel_data.csv --city sakai
  python scripts/merge_tel.py --input tel_data.csv --city sakai --has-header
  python scripts/merge_tel.py --input tel_data.csv --city sakai --dry-run
  python scripts/merge_tel.py --input tel_data.csv --city sakai --report unmatched.csv
"""

import argparse
import csv
import json
import os
import re
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(__file__))
from convert import CITY_CONFIGS, normalize_phone, detect_encoding

# 法人格パターン（正規化後に除去してコア名を比較）
_CORP_PATTERN = re.compile(
    r'^(株式会社|有限会社|合同会社|合名会社|合資会社|一般社団法人|公益社団法人'
    r'|一般財団法人|公益財団法人|医療法人|社会福祉法人|農業協同組合'
    r'|協同組合|事業協同組合|企業組合)\s*'
    r'|[\s　]*(株式会社|有限会社|合同会社|合名会社|合資会社)$'
)


def normalize_name(name: str) -> str:
    """会社名を正規化して比較用文字列を返す"""
    name = unicodedata.normalize('NFKC', name)   # 全角→半角、ひらがな統一等
    name = name.replace('㈱', '株式会社')
    name = name.replace('（株）', '株式会社')
    name = name.replace('(株)', '株式会社')
    name = name.replace('㈲', '有限会社')
    name = name.replace('（有）', '有限会社')
    name = name.replace('(有)', '有限会社')
    name = re.sub(r'[\s　]+', '', name)           # 空白（全角含む）除去
    return name


def strip_corp(name: str) -> str:
    """正規化済み名前から法人格を除いたコア名を返す"""
    return _CORP_PATTERN.sub('', name).strip()


def build_index(companies: list) -> tuple:
    """3段階のインデックスを構築する"""
    exact: dict = {}         # 元の名前 → index
    normalized: dict = {}    # normalize後 → index
    core: dict = {}          # 法人格除去後 → index

    for i, c in enumerate(companies):
        name = c['name']
        n = normalize_name(name)
        co = strip_corp(n)

        exact.setdefault(name, i)
        normalized.setdefault(n, i)
        if co:
            core.setdefault(co, i)

    return exact, normalized, core


def load_tel_csv(path: str, has_header: bool) -> list:
    encoding = detect_encoding(path)
    rows = []
    with open(path, encoding=encoding, newline='') as f:
        reader = csv.reader(f)
        if has_header:
            next(reader, None)
        for line in reader:
            if len(line) < 2:
                continue
            name = line[0].strip()
            tel_raw = line[1].strip()
            if name and tel_raw:
                rows.append({'name': name, 'tel_raw': tel_raw})
    return rows


def merge(companies: list, tel_rows: list, dry_run: bool) -> tuple:
    exact_idx, norm_idx, core_idx = build_index(companies)

    results = []   # {'name', 'tel', 'matched', 'match_type', 'matched_to'}

    for row in tel_rows:
        name = row['name']
        tel = normalize_phone(row['tel_raw'])

        if tel is None:
            results.append({'name': name, 'tel_raw': row['tel_raw'],
                            'matched': False, 'reason': '電話番号不正'})
            continue

        n = normalize_name(name)
        co = strip_corp(n)

        # 3段階マッチング
        if name in exact_idx:
            idx, match_type = exact_idx[name], 'exact'
        elif n in norm_idx:
            idx, match_type = norm_idx[n], 'normalized'
        elif co and co in core_idx:
            idx, match_type = core_idx[co], 'core'
        else:
            results.append({'name': name, 'tel': tel,
                            'matched': False, 'reason': '企業名未一致'})
            continue

        matched_name = companies[idx]['name']
        if not dry_run:
            companies[idx]['tel'] = tel
            companies[idx]['isTelAvailable'] = True

        results.append({'name': name, 'tel': tel, 'matched': True,
                        'match_type': match_type, 'matched_to': matched_name})

    return companies, results


def print_report(results: list, report_path: str | None) -> None:
    matched   = [r for r in results if r['matched']]
    unmatched = [r for r in results if not r['matched']]

    print(f'\n--- マージ結果 ---')
    print(f'  入力総数:   {len(results)} 件')
    print(f'  一致:       {len(matched)} 件  ({len(matched)/len(results)*100:.1f}%)' if results else '')
    print(f'  未一致:     {len(unmatched)} 件')

    if matched:
        by_type: dict = {}
        for r in matched:
            by_type[r['match_type']] = by_type.get(r['match_type'], 0) + 1
        print(f'  マッチ内訳:')
        for t, cnt in sorted(by_type.items()):
            label = {'exact': '完全一致', 'normalized': '正規化一致', 'core': '法人格除去一致'}.get(t, t)
            print(f'    {label}: {cnt} 件')

    if unmatched:
        print(f'\n  未一致一覧:')
        for r in unmatched:
            reason = r.get('reason', '')
            tel_info = f'  [{r.get("tel_raw", r.get("tel", ""))}]' if 'tel_raw' in r else ''
            print(f'    {r["name"]}{tel_info}  ← {reason}')

    if report_path and unmatched:
        with open(report_path, 'w', encoding='utf-8', newline='') as f:
            w = csv.writer(f)
            w.writerow(['会社名', '入力電話番号', '理由'])
            for r in unmatched:
                w.writerow([r['name'], r.get('tel_raw', r.get('tel', '')), r.get('reason', '')])
        print(f'\n  未一致リストを {report_path} に出力しました')


def main() -> None:
    parser = argparse.ArgumentParser(description='companies.json に電話番号をマージ')
    parser.add_argument('--input',      required=True, help='電話番号CSVファイルパス')
    parser.add_argument('--city',       required=True, choices=list(CITY_CONFIGS.keys()))
    parser.add_argument('--has-header', action='store_true', help='CSVにヘッダー行がある場合')
    parser.add_argument('--dry-run',    action='store_true', help='ファイルを書き換えずに確認')
    parser.add_argument('--report',     help='未一致企業をCSV出力するファイルパス')
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f'ERROR: ファイルが見つかりません: {args.input}', file=sys.stderr)
        sys.exit(1)

    output_path = CITY_CONFIGS[args.city]['output_path']
    if not os.path.exists(output_path):
        print(f'ERROR: companies.json が見つかりません: {output_path}', file=sys.stderr)
        sys.exit(1)

    with open(output_path, encoding='utf-8') as f:
        companies = json.load(f)
    print(f'読み込み: {len(companies)} 件 ({output_path})')

    tel_rows = load_tel_csv(args.input, args.has_header)
    print(f'電話番号データ: {len(tel_rows)} 件')

    companies, results = merge(companies, tel_rows, args.dry_run)
    print_report(results, args.report)

    if args.dry_run:
        print('\n[DRY-RUN] ファイルは変更されていません')
        return

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(companies, f, ensure_ascii=False, indent=2)

    matched_count = sum(1 for r in results if r['matched'])
    print(f'\n✅ {matched_count} 件の電話番号を {output_path} に反映しました')


if __name__ == '__main__':
    main()
