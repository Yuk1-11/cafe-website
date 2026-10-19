import { isFirebaseConfigured, subscribeProducts } from "./firebase.js";
import { DEFAULT_PRODUCTS, escapeHtml, getCart, getTableNumber, saveCart, yen } from "./store.js";

const menuList = document.querySelector("#menu-list");
const message = document.querySelector("#backend-message");
const tableInfo = document.querySelector("#tableInfo");

if (tableInfo) {
  const table = getTableNumber(window.location.search);
  const numberHeading = tableInfo.querySelector("#tableNumber");
  const tableMessage = tableInfo.querySelector("#tableMessage");

  if (table.number !== null) {
    tableInfo.classList.remove("table-info--missing", "table-info--invalid");
    tableInfo.dataset.tableNumber = String(table.number);
    numberHeading.textContent = `${table.number}番`;
    tableMessage.textContent = "この卓からご注文いただけます。";
  } else {
    tableInfo.dataset.tableNumber = "";
    tableInfo.classList.toggle("table-info--missing", table.error === "missing");
    tableInfo.classList.toggle("table-info--invalid", table.error !== "missing");
    numberHeading.textContent = table.error === "missing" ? "卓番号が未指定です" : "卓番号が正しくありません";
    tableMessage.textContent = table.error === "missing"
      ? "卓番号付きのQRコードからアクセスしてください。"
      : "卓番号は1〜10番の範囲で指定してください。";
  }
}

if (menuList) {
  let products = DEFAULT_PRODUCTS;
  const getAvailableQuantity = (product, cart) => {
    const line = cart.find(item => item.id === product.id);
    const currentQuantity = line?.quantity || 0;
    return Math.min(product.stock - currentQuantity, 20 - currentQuantity);
  };

  const renderMenu = () => {
    window.cafeProducts = products;
    const cart = getCart();
    menuList.innerHTML = products.filter(product => product.active !== false).map((product, index) =>
      `<article class="menu-card menu-card-${index % 4}">${product.stock < 1 ? '<span class="sold-out">SOLD OUT</span>' : ""}<div class="menu-image"><span class="menu-image-tag">DOT CAFE / 0${index + 1}</span><span class="menu-emoji" aria-hidden="true">${escapeHtml(product.emoji)}</span><span class="menu-image-dot" aria-hidden="true">●</span></div><div class="menu-info"><p class="menu-category">${index === 0 ? "OUR SIGNATURE" : index === 1 ? "SEASONAL DRINK" : index === 2 ? "SWEET MOMENT" : "HOMEMADE"}</p><h3>${escapeHtml(product.name)}</h3><p class="menu-description">${escapeHtml(product.description)}</p><div class="price-row"><span class="price">${yen(product.price)}<small> (税込)</small></span><div class="menu-purchase-controls"><div class="quantity menu-quantity"><button type="button" data-quantity-step="minus" data-product-id="${escapeHtml(product.id)}" aria-label="${escapeHtml(product.name)}の数量を減らす" disabled>−</button><b data-selected-quantity>1</b><button type="button" data-quantity-step="plus" data-product-id="${escapeHtml(product.id)}" aria-label="${escapeHtml(product.name)}の数量を増やす" ${getAvailableQuantity(product, cart) <= 1 ? "disabled" : ""}>＋</button></div><button class="add-button" data-add="${escapeHtml(product.id)}" ${getAvailableQuantity(product, cart) < 1 ? "disabled" : ""}>${product.stock < 1 ? "売り切れ" : "＋ カートへ"}</button></div></div></div></article>`
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
    const stepButton = event.target.closest("[data-quantity-step]");
    if (stepButton) {
      const product = products.find(item => item.id === stepButton.dataset.productId);
      const card = stepButton.closest(".menu-card");
      if (!product || !card) return;
      const selectedQuantity = card.querySelector("[data-selected-quantity]");
      const available = getAvailableQuantity(product, getCart());
      const current = Number(selectedQuantity.textContent);
      const next = stepButton.dataset.quantityStep === "plus"
        ? Math.min(current + 1, Math.max(available, 1))
        : Math.max(current - 1, 1);
      selectedQuantity.textContent = String(next);
      card.querySelector('[data-quantity-step="minus"]').disabled = next <= 1;
      card.querySelector('[data-quantity-step="plus"]').disabled = next >= available;
      card.querySelector("[data-add]").disabled = available < 1;
      return;
    }

    const button = event.target.closest("[data-add]");
    if (!button) return;
    const product = products.find(item => item.id === button.dataset.add);
    if (!product || product.stock < 1) return;
    const cart = getCart();
    const line = cart.find(item => item.id === product.id);
    const available = getAvailableQuantity(product, cart);
    const card = button.closest(".menu-card");
    const quantity = Number(card.querySelector("[data-selected-quantity]").textContent);
    if (available < 1 || quantity > available) {
      window.alert(`追加できる数量は${Math.max(available, 0)}個までです。`);
      return;
    }

    if (line) line.quantity += quantity;
    else cart.push({ id: product.id, quantity });
    saveCart(cart);
    card.querySelector("[data-selected-quantity]").textContent = "1";
    card.querySelector('[data-quantity-step="minus"]').disabled = true;
    const remaining = getAvailableQuantity(product, getCart());
    card.querySelector('[data-quantity-step="plus"]').disabled = remaining <= 1;
    button.disabled = remaining < 1;
    window.dispatchEvent(new Event("cart-updated"));
  });
}
