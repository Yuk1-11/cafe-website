import {
  changeOrderStatus,
  changeProductStock,
  initializeCatalog,
  isFirebaseConfigured,
  observeAuth,
  signInStaff,
  signOutStaff,
  subscribeOrders,
  subscribeProducts
} from "./firebase.js";
import { yen } from "./store.js";

const loginPanel = document.querySelector("#login-panel");

if (loginPanel) {
  const dashboard = document.querySelector("#dashboard");
  const loginError = document.querySelector("#login-error");
  const adminMessage = document.querySelector("#admin-message");
  let orders = [];
  let products = [];
  let stopOrders = null;
  let stopProducts = null;

  const showError = error => {
    adminMessage.textContent = `データを更新できませんでした: ${error.message}`;
  };
  const renderStats = () => {
    const pending = orders.filter(order => order.status !== "受け渡し済み").length;
    const sales = orders.reduce((sum, order) => sum + order.total, 0);
    document.querySelector("#stats").innerHTML = `<div class="stat"><span>表示中の対応中注文</span><strong>${pending}件</strong></div><div class="stat"><span>表示中の注文（最大100件）</span><strong>${orders.length}件</strong></div><div class="stat"><span>表示中の売上</span><strong>${yen(sales)}</strong></div>`;
  };
  const renderOrders = () => {
    document.querySelector("#orders-panel").innerHTML = orders.length ? orders.map(order =>
      `<article class="order-card"><div class="order-meta"><h3>注文 #${order.orderNumber}</h3><time>${new Date(order.createdAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</time></div><p class="order-items">${order.items.map(item => `${item.name} × ${item.quantity}`).join(" / ")}</p><div class="order-meta"><strong>${yen(order.total)}</strong><select class="status-select" data-status="${order.id}">${["受付済み", "調理中", "受け渡し待ち", "受け渡し済み"].map(status => `<option ${status === order.status ? "selected" : ""}>${status}</option>`).join("")}</select></div></article>`
    ).join("") : "<p>まだ注文はありません。</p>";
  };
  const renderProducts = () => {
    document.querySelector("#products-panel").innerHTML = products.map(product =>
      `<div class="product-row"><div><strong>${product.emoji} ${product.name}</strong><small>${yen(product.price)}</small></div><label>在庫 <input class="stock-input" type="number" min="0" step="1" value="${product.stock}" data-stock="${product.id}"></label><button class="stock-toggle" data-toggle="${product.id}">${product.stock ? "売り切れにする" : "販売を再開"}</button></div>`
    ).join("");
  };
  const renderHistory = () => {
    const history = orders.filter(order => order.status === "受け渡し済み");
    document.querySelector("#history-panel").innerHTML = history.length ? history.map(order =>
      `<article class="order-card"><div class="order-meta"><h3>注文 #${order.orderNumber}</h3><strong>${yen(order.total)}</strong></div><p class="order-items">${order.items.map(item => `${item.name} × ${item.quantity}`).join(" / ")}</p></article>`
    ).join("") : "<p>受け渡し済みの注文はありません。</p>";
  };
  const renderAll = () => {
    renderStats();
    renderOrders();
    renderProducts();
    renderHistory();
  };

  document.querySelector("#login-form").addEventListener("submit", async event => {
    event.preventDefault();
    loginError.textContent = "";
    try {
      await signInStaff(document.querySelector("#staff-email").value.trim(), document.querySelector("#staff-password").value);
    } catch (error) {
      loginError.textContent = `ログインできませんでした: ${error.message}`;
    }
  });
  document.querySelector("#logout-button").addEventListener("click", () => signOutStaff().catch(showError));

  dashboard.addEventListener("change", async event => {
    const { status, stock } = event.target.dataset;
    try {
      if (status) await changeOrderStatus(status, event.target.value);
      if (stock) {
        const value = Number(event.target.value);
        if (!Number.isInteger(value) || value < 0) throw new Error("在庫数には0以上の整数を入力してください。");
        await changeProductStock(stock, value);
      }
      adminMessage.textContent = "";
    } catch (error) {
      showError(error);
    }
  });

  dashboard.addEventListener("click", async event => {
    const productId = event.target.dataset.toggle;
    if (productId) {
      const product = products.find(item => item.id === productId);
      try {
        await changeProductStock(productId, product.stock ? 0 : 10);
        adminMessage.textContent = "";
      } catch (error) {
        showError(error);
      }
    }
    const tab = event.target.closest(".tab");
    if (!tab) return;
    document.querySelectorAll(".tab").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(item => item.classList.add("hidden"));
    tab.classList.add("active");
    document.querySelector(`#${tab.dataset.tab}-panel`).classList.remove("hidden");
  });

  if (!isFirebaseConfigured) {
    loginError.textContent = "Firebase Web設定をjs/firebase-config.jsに入力してください。";
    document.querySelector("#login-form").querySelectorAll("input, button").forEach(element => { element.disabled = true; });
  } else {
    observeAuth(async user => {
      if (stopOrders) stopOrders();
      if (stopProducts) stopProducts();
      stopOrders = null;
      stopProducts = null;
      if (!user) {
        dashboard.classList.add("hidden");
        loginPanel.classList.remove("hidden");
        return;
      }
      try {
        const token = await user.getIdTokenResult(true);
        if (token.claims.staff !== true) {
          await signOutStaff();
          loginError.textContent = "このアカウントにはスタッフ権限がありません。管理者に設定を依頼してください。";
          return;
        }
        loginPanel.classList.add("hidden");
        dashboard.classList.remove("hidden");
        adminMessage.textContent = "データを読み込んでいます…";
        await initializeCatalog();
        stopOrders = subscribeOrders(nextOrders => {
          orders = nextOrders;
          renderStats();
          renderOrders();
          renderHistory();
          adminMessage.textContent = "";
        }, showError);
        stopProducts = subscribeProducts(nextProducts => {
          products = nextProducts;
          renderProducts();
          adminMessage.textContent = "";
        }, showError);
      } catch (error) {
        showError(error);
      }
    }, error => {
      loginError.textContent = `認証状態を確認できませんでした: ${error.message}`;
    });
  }
}
