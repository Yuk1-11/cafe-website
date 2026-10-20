const { createHash, randomBytes, timingSafeEqual } = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, Timestamp, getFirestore } = require("firebase-admin/firestore");
const { defineSecret } = require("firebase-functions/params");
const { HttpsError, onCall } = require("firebase-functions/v2/https");

initializeApp();
const db = getFirestore();
const adminAuth = getAuth();
const staffPassphrase = defineSecret("STAFF_PASSPHRASE");
const ORDER_STATUSES = ["受付済み", "調理中", "受け渡し待ち", "受け渡し済み", "取消"];
const STAFF_UID = "dot-cafe-passphrase-staff";
const STAFF_ACCESS_START = Date.parse("2026-11-13T00:00:00+09:00");
const STAFF_ACCESS_END = Date.parse("2026-11-14T00:00:00+09:00");
const STAFF_TEST_SESSION_MS = 10 * 60 * 1000;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const DEFAULT_PRODUCTS = [
  { id: "coffee", name: "ドットラテ", description: "まろやかミルクと香ばしいコーヒー。ほっとする定番の一杯。", price: 350, emoji: "☕", stock: 20, order: 1, active: true },
  { id: "tea", name: "しゅわしゅわソーダ", description: "カラフルな果実を浮かべた、見た目も楽しいソーダ。", price: 400, emoji: "🥤", stock: 12, order: 2, active: true },
  { id: "cake", name: "水玉クリームケーキ", description: "ふんわりスポンジに、ころんとかわいい水玉クリーム。", price: 450, emoji: "🍰", stock: 8, order: 3, active: true },
  { id: "cookie", name: "ドットクッキー", description: "さくさく手作り。コーヒーと一緒にどうぞ。", price: 200, emoji: "🍪", stock: 0, order: 4, active: true }
];
const PRODUCT_FIELDS = ["name", "description", "price", "emoji", "stock"];
const PICKUP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const isProductId = value =>
  typeof value === "string" && (/^[a-f0-9]{24}$/.test(value) || ["coffee", "tea", "cake", "cookie"].includes(value));

const generatePickupCode = () => Array.from({ length: 5 }, () => PICKUP_ALPHABET[Math.floor(Math.random() * PICKUP_ALPHABET.length)]).join("");

const validateProduct = product => {
  if (typeof product?.name !== "string" || product.name.trim().length < 1 || product.name.trim().length > 40 ||
    typeof product.description !== "string" || product.description.trim().length < 1 || product.description.trim().length > 120 ||
    !Number.isInteger(product.price) || product.price < 0 || product.price > 1000000 ||
    typeof product.emoji !== "string" || [...product.emoji.trim()].length < 1 || [...product.emoji.trim()].length > 4 ||
    !Number.isInteger(product.stock) || product.stock < 0 || product.stock > 10000) {
    throw new HttpsError("invalid-argument", "商品名・説明・価格・絵文字・在庫数を正しく入力してください。");
  }
};

const requireStaff = request => {
  if (!request.auth || request.auth.token.staff !== true ||
    !Number.isSafeInteger(request.auth.token.staffExpiresAt) ||
    request.auth.token.staffExpiresAt <= Date.now()) {
    throw new HttpsError("permission-denied", "スタッフ権限が必要です。");
  }
};

const consumeLoginAttempt = async request => {
  const ip = request.rawRequest.ip;
  if (!ip) throw new HttpsError("unavailable", "接続元を確認できません。時間をおいて再度お試しください。");

  const ipHash = createHash("sha256").update(ip).digest("hex");
  const attemptRef = db.collection("staffPassphraseAttempts").doc(ipHash);
  const now = Date.now();
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(attemptRef);
    const data = snapshot.data();
    const windowEndsAt = data?.windowEndsAt?.toMillis() || 0;
    const attempts = windowEndsAt > now ? data.attempts : 0;
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      throw new HttpsError("resource-exhausted", "試行回数が上限に達しました。15分後に再度お試しください。");
    }
    transaction.set(attemptRef, {
      attempts: attempts + 1,
      windowEndsAt: Timestamp.fromMillis(windowEndsAt > now ? windowEndsAt : now + LOGIN_ATTEMPT_WINDOW_MS)
    });
  });
};

