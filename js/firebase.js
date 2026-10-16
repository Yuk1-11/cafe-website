import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { collection, getFirestore, limit, onSnapshot, orderBy, query } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

export { isFirebaseConfigured };

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const functions = app ? getFunctions(app, "us-central1") : null;

const call = (name, data) => {
  if (!functions) throw new Error("Firebaseの設定が完了していません。");
  return httpsCallable(functions, name)(data).then(result => result.data);
};

export const subscribeProducts = (onChange, onError) => {
  if (!db) return () => {};
  return onSnapshot(
    query(collection(db, "products"), orderBy("order")),
    snapshot => onChange(snapshot.docs.map(document => ({ id: document.id, ...document.data() }))),
    onError
  );
};

export const subscribeOrders = (onChange, onError) => {
  if (!db) throw new Error("Firebaseの設定が完了していません。");
  return onSnapshot(
    query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(100)),
    snapshot => onChange(snapshot.docs.map(document => ({
      id: document.id,
      ...document.data(),
      createdAt: document.data().createdAt?.toDate().toISOString() ?? new Date().toISOString()
    }))),
    onError
  );
};

export const placeOrder = items => call("createOrder", { items });
export const fetchOrderStatus = (orderNumber, trackingToken) => call("getOrderStatus", { orderNumber, trackingToken });
export const changeOrderStatus = (orderId, status) => call("updateOrderStatus", { orderId, status });
export const changeProductStock = (productId, stock) => call("updateProductStock", { productId, stock });
export const saveProduct = product => call("saveProduct", product);
export const setProductActive = (productId, active) => call("setProductActive", { productId, active });
export const initializeCatalog = () => call("initializeCatalog", {});
export const signInStaff = (email, password) => {
  if (!auth) throw new Error("Firebase Web設定が未入力です。");
  return signInWithEmailAndPassword(auth, email, password);
};
export const signOutStaff = () => auth ? signOut(auth) : Promise.resolve();
export const observeAuth = (callback, onError) => auth ? onAuthStateChanged(auth, callback, onError) : () => {};
