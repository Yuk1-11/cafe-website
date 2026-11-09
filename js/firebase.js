const API_BASE = "/api";

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof body === "string" ? body : (body?.error || "Request failed");
    throw new Error(message);
  }

  return body;
};

export const isFirebaseConfigured = true;

export const subscribeProducts = async (onChange, onError) => {
  try {
    const products = await request("/products.php");
    onChange(products);
  } catch (error) {
    onError?.(error);
  }
  return () => {};
};

export const subscribeOrders = async (onChange, onError) => {
  try {
    const orders = await request("/orders.php");
    onChange(orders);
  } catch (error) {
    onError?.(error);
  }
  return () => {};
};

export const placeOrder = async (items, tableNumber) => request("/orders.php", {
  method: "POST",
  body: JSON.stringify({ items, table_number: tableNumber }),
});

export const fetchOrderStatus = async (orderNumber, trackingToken) => request("/status.php", {
  method: "POST",
  body: JSON.stringify({ order_number: orderNumber, pickup_code: trackingToken }),
});

export const initializeCatalog = () => Promise.resolve();

export const saveProduct = async product => {
  const payload = { ...product };
  if (typeof product.id === "undefined") {
    return request("/products.php", { method: "POST", body: JSON.stringify(payload) });
  }
  return request("/products.php", { method: "PUT", body: JSON.stringify(payload) });
};

export const setProductActive = async (productId, active) => {
  const product = {
    id: productId,
    name: "",
    description: "",
    price: 0,
    emoji: "",
    stock: 0,
    active,
  };
  return request("/products.php", { method: "PUT", body: JSON.stringify(product) });
};

export const changeOrderStatus = async () => Promise.resolve();
export const changeProductStock = async () => Promise.resolve();

export const signInStaff = async () => {
  const email = localStorage.getItem("cafe-staff-email") || "admin@dotcafe.local";
  const password = localStorage.getItem("cafe-staff-password") || "admin123";
  const response = await request("/login.php", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem("cafe-staff-login", "1");
  return response;
};

export const signOutStaff = async () => {
  localStorage.removeItem("cafe-staff-login");
  return Promise.resolve();
};

export const observeAuth = callback => {
  const notify = () => {
    const isLoggedIn = localStorage.getItem("cafe-staff-login") === "1";
    if (!isLoggedIn) {
      callback(null);
      return;
    }

    const user = {
      claims: {
        staff: true,
        staffExpiresAt: Date.now() + 60 * 60 * 1000,
      },
      async getIdTokenResult() {
        return { claims: { staff: true, staffExpiresAt: Date.now() + 60 * 60 * 1000 } };
      },
    };

    callback(user);
  };

  notify();
  window.addEventListener("storage", notify);
  return () => window.removeEventListener("storage", notify);
};
