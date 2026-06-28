#!/usr/bin/env python3
"""
電話番号未登録企業エクスポートスクリプト
companies.json から電話番号未登録の企業をCSVに出力する。
出力CSVを電話番号収集担当者に渡し、tel列に記入してもらう。
記入後は merge_tel.py --has-header でマージ。

出力列:
  company_name, industry, address, search_url, map_url, tel（記入欄）

Usage:
  python scripts/export_missing_tel.py --city sakai
  python scripts/export_missing_tel.py --city sakai --industry 製造業 --limit 100
  python scripts/export_missing_tel.py --city sakai --output todo_manufacturing.csv --industry 製造業
"""

import argparse
import csv
import json
import os
import sys
import urllib.parse

sys.path.insert(0, os.path.dirname(__file__))
from convert import CITY_CONFIGS


def build_search_url(name: str) -> str:
    return 'https://www.google.com/search?q=' + urllib.parse.quote(name)


def build_map_url(address: str, name: str) -> str:
    q = address if address else name
    return 'https://maps.google.com/maps?q=' + urllib.parse.quote(q)


def main() -> None:
    parser = argparse.ArgumentParser(description='電話番号未登録企業をCSVエクスポート')
    parser.add_argument('--city',     required=True, choices=list(CITY_CONFIGS.keys()))
    parser.add_argument('--industry', help='業種で絞り込み（例: 製造業）')
    parser.add_argument('--limit',    type=int, help='出力件数上限')
    parser.add_argument('--output',   help='出力CSVファイルパス（省略時は標準出力）')
    args = parser.parse_args()

    json_path = CITY_CONFIGS[args.city]['output_path']
    if not os.path.exists(json_path):
        print(f'ERROR: companies.json が見つかりません: {json_path}', file=sys.stderr)
        sys.exit(1)

    with open(json_path, encoding='utf-8') as f:
        companies = json.load(f)

    missing = [c for c in companies if not c.get('isTelAvailable')]

    if args.industry:
        missing = [c for c in missing if c.get('industry') == args.industry]

    if args.limit:
        missing = missing[:args.limit]

    rows = [
        {
            'company_name': c['name'],
            'industry':     c['industry'],
            'address':      c.get('address', ''),
            'search_url':   build_search_url(c['name']),
            'map_url':      build_map_url(c.get('address', ''), c['name']),
            'tel':          '',
        }
        for c in missing
    ]

    fieldnames = ['company_name', 'industry', 'address', 'search_url', 'map_url', 'tel']

    if args.output:
        os.makedirs(os.path.dirname(args.output) or '.', exist_ok=True)
        with open(args.output, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        print(f'✅ {len(rows)} 件を {args.output} に出力しました')

        by_industry: dict = {}
        for r in rows:
            by_industry[r['industry']] = by_industry.get(r['industry'], 0) + 1
        for ind, cnt in sorted(by_industry.items()):
            print(f'  {ind}: {cnt} 件')
    else:
        writer = csv.DictWriter(sys.stdout, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


if __name__ == '__main__':
    main()
