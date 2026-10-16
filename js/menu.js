import { isFirebaseConfigured, subscribeProducts } from "./firebase.js";
import { DEFAULT_PRODUCTS, escapeHtml, getCart, saveCart, yen } from "./store.js";

const menuList = document.querySelector("#menu-list");
const message = document.querySelector("#backend-message");
const tableInfo = document.querySelector("#tableInfo");

if (tableInfo) {
  const params = new URLSearchParams(window.location.search);
  const tableNumber = (params.get("table") || params.get("tableNumber") || "").trim();
  const numberHeading = tableInfo.querySelector("#tableNumber");
  const tableMessage = tableInfo.querySelector("#tableMessage");

  if (tableNumber) {
    tableInfo.classList.remove("table-info--missing");
    numberHeading.textContent = `${tableNumber}番`;
    tableMessage.textContent = "この卓からご注文いただけます。";
  } else {
    tableInfo.classList.add("table-info--missing");
    numberHeading.textContent = "卓番号が未指定です";
    tableMessage.textContent = "卓番号付きのQRコードからアクセスしてください。";
  }
}

if (menuList) {
  let products = DEFAULT_PRODUCTS;

  const renderMenu = () => {
    window.cafeProducts = products;
    menuList.innerHTML = products.filter(product => product.active !== false).map((product, index) =>
      `<article class="menu-card menu-card-${index % 4}">${product.stock < 1 ? '<span class="sold-out">SOLD OUT</span>' : ""}<div class="menu-image"><span class="menu-image-tag">DOT CAFE / 0${index + 1}</span><span class="menu-emoji" aria-hidden="true">${escapeHtml(product.emoji)}</span><span class="menu-image-dot" aria-hidden="true">●</span></div><div class="menu-info"><p class="menu-category">${index === 0 ? "OUR SIGNATURE" : index === 1 ? "SEASONAL DRINK" : index === 2 ? "SWEET MOMENT" : "HOMEMADE"}</p><h3>${escapeHtml(product.name)}</h3><p class="menu-description">${escapeHtml(product.description)}</p><div class="price-row"><span class="price">${yen(product.price)}<small> (税込)</small></span><button class="add-button" data-add="${escapeHtml(product.id)}" ${product.stock < 1 ? "disabled" : ""}>${product.stock < 1 ? "売り切れ" : "＋ カートへ"}</button></div></div></article>`
    ).join("");
  };

  renderMenu();
  if (isFirebaseConfigured) {
    message.hidden = true;
    subscribeProducts(nextProducts => {
      products = nextProducts.filter(product => product.active !== false);
      message.textContent = products.length ? "" : "メニューを準備しています。スタッフの初回ログイン後に商品が表示されます。";
      message.hidden = products.length > 0;
      renderMenu();
    }, error => {
      message.textContent = `メニューを読み込めませんでした: ${error.message}`;
      message.hidden = false;
    });
  } else {
    message.textContent = "Firebase未設定のプレビューです。メニュー表示は確認できますが、注文受付にはFirebaseの設定が必要です。";
    message.hidden = false;
  }

  menuList.addEventListener("click", event => {
    const button = event.target.closest("[data-add]");
    if (!button) return;
    const product = products.find(item => item.id === button.dataset.add);
    if (!product || product.stock < 1) return;
    const cart = getCart();
    const line = cart.find(item => item.id === product.id);
    if (line) line.quantity++;
    else cart.push({ id: product.id, quantity: 1 });
    saveCart(cart);
    window.dispatchEvent(new Event("cart-updated"));
  });
}
