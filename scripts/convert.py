#!/usr/bin/env python3
"""
nukegake データ変換スクリプト
法人番号CSVから各都市の企業情報JSONを生成する。

Usage:
  python scripts/convert.py --input ~/Downloads/27_osaka.csv --city sakai
  python scripts/convert.py --input data.csv --city osaka
  python scripts/convert.py --input data.csv --city kobe
  python scripts/convert.py --input data.csv --city kyoto
"""

import argparse
import csv
import json
import os
import re
import sys
from typing import Optional

# ============================================================
# 都市設定（横展開時はここに追加するだけ）
# ============================================================
CITY_CONFIGS: dict = {
    'sakai': {
        'city_id':      'sakai',
        'city_keyword': '堺市',
        'prefecture':   '大阪府',
        'output_path':  'docs/data/sakai/companies.json',
        'industries':   ['製造業', '建設業', '運送業'],
    },
    'osaka': {
        'city_id':      'osaka',
        'city_keyword': '大阪市',
        'prefecture':   '大阪府',
        'output_path':  'docs/data/osaka/companies.json',
        'industries':   ['製造業', '建設業', '運送業'],
    },
    'kobe': {
        'city_id':      'kobe',
        'city_keyword': '神戸市',
        'prefecture':   '兵庫県',
        'output_path':  'docs/data/kobe/companies.json',
        'industries':   ['製造業', '建設業', '運送業'],
    },
    'kyoto': {
        'city_id':      'kyoto',
        'city_keyword': '京都市',
        'prefecture':   '京都府',
        'output_path':  'docs/data/kyoto/companies.json',
        'industries':   ['製造業', '建設業', '運送業'],
    },
}

# ============================================================
# 業種キーワード（会社名から機械的に分類）
# 法人番号データには業種情報がないため名称マッチで推定する
# ============================================================
INDUSTRY_KEYWORDS: dict = {
    '製造業': [
        '製作所', '製造', '工業', '工場', '鉄銖', '鉄工', '金属',
        '機械', '精密', '電機', '電子', '部品', '鉄造', '鴬造', 'プレス',
        '加工', '化学', '製品', '印刷', '食品', 'ゴム', 'プラスチック',
        '繊維', '紡總', '合成', 'メーカー', '伸線', '钔造', '金型',
    ],
    '建設業': [
        '建設', '建工', '工務店', '土木', '建築', '組', '建材',
        '住建', '住宅', 'ハウス', '内装', '塗装', '電気工事',
        '設備工事', '管工事', '左官', '屋根', '湯谷', '外壁', '橋梁',
    ],
    '運送業': [
        '運送', '物流', '運輸', '配送', '配達', 'ロジスティクス',
        'ロジスティックス', '急送', '急配', '宅配', '通運',
        '倉庫', 'トランスポート',
    ],
}


def classify_industry(name: str) -> Optional[str]:
    """会社名から業種を推定する"""
    for industry, keywords in INDUSTRY_KEYWORDS.items():
        for kw in keywords:
            if kw in name:
                return industry
    return None


# ============================================================
# 電話番号正規化
# ============================================================
def normalize_phone(raw: str) -> Optional[str]:
    """電話番号を 0XX-XXX-XXXX 形式に整形する"""
    if not raw:
        return None
    digits = re.sub(r'[^\d]', '', raw)
    if len(digits) == 11:  # 携帯電話
        return f'{digits[:3]}-{digits[3:7]}-{digits[7:]}'
    elif len(digits) == 10:
        if digits.startswith('0120') or digits.startswith('0800'):
            return f'{digits[:4]}-{digits[4:7]}-{digits[7:]}'
        return f'{digits[:3]}-{digits[3:6]}-{digits[6:]}'
    return None


# ============================================================
# CSVカラム候補（異なるCSVソースに対応）
# ============================================================
COLUMN_ALIASES: dict = {
    'name':    ['法人名', '会社名', 'name', '名称'],
    'pref':    ['都道府県名', '都道府県', 'prefecture'],
    'city':    ['市区町村名', '市区町村', 'city'],
    'address': ['丁目番地等', '番地', '住所', 'address'],
    'tel':     ['電話番号', 'tel', 'phone', '電話'],
    'closed':  ['閉鎖フラグ', 'closed'],
}


def find_col(headers: list, key: str) -> Optional[str]:
    """ヘッダリストから対応カラム名を返す"""
    for alias in COLUMN_ALIASES.get(key, []):
        if alias in headers:
            return alias
    return None


# ============================================================
# エンコーディング自動検出
# ============================================================
def detect_encoding(path: str) -> str:
    for enc in ['utf-8-sig', 'utf-8', 'cp932', 'shift_jis']:
        try:
            with open(path, encoding=enc, newline='') as f:
                f.read(4096)
            return enc
        except (UnicodeDecodeError, LookupError):
            continue
    return 'utf-8'


