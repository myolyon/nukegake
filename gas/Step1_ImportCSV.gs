// ============================================================
// STEP1: 国税庁CSVを企業マスタに取り込む
//
// 事前準備:
// 1. scripts/download_nta_csv.sh を実行してCSVをダウンロード
// 2. 生成された sakai_filtered.csv をGoogle Driveにアップロード
// 3. ファイルIDをスクリプトプロパティ CSV_FILE_ID に設定
//
// 国税庁CSVの列構成 (0-indexed):
//  [1]  法人番号
//  [6]  商号又は名称
//  [8]  種別
//  [9]  都道府県コード
//  [10] 市区町村コード
//  [11] 町又は大字
//  [13] 都道府県名
//  [14] 市区町村名
//  [15] 丁目番地等
//  [19] 廃業等事由
//  [20] 廃業等年月日
//  [24] 最新履歴 (1=最新)
//  [25] ふりがな
//  [26] 検索対象除外 (1=除外)
// ============================================================

// 堺市の市区町村コード（大阪府内5桁コード）
const SAKAI_CITY_CODES = ['27141','27142','27143','27144','27145','27146','27147'];

// 法人種別コード → 名称
const KIND_MAP = {
  '101': '株式会社', '201': '有限会社', '301': '合名会社',
  '302': '合資会社', '303': '合同会社', '401': '企業組合',
  '402': '協業組合', '499': 'その他組合', '501': '医療法人',
  '502': '社会福祉法人', '503': '学校法人', '601': '国の機関',
  '701': '地方公共団体', '801': '外国会社等', '900': 'その他',
};

function importNtaCsv() {
  const props = PropertiesService.getScriptProperties();
  const csvFileId = props.getProperty('CSV_FILE_ID');
  if (!csvFileId) {
    throw new Error('スクリプトプロパティに CSV_FILE_ID を設定してください');
  }

  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET.COMPANY);

  const file = DriveApp.getFileById(csvFileId);
  const csvContent = file.getBlob().getDataAsString('UTF-8');
  const rows = Utilities.parseCsv(csvContent);

  Logger.log('読み込み行数: ' + rows.length);

  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  const newRows = [];
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 27) { skipped++; continue; }

    // ヘッダー行をスキップ
    if (row[1] === '法人番号') continue;

    // 最新履歴 = 1 のみ
    if (row[24] !== '1') { skipped++; continue; }

    // 検索対象除外 = 1 はスキップ
    if (row[26] === '1') { skipped++; continue; }

    // 廃業済みはスキップ
    if (row[20] && row[20].trim() !== '') { skipped++; continue; }

    const cityCode = row[10].trim();

    // 市区町村コードで絞り込み（堺市のみ）
    if (!SAKAI_CITY_CODES.includes(cityCode)) { skipped++; continue; }

    const address = (row[11] || '').trim() + (row[15] || '').trim();
    const kind = KIND_MAP[row[8]] || row[8] || '';

    newRows.push([
      row[1].trim(),     // 法人番号
      row[6].trim(),     // 会社名
      row[25].trim(),    // ふりがな
      kind,              // 種別
      row[9].trim(),     // 都道府県コード
      cityCode,          // 市区町村コード
      row[13].trim(),    // 都道府県名
      row[14].trim(),    // 市区町村名
      address,           // 住所
      '',                // 電話番号（STEP2で補完）
      '',                // 業種コード（STEP2で補完）
      '',                // 業種名（STEP2で補完）
      '',                // 会社URL
      today,             // 登録日
      today,             // 更新日
    ]);
  }

  Logger.log('インポート対象: ' + newRows.length + '件 / スキップ: ' + skipped + '件');

  if (newRows.length === 0) {
    Logger.log('インポートするデータがありませんでした');
    return;
  }

  // 既存データをクリアしてから書き込み（ヘッダー行は残す）
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 15).clearContent();
  }

  sheet.getRange(2, 1, newRows.length, 15).setValues(newRows);
  Logger.log('インポート完了: ' + newRows.length + '件');
}

// 重複チェック付きの増分インポート（既存データを保持したまま追加）
function importNtaCsvIncremental() {
  const props = PropertiesService.getScriptProperties();
  const csvFileId = props.getProperty('CSV_FILE_ID');
  if (!csvFileId) throw new Error('CSV_FILE_ID を設定してください');

  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET.COMPANY);

  // 既存の法人番号をセットに格納
  const existingData = sheet.getDataRange().getValues();
  const existingNos = new Set(existingData.slice(1).map(r => String(r[0])));

  const file = DriveApp.getFileById(csvFileId);
  const csvContent = file.getBlob().getDataAsString('UTF-8');
  const rows = Utilities.parseCsv(csvContent);
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  const newRows = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 27) continue;
    if (row[1] === '法人番号') continue;
    if (row[24] !== '1') continue;
    if (row[26] === '1') continue;
    if (row[20] && row[20].trim() !== '') continue;
    if (!SAKAI_CITY_CODES.includes(row[10].trim())) continue;
    if (existingNos.has(row[1].trim())) continue; // 重複スキップ

    const address = (row[11] || '').trim() + (row[15] || '').trim();
    newRows.push([
      row[1].trim(), row[6].trim(), row[25].trim(),
      KIND_MAP[row[8]] || row[8] || '',
      row[9].trim(), row[10].trim(), row[13].trim(), row[14].trim(),
      address, '', '', '', '', today, today,
    ]);
  }

  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 15).setValues(newRows);
  }
  Logger.log('追加インポート: ' + newRows.length + '件');
}
