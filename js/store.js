const DEFAULT_PRODUCTS = [
  {id:"coffee",name:"よりみちブレンド",description:"香ばしくて飲みやすい、店主おすすめの一杯。",price:350,emoji:"☕",stock:20},
  {id:"tea",name:"季節のフルーツティー",description:"果実の香りが広がる、すっきりアイスティー。",price:400,emoji:"🍹",stock:12},
  {id:"cake",name:"しっとりチーズケーキ",description:"コーヒーと相性ぴったりの濃厚チーズケーキ。",price:450,emoji:"🍰",stock:8},
  {id:"cookie",name:"手作りクッキー",description:"文化祭限定。バター香るサクサククッキー。",price:200,emoji:"🍪",stock:0}
];
const getData=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))||fallback}catch(error){console.error("データの読み込みに失敗しました",error);return fallback}};
const saveData=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const yen=value=>`¥${value.toLocaleString("ja-JP")}`;
const getProducts=()=>getData("cafe-products",DEFAULT_PRODUCTS);
const getOrders=()=>getData("cafe-orders",[]);