# ============================================================
# メイン処理
# ============================================================
def process_csv(input_path: str, city_id: str) -> list:
    config = CITY_CONFIGS[city_id]
    city_keyword = config['city_keyword']
    target_industries = config['industries']

    encoding = detect_encoding(input_path)
    print(f'エンコーディング: {encoding}')

    companies = []
    seen = set()
    company_id = 1
    skipped_city = skipped_industry = skipped_dup = skipped_empty = 0

    with open(input_path, encoding=encoding, newline='') as f:
        reader = csv.DictReader(f)
        headers = list(reader.fieldnames or [])

        col_name    = find_col(headers, 'name')
        col_pref    = find_col(headers, 'pref')
        col_city    = find_col(headers, 'city')
        col_address = find_col(headers, 'address')
        col_tel     = find_col(headers, 'tel')
        col_closed  = find_col(headers, 'closed')

        if not col_name:
            print(f'ERROR: 会社名カラムが見つかりません。\nヘッダー: {headers}', file=sys.stderr)
            sys.exit(1)

        for row in reader:
            # 閉鎖法人を除外
            if col_closed and row.get(col_closed, '0').strip() == '1':
                continue

            # 名称の空データ除去
            name = (row.get(col_name) or '').strip()
            if not name:
                skipped_empty += 1
                continue

            # 都市フィルター
            city_val = (row.get(col_city) or '').strip() if col_city else ''
            if col_city and city_keyword not in city_val:
                skipped_city += 1
                continue

            # 業種分類（キーワードマッチ）
            industry = classify_industry(name)
            if industry not in target_industries:
                skipped_industry += 1
                continue

            # 重複除去（名称+市区町村の組合せ）
            dedup_key = name + city_val
            if dedup_key in seen:
                skipped_dup += 1
                continue
            seen.add(dedup_key)

            # 住所組み立て
            pref_val    = (row.get(col_pref) or '').strip() if col_pref else ''
            addr_detail = (row.get(col_address) or '').strip() if col_address else ''
            address = pref_val + city_val + addr_detail

            # 電話番号
            raw_tel = (row.get(col_tel) or '').strip() if col_tel else ''
            tel = normalize_phone(raw_tel)

            companies.append({
                'id':             company_id,
                'name':           name,
                'industry':       industry,
                'address':        address,
                'tel':            tel or '',
                'isTelAvailable': tel is not None,
                'city':           config['city_id'],
            })
            company_id += 1

    print(f'  都市除外: {skipped_city}')
    print(f'  業種除外: {skipped_industry}')
    print(f'  重複除外: {skipped_dup}')
    print(f'  空データ除外: {skipped_empty}')
    return companies


def save_json(companies: list, output_path: str) -> None:
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(companies, f, ensure_ascii=False, indent=2)
    print(f'\n✅ {len(companies)} 件を {output_path} に出力しました')


def print_summary(companies: list) -> None:
    by_industry: dict = {}
    no_tel = 0
    for c in companies:
        by_industry[c['industry']] = by_industry.get(c['industry'], 0) + 1
        if not c['isTelAvailable']:
            no_tel += 1
    print('\n--- サマリー ---')
    for ind in sorted(by_industry):
        print(f'  {ind}: {by_industry[ind]} 件')
    tel_count = len(companies) - no_tel
    print(f'  電話番号あり: {tel_count} 件 / なし: {no_tel} 件')


def main() -> None:
    parser = argparse.ArgumentParser(
        description='法人番号CSVからnukegake用JSONを生成',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
例:
  python scripts/convert.py --input ~/Downloads/27_osaka.csv --city sakai
  python scripts/convert.py --input ~/Downloads/28_hyogo.csv --city kobe

入力CSVダウンロード先:
  https://www.houjin-bangou.nta.go.jp/download/todofuken/
  → 当該都道府県を選択してダウンロード
        '''
    )
    parser.add_argument('--input', required=True, help='入力CSVファイルパス')
    parser.add_argument('--city',  required=True, choices=list(CITY_CONFIGS.keys()),
                        help=f'都市ID: {" / ".join(CITY_CONFIGS.keys())}')
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f'ERROR: ファイルが見つかりません: {args.input}', file=sys.stderr)
        sys.exit(1)

    print(f'処理中: {args.input} → [{args.city}]')
    companies = process_csv(args.input, args.city)

    output_path = CITY_CONFIGS[args.city]['output_path']
    save_json(companies, output_path)
    print_summary(companies)


if __name__ == '__main__':
    main()