exports.signInStaffWithPassphrase = onCall(
  { secrets: [staffPassphrase], maxInstances: 2 },
  async request => {
    const passphrase = request.data?.passphrase;
    if (typeof passphrase !== "string" || passphrase.length < 1 || passphrase.length > 256) {
      throw new HttpsError("invalid-argument", "合言葉を入力してください。");
    }

    await consumeLoginAttempt(request);
    const expected = Buffer.from(staffPassphrase.value());
    const received = Buffer.from(passphrase);
    if (expected.length < 16) {
      throw new HttpsError("failed-precondition", "管理者が16文字以上の合言葉を設定する必要があります。");
    }
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      throw new HttpsError("unauthenticated", "合言葉が正しくありません。");
    }

    const now = Date.now();
    let staffExpiresAt;
    if (now >= STAFF_ACCESS_START && now < STAFF_ACCESS_END) {
      staffExpiresAt = STAFF_ACCESS_END;
    } else if (now < STAFF_ACCESS_START) {
      const testExpiresAt = Math.min(now + STAFF_TEST_SESSION_MS, STAFF_ACCESS_START);
      if (testExpiresAt <= now) {
        throw new HttpsError("failed-precondition", "事前確認ログインの有効期限が終了しました。");
      }
      staffExpiresAt = testExpiresAt;
      const testRef = db.collection("staffPassphraseTests").doc("one-time-login");
      const testToken = await adminAuth.createCustomToken(STAFF_UID, {
        staff: true,
        staffExpiresAt: testExpiresAt
      });
      await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(testRef);
        if (snapshot.exists) {
          throw new HttpsError("failed-precondition", "事前確認ログインは既に使用されています。");
        }
        transaction.create(testRef, { usedAt: FieldValue.serverTimestamp() });
      });
      return { customToken: testToken, staffExpiresAt, isTestLogin: true };
    } else {
      throw new HttpsError("failed-precondition", "合言葉の有効期間は終了しました。");
    }

    const customToken = await adminAuth.createCustomToken(STAFF_UID, {
      staff: true,
      staffExpiresAt
    });
    return { customToken, staffExpiresAt, isTestLogin: false };
  }
);

const getTokyoDate = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

exports.createOrder = onCall(async request => {
  const tableNumber = request.data?.tableNumber;
  if (tableNumber === undefined || tableNumber === null) {
    throw new HttpsError("invalid-argument", "卓番号が未指定です。卓番号付きのQRコードからアクセスしてください。");
  }
  if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 10) {
    throw new HttpsError("invalid-argument", "卓番号は1〜10番の範囲で指定してください。");
  }

  const items = request.data?.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
    throw new HttpsError("invalid-argument", "注文する商品を選択してください。");
  }

  const quantities = new Map();
  for (const item of items) {
    if (typeof item?.id !== "string" || !/^[a-z0-9-]{1,40}$/.test(item.id) ||
      !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
      throw new HttpsError("invalid-argument", "商品または数量が正しくありません。");
    }
    quantities.set(item.id, (quantities.get(item.id) || 0) + item.quantity);
  }
  if ([...quantities.values()].some(quantity => quantity > 20)) {
    throw new HttpsError("invalid-argument", "商品ごとの注文数は20点までです。");
  }

  const productRefs = [...quantities.keys()].map(id => db.collection("products").doc(id));
  const orderRef = db.collection("orders").doc();
  const orderDate = getTokyoDate();
  const counterRef = db.collection("orderCounters").doc(orderDate);
  const trackingToken = randomBytes(32).toString("hex");
  const trackingHash = createHash("sha256").update(trackingToken).digest("hex");
  const pickupCode = generatePickupCode();
  let response;

  await db.runTransaction(async transaction => {
    const productSnapshots = await Promise.all(productRefs.map(ref => transaction.get(ref)));
    const counterSnapshot = await transaction.get(counterRef);
    const orderItems = [];
    let total = 0;

    for (const snapshot of productSnapshots) {
      const product = snapshot.data();
      const quantity = quantities.get(snapshot.id);
      if (!product || product.active === false || !Number.isInteger(product.stock) ||
        product.stock < quantity || !Number.isInteger(product.price) ||
        product.price < 0 || product.price > 1000000) {
        throw new HttpsError("failed-precondition", `${product?.name || "商品"}は売り切れ、または在庫不足です。`);
      }
      orderItems.push({
        productId: snapshot.id,
        name: product.name,
        price: product.price,
        quantity
      });
      total += product.price * quantity;
    }
    if (!Number.isSafeInteger(total)) {
      throw new HttpsError("failed-precondition", "注文金額を計算できませんでした。");
    }

    const nextNumber = (counterSnapshot.data()?.count || 0) + 1;
    const orderNumber = `D${orderDate.replaceAll("-", "").slice(2)}-${String(nextNumber).padStart(3, "0")}`;
    for (const snapshot of productSnapshots) {
      transaction.update(snapshot.ref, { stock: snapshot.data().stock - quantities.get(snapshot.id) });
    }
    transaction.set(counterRef, { count: nextNumber });
    transaction.set(orderRef, {
      orderNumber,
      items: orderItems,
      total,
      status: ORDER_STATUSES[0],
      pickupCode,
      trackingHash,
      createdAt: FieldValue.serverTimestamp()
    });
    response = { orderNumber, trackingToken, pickupCode };
  });

  return response;
});

exports.getOrderStatus = onCall(async request => {
  const orderNumber = request.data?.orderNumber;
  const trackingToken = request.data?.trackingToken;
  if (typeof orderNumber !== "string" || !/^D\d{6}-\d{3,}$/.test(orderNumber) ||
    typeof trackingToken !== "string" || !/^[a-f0-9]{64}$/.test(trackingToken)) {
    throw new HttpsError("invalid-argument", "注文番号または確認コードが正しくありません。");
  }

  const snapshot = await db.collection("orders").where("orderNumber", "==", orderNumber).limit(1).get();
  if (snapshot.empty) throw new HttpsError("not-found", "注文が見つかりません。");
  const order = snapshot.docs[0].data();
  const expected = Buffer.from(order.trackingHash || "", "hex");
  const received = Buffer.from(createHash("sha256").update(trackingToken).digest("hex"), "hex");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new HttpsError("permission-denied", "注文を確認できません。");
  }
  return { orderNumber, status: order.status };
});

