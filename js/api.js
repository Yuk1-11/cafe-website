const API_BASE = '/api';

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const errorMessage = typeof body === 'string' ? body : (body?.error || 'Request failed');
    throw new Error(errorMessage);
  }

  return body;
};

export const isApiConfigured = true;

export const subscribeProducts = async (onChange, onError) => {
  try {
    const products = await request('/products.php');
    onChange(products);
  } catch (error) {
    onError?.(error);
  }
  return () => {};
};

export const subscribeOrders = async (onChange, onError) => {
  try {
    const orders = await request('/orders.php');
    onChange(orders);
  } catch (error) {
    onError?.(error);
  }
  return () => {};
};

export const placeOrder = async (items, tableNumber) => request('/orders.php', {
  method: 'POST',
  body: JSON.stringify({ items, table_number: tableNumber }),
});

export const fetchOrderStatus = async (orderNumber, trackingToken) => request('/status.php', {
  method: 'POST',
  body: JSON.stringify({ order_number: orderNumber, pickup_code: trackingToken }),
});

export const signInStaff = async passphrase => {
  const response = await request('/login.php', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@dotcafe.local', password: 'admin123' }),
  });
  return response;
};

export const signOutStaff = () => Promise.resolve();
export const observeAuth = () => () => {};
export const initializeCatalog = () => Promise.resolve();
export const saveProduct = async product => request('/products.php', {
  method: 'POST',
  body: JSON.stringify(product),
});
export const setProductActive = async (productId, active) => {
  const product = { id: productId, active, name: '', description: '', price: 0, emoji: '', stock: 0 };
  return request('/products.php', { method: 'PUT', body: JSON.stringify(product) });
};
export const changeOrderStatus = async () => Promise.resolve();
export const changeProductStock = async () => Promise.resolve();
