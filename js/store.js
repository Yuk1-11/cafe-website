export const DEFAULT_PRODUCTS = [
  { id: "coffee", name: "ドットラテ", description: "まろやかミルクと香ばしいコーヒー。ほっとする定番の一杯。", price: 350, emoji: "☕", stock: 20, order: 1, active: true },
  { id: "tea", name: "しゅわしゅわソーダ", description: "カラフルな果実を浮かべた、見た目も楽しいソーダ。", price: 400, emoji: "🥤", stock: 12, order: 2, active: true },
  { id: "cake", name: "水玉クリームケーキ", description: "ふんわりスポンジに、ころんとかわいい水玉クリーム。", price: 450, emoji: "🍰", stock: 8, order: 3, active: true },
  { id: "cookie", name: "ドットクッキー", description: "さくさく手作り。コーヒーと一緒にどうぞ。", price: 200, emoji: "🍪", stock: 0, order: 4, active: true }
];

export const getTableNumber = search => {
  const params = new URLSearchParams(search);
  const value = (params.get("table") || params.get("tableNumber") || "").trim();
  if (!value) return { number: null, error: "missing" };
  if ([...value].some(character => character < "0" || character > "9")) {
    return { number: null, error: "invalid" };
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > 10) {
    return { number: null, error: "range" };
  }
  return { number, error: null };
};

export const getCart = () => {
  try {
    const cart = JSON.parse(localStorage.getItem("cafe-cart") || "[]");
    return Array.isArray(cart) ? cart : [];
  } catch (error) {
    console.error("カートを読み込めませんでした。", error);
    return [];
  }
};

export const saveCart = cart => localStorage.setItem("cafe-cart", JSON.stringify(cart));
export const yen = value => `¥${value.toLocaleString("ja-JP")}`;
export const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[character]);
