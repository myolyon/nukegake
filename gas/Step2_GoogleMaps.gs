// ============================================================
// STEP2: Google Maps APIで電話番号・業種を補完
//
// 事前準備:
// GCP コンソールで Places API を有効化し
// APIキーをスクリプトプロパティ MAPS_API_KEY に設定
//
// 注意: Places API は $17/1000件 (月$200クレジット内なら無料)
// 1回の実行で最大200件処理（6分制限対策）
// ============================================================

const PLACES_API = 'https://maps.googleapis.com/maps/api/place';

// 業種マッピング（Google Places types → 業種マスタコード）
const GOOGLE_TYPE_MAP = {
  'general_contractor':          '01', // 建設業
  'electrician':                 '01',
  'plumber':                     '01',
  'roofing_contractor':          '01',
  'car_dealer':                  '02', // 製造業（便宜上）
  'car_repair':                  '02',
  'food_establishment':          '06', // 宿泊・飲食業
  'restaurant':                  '06',
  'lodging':                     '06',
  'store':                       '04', // 小売業
  'supermarket':                 '04',
  'clothing_store':              '04',
  'real_estate_agency':          '05', // 不動産業
  'insurance_agency':            '12', // 金融・保険業
  'bank':                        '12',
  'hospital':                    '09', // 医療・福祉
  'doctor':                      '09',
  'dentist':                     '09',
  'school':                      '10', // 教育
  'university':                  '10',
  'lawyer':                      '11', // サービス業
  'accounting':                  '11',
  'it_company':                  '07', // 情報通信業
  'moving_company':              '08', // 運輸業
  'storage':                     '08',
};

function enrichCompaniesWithMaps() {
  const config = getConfig();
  if (!config.MAPS_API_KEY) {
    throw new Error('MAPS_API_KEY を設定してください');
  }

  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET.COMPANY);
  const data = sheet.getDataRange().getValues();

  // ヘッダー行はスキップ、電話番号が空の行を対象
  let processed = 0;
  const MAX_PER_RUN = 200; // 6分制限対策

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const phone = row[9];

    // 電話番号が既にある場合はスキップ
    if (phone && phone.toString().trim() !== '') continue;

    const name    = row[1];  // 会社名
    const address = row[6] + row[7] + row[8]; // 都道府県名+市区町村名+住所

    const result = searchPlace(name, address, config.MAPS_API_KEY);
    if (result) {
      // 電話番号
      sheet.getRange(i + 1, 10).setValue(result.phone || '');
      // 業種コード
      sheet.getRange(i + 1, 11).setValue(result.industryCode || '');
      // 業種名
      sheet.getRange(i + 1, 12).setValue(result.industryName || '');
      // 更新日
      const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
      sheet.getRange(i + 1, 15).setValue(today);
    }

    processed++;
    if (processed >= MAX_PER_RUN) {
      Logger.log(MAX_PER_RUN + '件処理完了。次回の実行で続きを処理します。');
      break;
    }

    // API制限対策（10件ごとに0.5秒待機）
    if (processed % 10 === 0) Utilities.sleep(500);
  }

  Logger.log('補完完了: ' + processed + '件');
}

function searchPlace(companyName, address, apiKey) {
  try {
    // Text Searchで会社を検索
    const query = encodeURIComponent(companyName + ' ' + address);
    const searchUrl = `${PLACES_API}/textsearch/json?query=${query}&language=ja&key=${apiKey}`;
    const searchRes = UrlFetchApp.fetch(searchUrl, { muteHttpExceptions: true });
    const searchData = JSON.parse(searchRes.getContentText());

    if (!searchData.results || searchData.results.length === 0) return null;

    const place = searchData.results[0];
    const placeId = place.place_id;

    // Place Detailsで詳細取得
    const detailUrl = `${PLACES_API}/details/json?place_id=${placeId}&fields=formatted_phone_number,types&language=ja&key=${apiKey}`;
    const detailRes = UrlFetchApp.fetch(detailUrl, { muteHttpExceptions: true });
    const detailData = JSON.parse(detailRes.getContentText());

    if (!detailData.result) return null;

    const detail = detailData.result;
    const phone  = (detail.formatted_phone_number || '').replace(/[- ]/g, '');
    const types  = detail.types || [];

    // Google Place types → 業種コード変換
    let industryCode = '13'; // デフォルト: その他
    let industryName = 'その他';
    for (const t of types) {
      if (GOOGLE_TYPE_MAP[t]) {
        industryCode = GOOGLE_TYPE_MAP[t];
        break;
      }
    }

    // 業種名をマスタから取得
    const industryNames = {
      '01':'建設業','02':'製造業','03':'卸売業','04':'小売業',
      '05':'不動産業','06':'宿泊・飲食業','07':'情報通信業','08':'運輸業',
      '09':'医療・福祉','10':'教育・学習支援','11':'サービス業',
      '12':'金融・保険業','13':'その他',
    };
    industryName = industryNames[industryCode] || 'その他';

    return { phone, industryCode, industryName };
  } catch (e) {
    Logger.log('Places API エラー [' + companyName + ']: ' + e.message);
    return null;
  }
}