exports.updateOrderStatus = onCall(async request => {
  requireStaff(request);
  const { orderId, status } = request.data || {};
  if (typeof orderId !== "string" || !/^[a-zA-Z0-9]{20}$/.test(orderId) || !ORDER_STATUSES.includes(status)) {
    throw new HttpsError("invalid-argument", "注文番号または注文状況が正しくありません。");
  }
  const orderRef = db.collection("orders").doc(orderId);
  await db.runTransaction(async transaction => {
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists) throw new HttpsError("not-found", "注文が見つかりません。");
    const order = orderSnapshot.data();

    if (order.status === "取消") {
      if (status === "取消") return;
      throw new HttpsError("failed-precondition", "取消し済みの注文は変更できません。");
    }
    if (status === "取消" && order.status === "受け渡し済み") {
      throw new HttpsError("failed-precondition", "受け渡し済みの注文は取り消せません。");
    }

    if (status === "取消") {
      if (!Array.isArray(order.items) || order.items.length === 0) {
        throw new HttpsError("failed-precondition", "注文内容を確認できないため、在庫を戻せません。");
      }

      const quantities = new Map();
      for (const item of order.items) {
        if (!isProductId(item?.productId) || !Number.isInteger(item.quantity) || item.quantity < 1) {
          throw new HttpsError("failed-precondition", "注文内容を確認できないため、在庫を戻せません。");
        }
        quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
      }

      const productRefs = [...quantities.keys()].map(id => db.collection("products").doc(id));
      const productSnapshots = await Promise.all(productRefs.map(ref => transaction.get(ref)));
      for (const snapshot of productSnapshots) {
        const stock = snapshot.data()?.stock;
        const restoredStock = stock + quantities.get(snapshot.id);
        if (!snapshot.exists || !Number.isInteger(stock) || stock < 0 || restoredStock > 10000) {
          throw new HttpsError("failed-precondition", "在庫数を正しく戻せないため、注文を取り消せません。");
        }
        transaction.update(snapshot.ref, { stock: restoredStock });
      }
    }

    transaction.update(orderRef, { status, updatedAt: FieldValue.serverTimestamp() });
  });
  return { success: true };
});

exports.updateProductStock = onCall(async request => {
  requireStaff(request);
  const { productId, stock } = request.data || {};
  if (typeof productId !== "string" || !/^[a-z0-9-]{1,40}$/.test(productId) ||
    !Number.isInteger(stock) || stock < 0 || stock > 10000) {
    throw new HttpsError("invalid-argument", "商品または在庫数が正しくありません。");
  }
  const productRef = db.collection("products").doc(productId);
  const product = await productRef.get();
  if (!product.exists) throw new HttpsError("not-found", "商品が見つかりません。");
  await productRef.update({ stock });
  return { success: true };
});

exports.saveProduct = onCall(async request => {
  requireStaff(request);
  const product = request.data || {};
  const productId = product.productId;
  if (productId !== undefined && !isProductId(productId)) {
    throw new HttpsError("invalid-argument", "商品IDが正しくありません。");
  }
  validateProduct(product);
  const productRef = productId
    ? db.collection("products").doc(productId)
    : db.collection("products").doc(randomBytes(12).toString("hex"));

  if (productId) {
    const existing = await productRef.get();
    if (!existing.exists) throw new HttpsError("not-found", "商品が見つかりません。");
    const data = Object.fromEntries(PRODUCT_FIELDS.map(field => [
      field,
      typeof product[field] === "string" ? product[field].trim() : product[field]
    ]));
    await productRef.update(data);
  } else {
    const data = Object.fromEntries(PRODUCT_FIELDS.map(field => [
      field,
      typeof product[field] === "string" ? product[field].trim() : product[field]
    ]));
    await productRef.set({
      ...data,
      order: Date.now(),
      active: true
    });
  }
  return { productId: productRef.id };
});

exports.setProductActive = onCall(async request => {
  requireStaff(request);
  const { productId, active } = request.data || {};
  if (!isProductId(productId) ||
    typeof active !== "boolean") {
    throw new HttpsError("invalid-argument", "商品または販売状態が正しくありません。");
  }
  const productRef = db.collection("products").doc(productId);
  const product = await productRef.get();
  if (!product.exists) throw new HttpsError("not-found", "商品が見つかりません。");
  await productRef.update({ active });
  return { success: true };
});

exports.initializeCatalog = onCall(async request => {
  requireStaff(request);
  const productsRef = db.collection("products");
  await db.runTransaction(async transaction => {
    const existing = await transaction.get(productsRef.limit(1));
    if (!existing.empty) return;
    for (const product of DEFAULT_PRODUCTS) {
      const { id, ...data } = product;
      transaction.set(productsRef.doc(id), data);
    }
  });
  return { success: true };
});
