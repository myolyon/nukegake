// ============================================================
// 初期セットアップ
// 1. 新しいGoogleスプレッドシートを作成
// 2. 6つのシートを作成してヘッダーを設定
// 3. 初期マスタデータを投入
// 4. スプレッドシートIDをスクリプトプロパティに保存
// ============================================================

function setupAll() {
  const ss = SpreadsheetApp.create('nukegake_DB');
  const ssId = ss.getId();

  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ssId);
  Logger.log('スプレッドシートID: ' + ssId);

  setupPrefectureSheet(ss);
  setupCitySheet(ss);
  setupIndustrySheet(ss);
  setupCompanySheet(ss);
  setupUserSheet(ss);
  setupKpiSheet(ss);

  // デフォルトの「シート1」を削除
  const defaultSheet = ss.getSheetByName('シート1');
  if (defaultSheet) ss.deleteSheet(defaultSheet);

  Logger.log('セットアップ完了: ' + ss.getUrl());
}

function setupPrefectureSheet(ss) {
  const sheet = ss.insertSheet(SHEET.PREFECTURE);
  const headers = ['都道府県コード', '都道府県名', 'status'];
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

  const prefectures = [
    ['01','北海道','pending'],['02','青森県','pending'],['03','岩手県','pending'],
    ['04','宮城県','pending'],['05','秋田県','pending'],['06','山形県','pending'],
    ['07','福島県','pending'],['08','茨城県','pending'],['09','栃木県','pending'],
    ['10','群馬県','pending'],['11','埼玉県','pending'],['12','千葉県','pending'],
    ['13','東京都','pending'],['14','神奈川県','pending'],['15','新潟県','pending'],
    ['16','富山県','pending'],['17','石川県','pending'],['18','福井県','pending'],
    ['19','山梨県','pending'],['20','長野県','pending'],['21','岐阜県','pending'],
    ['22','静岡県','pending'],['23','愛知県','pending'],['24','三重県','pending'],
    ['25','滋賀県','pending'],['26','京都府','pending'],['27','大阪府','active'],
    ['28','兵庫県','pending'],['29','奈良県','pending'],['30','和歌山県','pending'],
    ['31','鳥取県','pending'],['32','島根県','pending'],['33','岡山県','pending'],
    ['34','広島県','pending'],['35','山口県','pending'],['36','徳島県','pending'],
    ['37','香川県','pending'],['38','愛媛県','pending'],['39','高知県','pending'],
    ['40','福岡県','pending'],['41','佐賀県','pending'],['42','長崎県','pending'],
    ['43','熊本県','pending'],['44','大分県','pending'],['45','宮崎県','pending'],
    ['46','鹿児島県','pending'],['47','沖縄県','pending'],
  ];
  sheet.getRange(2, 1, prefectures.length, 3).setValues(prefectures);
}

function setupCitySheet(ss) {
  const sheet = ss.insertSheet(SHEET.CITY);
  const headers = ['市区町村コード', '都道府県コード', '都道府県名', '市区町村名', 'status'];
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

  // 初期リリース：堺市の7区のみactive
  const cities = [
    ['27141','27','大阪府','堺市堺区','active'],
    ['27142','27','大阪府','堺市中区','active'],
    ['27143','27','大阪府','堺市東区','active'],
    ['27144','27','大阪府','堺市西区','active'],
    ['27145','27','大阪府','堺市南区','active'],
    ['27146','27','大阪府','堺市北区','active'],
    ['27147','27','大阪府','堺市美原区','active'],
  ];
  sheet.getRange(2, 1, cities.length, 5).setValues(cities);
}

function setupIndustrySheet(ss) {
  const sheet = ss.insertSheet(SHEET.INDUSTRY);
  const headers = ['業種コード', '業種名'];
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

  const industries = [
    ['01','建設業'],
    ['02','製造業'],
    ['03','卸売業'],
    ['04','小売業'],
    ['05','不動産業'],
    ['06','宿泊・飲食業'],
    ['07','情報通信業'],
    ['08','運輸業'],
    ['09','医療・福祉'],
    ['10','教育・学習支援'],
    ['11','サービス業'],
    ['12','金融・保険業'],
    ['13','その他'],
  ];
  sheet.getRange(2, 1, industries.length, 2).setValues(industries);
}

function setupCompanySheet(ss) {
  const sheet = ss.insertSheet(SHEET.COMPANY);
  const headers = [
    '法人番号','会社名','ふりがな','種別',
    '都道府県コード','市区町村コード','都道府県名','市区町村名','住所',
    '電話番号','業種コード','業種名','会社URL',
    '登録日','更新日',
  ];
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

function setupUserSheet(ss) {
  const sheet = ss.insertSheet(SHEET.USER);
  const headers = [
    'ユーザーID','メール','名前','プラン',
    '有効期限','Stripe顧客ID','登録日','最終ログイン',
  ];
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

function setupKpiSheet(ss) {
  const sheet = ss.insertSheet(SHEET.KPI);
  sheet.appendRow(['KPIダッシュボード']);
  sheet.getRange('A1').setFontSize(16).setFontWeight('bold');

  const kpiLabels = [
    ['',''],
    ['登録ユーザー数', "=COUNTA('" + SHEET.USER + "'!A:A)-1"],
    ['無料ユーザー',   "=COUNTIF('" + SHEET.USER + "'!D:D,\"" + PLAN.FREE + "\")"],
    ['早期限定ユーザー',"=COUNTIF('" + SHEET.USER + "'!D:D,\"" + PLAN.EARLY + "\")"],
    ['月額ユーザー',   "=COUNTIF('" + SHEET.USER + "'!D:D,\"" + PLAN.MONTHLY + "\")"],
    ['年額ユーザー',   "=COUNTIF('" + SHEET.USER + "'!D:D,\"" + PLAN.YEARLY + "\")"],
    ['',''],
    ['企業登録数',     "=COUNTA('" + SHEET.COMPANY + "'!A:A)-1"],
    ['大阪府堺市',     "=COUNTIF('" + SHEET.COMPANY + "'!G:G,\"大阪府\")"],
  ];
  sheet.getRange(2, 1, kpiLabels.length, 2).setValues(kpiLabels);
}
