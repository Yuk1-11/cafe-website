import {
  changeOrderStatus,
  changeProductStock,
  initializeCatalog,
  isFirebaseConfigured,
  observeAuth,
  saveProduct,
  setProductActive,
  signInStaff,
  signOutStaff,
  subscribeOrders,
  subscribeProducts
} from "./firebase.js";
import { escapeHtml, yen } from "./store.js";

const loginPanel = document.querySelector("#login-panel");

if (loginPanel) {
  const dashboard = document.querySelector("#dashboard");
  const loginError = document.querySelector("#login-error");
  const adminMessage = document.querySelector("#admin-message");
  let orders = [];
  let products = [];
  let stopOrders = null;
  let stopProducts = null;
  let editingProductId = null;

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
      `<article class="order-card"><div class="order-meta"><h3>注文 #${escapeHtml(order.orderNumber)}</h3><time>${new Date(order.createdAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</time></div><p class="order-items">${order.items.map(item => `${escapeHtml(item.name)} × ${item.quantity}`).join(" / ")}</p><div class="pickup-box">合言葉: <strong>${escapeHtml(order.pickupCode || "未設定")}</strong></div><div class="order-meta"><strong>${yen(order.total)}</strong><label class="sr-only" for="status-${escapeHtml(order.id)}">注文 #${escapeHtml(order.orderNumber)} の状況</label><select class="status-select" id="status-${escapeHtml(order.id)}" data-status="${escapeHtml(order.id)}">${["受付済み", "調理中", "受け渡し待ち", "受け渡し済み"].map(status => `<option ${status === order.status ? "selected" : ""}>${status}</option>`).join("")}</select></div></article>`
    ).join("") : "<p>まだ注文はありません。</p>";
  };
  const renderProducts = () => {
    document.querySelector("#product-list").innerHTML = products.length ? products.map(product =>
      `<article class="product-row ${product.active === false ? "product-inactive" : ""}"><div class="product-summary"><strong>${escapeHtml(product.emoji)} ${escapeHtml(product.name)}</strong><small>${escapeHtml(product.description)}</small><small>${yen(product.price)}${product.active === false ? " ・販売停止中" : ""}</small></div><label>在庫 <input class="stock-input" type="number" min="0" max="10000" step="1" value="${product.stock}" data-stock="${escapeHtml(product.id)}"></label><div class="product-actions"><button class="secondary-button" data-edit="${escapeHtml(product.id)}" type="button">編集</button><button class="stock-toggle" data-toggle="${escapeHtml(product.id)}" type="button">${product.active === false ? "販売を再開" : "販売停止"}</button></div></article>`
    ).join("") : "<p>メニューがありません。上のフォームから追加してください。</p>";
  };
  const renderHistory = () => {
    const history = orders.filter(order => order.status === "受け渡し済み");
    document.querySelector("#history-panel").innerHTML = history.length ? history.map(order =>
      `<article class="order-card"><div class="order-meta"><h3>注文 #${escapeHtml(order.orderNumber)}</h3><strong>${yen(order.total)}</strong></div><p class="order-items">${order.items.map(item => `${escapeHtml(item.name)} × ${item.quantity}`).join(" / ")}</p></article>`
    ).join("") : "<p>受け渡し済みの注文はありません。</p>";
  };
  const renderAll = () => {
    renderStats();
    renderOrders();
    renderProducts();
    renderHistory();
  };
  const resetProductForm = () => {
    editingProductId = null;
    document.querySelector("#product-form").reset();
    document.querySelector("#product-stock").value = "0";
    document.querySelector("#product-editor-title").textContent = "メニューを追加";
    document.querySelector("#save-product-button").textContent = "メニューを追加";
    document.querySelector("#cancel-product-edit").classList.add("hidden");
  };

  document.querySelector("#product-form").addEventListener("submit", async event => {
    event.preventDefault();
    const saveButton = document.querySelector("#save-product-button");
    saveButton.disabled = true;
    adminMessage.textContent = "";
    const product = {
      name: document.querySelector("#product-name").value.trim(),
      description: document.querySelector("#product-description").value.trim(),
      price: Number(document.querySelector("#product-price").value),
      emoji: document.querySelector("#product-emoji").value.trim(),
      stock: Number(document.querySelector("#product-stock").value)
    };
    const wasEditing = Boolean(editingProductId);
    if (editingProductId) product.productId = editingProductId;
    try {
      await saveProduct(product);
      resetProductForm();
      adminMessage.textContent = wasEditing ? "メニューを更新しました。" : "メニューを追加しました。";
    } catch (error) {
      showError(error);
    } finally {
      saveButton.disabled = false;
    }
  });
  document.querySelector("#cancel-product-edit").addEventListener("click", resetProductForm);

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
        await setProductActive(productId, product.active === false);
        adminMessage.textContent = "";
      } catch (error) {
        showError(error);
      }
    }
    const editProductId = event.target.dataset.edit;
    if (editProductId) {
      const product = products.find(item => item.id === editProductId);
      if (!product) return;
      editingProductId = product.id;
      document.querySelector("#product-name").value = product.name;
      document.querySelector("#product-description").value = product.description;
      document.querySelector("#product-price").value = product.price;
      document.querySelector("#product-emoji").value = product.emoji;
      document.querySelector("#product-stock").value = product.stock;
      document.querySelector("#product-editor-title").textContent = "メニューを編集";
      document.querySelector("#save-product-button").textContent = "変更を保存";
      document.querySelector("#cancel-product-edit").classList.remove("hidden");
      document.querySelector("#products-panel").scrollIntoView({ behavior: "smooth", block: "start" });
      document.querySelector("#product-name").focus();
    }
    const tab = event.target.closest(".tab");
    if (!tab) return;
    document.querySelectorAll(".tab").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(item => item.classList.add("hidden"));
    tab.classList.add("active");
    document.querySelector(`#${tab.dataset.tab}-panel`).classList.remove("hidden");
    document.querySelector("#tab-guide").textContent = {
      orders: "届いた注文を確認し、準備が進んだら状況を更新します。変更はお客さまの注文状況にも反映されます。",
      products: "メニューの追加・編集、在庫数の変更、販売停止を行います。変更はお客さま画面に反映されます。",
      history: "「受け渡し済み」にした注文を確認できます。"
    }[tab.dataset.tab];
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
