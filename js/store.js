export const DEFAULT_PRODUCTS = [
  { id: "melon-bread", name: "サクサクメロンパン", description: "香ばしい外皮と甘いメロン風味がたまらない、人気No.1の一品。", price: 250, emoji: "🥐", stock: 20, order: 1, active: true },
  { id: "fondant-choco", name: "フォンダンショコラ", description: "中からトロっと溶ける、濃厚なチョコレートの贅沢スイーツ。", price: 250, emoji: "🍫", stock: 20, order: 2, active: true },
  { id: "mini-panini", name: "ミニパニーニ", description: "サクッと焼き上げた食パンで、しょっぱい気分にぴったり。", price: 250, emoji: "🥪", stock: 20, order: 3, active: true },
  { id: "salt-bread", name: "塩パン", description: "ホッと一息。食事の合間にちょうどよい、シンプルな塩パン。", price: 250, emoji: "🥖", stock: 20, order: 4, active: true },
  { id: "ginger-ale", name: "ジンジャエール", description: "すっきりした風味で、パンと相性抜群のドリンク。", price: 0, emoji: "🧃", stock: 20, order: 5, active: true },
  { id: "orange-juice", name: "オレンジジュース", description: "甘酸っぱくてごくごく飲みやすい、やさしい柑橘系ドリンク。", price: 0, emoji: "🍊", stock: 20, order: 6, active: true },
  { id: "sprite", name: "スプライト", description: "さわやかな炭酸で、食事の後に気分転換におすすめ。", price: 0, emoji: "🥤", stock: 20, order: 7, active: true }
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
export const yen = value => value > 0 ? `¥${value.toLocaleString("ja-JP")}` : "未定";
export const escapeHtml = value => String(value).replace(/[&<>\"']/g, character => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[character]);
