#!/usr/bin/env python3
"""
電話番号マージスクリプト
既存 companies.json に電話番号データを追記する。
既存データは保持し、CSVで一致した企業の tel / isTelAvailable のみ更新する。

CSV形式（デフォルト: ヘッダーなし）:
  会社名,電話番号

Usage:
  python scripts/merge_tel.py --input tel_data.csv --city sakai
  python scripts/merge_tel.py --input tel_data.csv --city sakai --has-header
  python scripts/merge_tel.py --input tel_data.csv --city sakai --dry-run
"""

import argparse
import csv
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from convert import CITY_CONFIGS, normalize_phone, detect_encoding


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
    name_index = {c['name']: i for i, c in enumerate(companies)}
    matched = unmatched = 0

    for row in tel_rows:
        idx = name_index.get(row['name'])
        if idx is None:
            print(f'  未一致: {row["name"]}')
            unmatched += 1
            continue

        tel = normalize_phone(row['tel_raw'])
        if tel is None:
            print(f'  電話番号不正: {row["name"]} → {row["tel_raw"]}')
            unmatched += 1
            continue

        if not dry_run:
            companies[idx]['tel'] = tel
            companies[idx]['isTelAvailable'] = True
        matched += 1

    return companies, matched, unmatched


def main() -> None:
    parser = argparse.ArgumentParser(description='companies.json に電話番号をマージ')
    parser.add_argument('--input',      required=True, help='電話番号CSVファイルパス')
    parser.add_argument('--city',       required=True, choices=list(CITY_CONFIGS.keys()))
    parser.add_argument('--has-header', action='store_true', help='CSVにヘッダー行がある場合')
    parser.add_argument('--dry-run',    action='store_true', help='ファイルを書き換えずに確認')
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

    companies, matched, unmatched = merge(companies, tel_rows, args.dry_run)

    print(f'\n一致: {matched} 件 / 未一致: {unmatched} 件')

    if args.dry_run:
        print('\n[DRY-RUN] ファイルは変更されていません')
        return

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(companies, f, ensure_ascii=False, indent=2)
    print(f'✅ {output_path} を更新しました')


if __name__ == '__main__':
    main()
