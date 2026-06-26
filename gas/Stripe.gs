// ============================================================
// STEP5: Stripe決済処理
//
// 料金プラン:
//   early:   月500円（早期限定・先着50名）
//   monthly: 月980円
//   yearly:  年9800円
//
// 事前準備:
// 1. Stripe DashboardでPrice IDを作成
// 2. スクリプトプロパティに設定:
//    STRIPE_SECRET_KEY       = sk_live_xxx
//    STRIPE_WEBHOOK_SECRET   = whsec_xxx
//    STRIPE_PRICE_EARLY      = price_xxx
//    STRIPE_PRICE_MONTHLY    = price_xxx
//    STRIPE_PRICE_YEARLY     = price_xxx
// ============================================================

const STRIPE_API = 'https://api.stripe.com/v1';

// プラン選択時にCheckout Sessionを作成する
function createCheckoutSession(userEmail, planType, successUrl, cancelUrl) {
  const props = PropertiesService.getScriptProperties();
  const secretKey = props.getProperty('STRIPE_SECRET_KEY');
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY が未設定です');

  const priceId = getPriceId(planType, props);
  if (!priceId) throw new Error('無効なプランタイプ: ' + planType);

  // 早期限定プランの先着チェック
  if (planType === PLAN.EARLY) {
    const config = getConfig();
    const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET.USER);
    const data = sheet.getDataRange().getValues();
    const earlyCount = data.slice(1).filter(r => r[3] === PLAN.EARLY).length;
    if (earlyCount >= config.EARLY_LIMIT) {
      throw new Error('早期限定プランは定員に達しました');
    }
  }

  const payload = {
    'mode': 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    'customer_email': userEmail,
    'success_url': successUrl + '?session_id={CHECKOUT_SESSION_ID}',
    'cancel_url': cancelUrl,
    'metadata[plan]': planType,
    'metadata[email]': userEmail,
  };

  const res = UrlFetchApp.fetch(STRIPE_API + '/checkout/sessions', {
    method: 'post',
    headers: { 'Authorization': 'Bearer ' + secretKey },
    payload: payload,
    muteHttpExceptions: true,
  });

  const data = JSON.parse(res.getContentText());
  if (res.getResponseCode() !== 200) {
    throw new Error('Stripe API エラー: ' + (data.error && data.error.message));
  }

  return { sessionId: data.id, url: data.url };
}

// Stripe Webhookを処理する（doPostから呼ばれる）
function handleStripeWebhook(rawBody, signature) {
  const props = PropertiesService.getScriptProperties();
  const webhookSecret = props.getProperty('STRIPE_WEBHOOK_SECRET');

  if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
    throw new Error('Webhook署名の検証に失敗しました');
  }

  const event = JSON.parse(rawBody);
  Logger.log('Stripe event: ' + event.type);

  switch (event.type) {
    case 'checkout.session.completed':
      handleCheckoutCompleted(event.data.object);
      break;
    case 'invoice.payment_succeeded':
      handlePaymentSucceeded(event.data.object);
      break;
    case 'customer.subscription.deleted':
      handleSubscriptionCanceled(event.data.object);
      break;
  }
}

function handleCheckoutCompleted(session) {
  const email   = session.metadata && session.metadata.email;
  const planType = session.metadata && session.metadata.plan;
  const customerId = session.customer;
  if (!email || !planType) return;

  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET.USER);
  const data = sheet.getDataRange().getValues();

  const expires = calcExpiry(planType);

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === email) {
      sheet.getRange(i + 1, 4).setValue(planType);    // プラン
      sheet.getRange(i + 1, 5).setValue(expires);      // 有効期限
      sheet.getRange(i + 1, 6).setValue(customerId);   // Stripe顧客ID
      Logger.log('プラン更新: ' + email + ' → ' + planType);
      return;
    }
  }
}

function handlePaymentSucceeded(invoice) {
  const customerId = invoice.customer;
  if (!customerId) return;

  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET.USER);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][5] === customerId) {
      const planType = data[i][3];
      const expires = calcExpiry(planType);
      sheet.getRange(i + 1, 5).setValue(expires);
      Logger.log('支払い更新: ' + data[i][1] + ' 有効期限 → ' + expires);
      return;
    }
  }
}

function handleSubscriptionCanceled(subscription) {
  const customerId = subscription.customer;
  if (!customerId) return;

  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET.USER);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][5] === customerId) {
      sheet.getRange(i + 1, 4).setValue(PLAN.FREE);
      sheet.getRange(i + 1, 5).setValue('');
      Logger.log('解約: ' + data[i][1] + ' → 無料プランに変更');
      return;
    }
  }
}

function calcExpiry(planType) {
  const now = new Date();
  if (planType === PLAN.YEARLY) {
    now.setFullYear(now.getFullYear() + 1);
  } else {
    now.setMonth(now.getMonth() + 1);
  }
  return Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd');
}

function getPriceId(planType, props) {
  const map = {
    [PLAN.EARLY]:   'STRIPE_PRICE_EARLY',
    [PLAN.MONTHLY]: 'STRIPE_PRICE_MONTHLY',
    [PLAN.YEARLY]:  'STRIPE_PRICE_YEARLY',
  };
  return props.getProperty(map[planType]) || null;
}

// Stripe Webhookの署名検証
function verifyStripeSignature(payload, sigHeader, secret) {
  if (!sigHeader || !secret) return false;

  try {
    const parts = {};
    sigHeader.split(',').forEach(part => {
      const [k, v] = part.split('=');
      parts[k] = v;
    });

    const timestamp = parts['t'];
    const sig = parts['v1'];
    if (!timestamp || !sig) return false;

    // タイムスタンプ検証（5分以内）
    if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) return false;

    const signedPayload = timestamp + '.' + payload;
    const expected = Utilities.computeHmacSha256Signature(
      signedPayload,
      secret,
      Utilities.Charset.UTF_8
    );
    const expectedHex = expected.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');

    return expectedHex === sig;
  } catch (e) {
    Logger.log('署名検証エラー: ' + e.message);
    return false;
  }
}
