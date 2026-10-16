const { createHash, randomBytes, timingSafeEqual } = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");

initializeApp();
const db = getFirestore();
const ORDER_STATUSES = ["受付済み", "調理中", "受け渡し待ち", "受け渡し済み"];
const DEFAULT_PRODUCTS = [
  { id: "coffee", name: "ドットラテ", description: "まろやかミルクと香ばしいコーヒー。ほっとする定番の一杯。", price: 350, emoji: "☕", stock: 20, order: 1, active: true },
  { id: "tea", name: "しゅわしゅわソーダ", description: "カラフルな果実を浮かべた、見た目も楽しいソーダ。", price: 400, emoji: "🥤", stock: 12, order: 2, active: true },
  { id: "cake", name: "水玉クリームケーキ", description: "ふんわりスポンジに、ころんとかわいい水玉クリーム。", price: 450, emoji: "🍰", stock: 8, order: 3, active: true },
  { id: "cookie", name: "ドットクッキー", description: "さくさく手作り。コーヒーと一緒にどうぞ。", price: 200, emoji: "🍪", stock: 0, order: 4, active: true }
];

const requireStaff = request => {
  if (!request.auth || request.auth.token.staff !== true) {
    throw new HttpsError("permission-denied", "スタッフ権限が必要です。");
  }
};

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
      trackingHash,
      createdAt: FieldValue.serverTimestamp()
    });
    response = { orderNumber, trackingToken };
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
  const order = await orderRef.get();
  if (!order.exists) throw new HttpsError("not-found", "注文が見つかりません。");
  await orderRef.update({ status, updatedAt: FieldValue.serverTimestamp() });
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
