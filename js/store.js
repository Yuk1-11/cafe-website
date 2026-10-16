const DEFAULT_PRODUCTS = [
  {id:"coffee",name:"ドットラテ",description:"まろやかミルクと香ばしいコーヒー。ほっとする定番の一杯。",price:350,emoji:"☕",stock:20},
  {id:"tea",name:"しゅわしゅわソーダ",description:"カラフルな果実を浮かべた、見た目も楽しいソーダ。",price:400,emoji:"🥤",stock:12},
  {id:"cake",name:"水玉クリームケーキ",description:"ふんわりスポンジに、ころんとかわいい水玉クリーム。",price:450,emoji:"🍰",stock:8},
  {id:"cookie",name:"ドットクッキー",description:"さくさく手作り。コーヒーと一緒にどうぞ。",price:200,emoji:"🍪",stock:0}
];
const getData=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))||fallback}catch(error){console.error("データの読み込みに失敗しました",error);return fallback}};
const saveData=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const yen=value=>`¥${value.toLocaleString("ja-JP")}`;
const getProducts=()=>{const products=getData("cafe-products",DEFAULT_PRODUCTS);if(!Array.isArray(products))return DEFAULT_PRODUCTS;const hasLegacyMenu=products.some(product=>product.id==="coffee"&&product.name==="よりみちブレンド");if(!hasLegacyMenu)return products;const updated=DEFAULT_PRODUCTS.map(product=>({...product,stock:products.find(saved=>saved.id===product.id)?.stock??product.stock}));saveData("cafe-products",updated);return updated};
const getOrders=()=>getData("cafe-orders",[]);
