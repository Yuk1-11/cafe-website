import { fetchOrderStatus, isFirebaseConfigured, placeOrder } from "./firebase.js";
import { DEFAULT_PRODUCTS, escapeHtml, getCart, saveCart, yen } from "./store.js";

const cartButton = document.querySelector("#cart-button");

if (cartButton) {
  const cartDialog = document.querySelector("#cart-dialog");
  const statusDialog = document.querySelector("#status-dialog");
  const cartItems = document.querySelector("#cart-items");
  const checkoutButton = document.querySelector("#checkout-button");
  const statusMessage = document.querySelector("#order-status-message");
  const checkStatusButton = document.querySelector("#check-order-status");
  const resumeOrderButton = document.querySelector("#resume-order");
  let products = window.cafeProducts || DEFAULT_PRODUCTS;

  const renderCart = () => {
    products = window.cafeProducts || products;
    const cart = getCart();
    let total = 0;
    let count = 0;
    cartItems.innerHTML = cart.length ? cart.map(line => {
      const product = products.find(item => item.id === line.id);
      if (!product) return "";
      total += product.price * line.quantity;
      count += line.quantity;
      return `<div class="cart-line"><div><p>${escapeHtml(product.emoji)} ${escapeHtml(product.name)}</p><small>${yen(product.price)} × ${line.quantity}</small></div><div class="quantity"><button data-minus="${escapeHtml(product.id)}" aria-label="数量を減らす">−</button><b>${line.quantity}</b><button data-plus="${escapeHtml(product.id)}" aria-label="数量を増やす">＋</button></div><button class="remove-button" data-remove="${escapeHtml(product.id)}">削除</button></div>`;
    }).join("") : "<p>カートは空です。メニューから商品を選んでください。</p>";
    document.querySelector("#cart-count").textContent = `${count}点`;
    document.querySelector("#cart-total").textContent = yen(total);
    document.querySelector("#dialog-total").textContent = yen(total);
    checkoutButton.disabled = !cart.length || !isFirebaseConfigured;
  };

  renderCart();
  window.addEventListener("cart-updated", renderCart);
  cartButton.addEventListener("click", () => {
    renderCart();
    cartDialog.showModal();
  });
  cartItems.addEventListener("click", event => {
    const target = event.target;
    const id = target.dataset.plus || target.dataset.minus || target.dataset.remove;
    const cart = getCart();
    const line = cart.find(item => item.id === id);
    if (!line) return;
    if (target.dataset.plus) line.quantity++;
    if (target.dataset.minus) line.quantity--;
    if (target.dataset.remove || line.quantity < 1) cart.splice(cart.indexOf(line), 1);
    saveCart(cart);
    renderCart();
  });

  checkoutButton.addEventListener("click", async () => {
    const cart = getCart();
    if (!cart.length || !isFirebaseConfigured) return;
    checkoutButton.disabled = true;
    statusMessage.textContent = "";
    try {
      const result = await placeOrder(cart.map(({ id, quantity }) => ({ id, quantity })));
      const order = { orderNumber: result.orderNumber, trackingToken: result.trackingToken, pickupCode: result.pickupCode };
      sessionStorage.setItem("cafe-active-order", JSON.stringify(order));
      saveCart([]);
      cartDialog.close();
      document.querySelector("#status-content").innerHTML = `<p class="eyebrow">ORDER RECEIVED</p><h2>ご注文ありがとうございます</h2><div class="order-number">#${order.orderNumber}</div><div class="pickup-code">合言葉: <strong>${escapeHtml(order.pickupCode)}</strong></div><p>持ち帰りの方はこの合言葉をお店のスタッフにお伝えください。</p>`;
      statusMessage.textContent = "";
      checkStatusButton.hidden = false;
      resumeOrderButton.hidden = false;
      statusDialog.showModal();
      renderCart();
      await showOrderStatus(order);
    } catch (error) {
      statusMessage.textContent = `注文できませんでした: ${error.message}`;
      checkoutButton.disabled = false;
    }
  });

  const showOrderStatus = async order => {
    statusMessage.textContent = "注文状況を確認しています…";
    try {
      const result = await fetchOrderStatus(order.orderNumber, order.trackingToken);
      statusMessage.textContent = `現在の状況: ${result.status}`;
    } catch (error) {
      statusMessage.textContent = `状況を確認できませんでした: ${error.message}`;
    }
  };

  checkStatusButton.addEventListener("click", () => {
    try {
      const order = JSON.parse(sessionStorage.getItem("cafe-active-order") || "null");
      if (order) showOrderStatus(order);
      else statusMessage.textContent = "この端末で確認できる注文はありません。";
    } catch (error) {
      console.error("保存された注文を読み込めませんでした。", error);
      statusMessage.textContent = "保存された注文を読み込めませんでした。";
    }
  });

  try {
    resumeOrderButton.hidden = !sessionStorage.getItem("cafe-active-order");
  } catch (error) {
    console.error("注文状況の保存状態を読み込めませんでした。", error);
  }
  resumeOrderButton.addEventListener("click", () => {
    try {
      const order = JSON.parse(sessionStorage.getItem("cafe-active-order") || "null");
      if (!order) return;
      document.querySelector("#status-content").innerHTML = `<p class="eyebrow">YOUR ORDER</p><h2>ご注文状況</h2><div class="order-number">#${order.orderNumber}</div><div class="pickup-code">合言葉: <strong>${escapeHtml(order.pickupCode)}</strong></div>`;
      checkStatusButton.hidden = false;
      statusDialog.showModal();
      showOrderStatus(order);
    } catch (error) {
      console.error("注文状況を読み込めませんでした。", error);
      statusMessage.textContent = "注文状況を読み込めませんでした。";
    }
  });

  document.addEventListener("click", event => {
    const close = event.target.closest("[data-close]");
    if (close) document.querySelector(`#${close.dataset.close}`).close();
  });
}
