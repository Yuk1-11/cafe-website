const menuList=document.querySelector("#menu-list");
if(menuList){
  const renderMenu=()=>{menuList.innerHTML=getProducts().map(product=>`<article class="menu-card">${product.stock<1?'<span class="sold-out">SOLD OUT</span>':''}<div class="menu-image">${product.emoji}</div><div class="menu-info"><h3>${product.name}</h3><p>${product.description}</p><div class="price-row"><span class="price">${yen(product.price)}</span><button class="add-button" data-add="${product.id}" ${product.stock<1?"disabled":""}>${product.stock<1?"売り切れ":"カートに追加"}</button></div></div></article>`).join("")};
  renderMenu();
  menuList.addEventListener("click",event=>{const button=event.target.closest("[data-add]");if(!button)return;const cart=getData("cafe-cart",[]);const product=getProducts().find(item=>item.id===button.dataset.add);if(!product)return;const line=cart.find(item=>item.id===product.id);if(line)line.quantity=Math.min(line.quantity+1,product.stock);else cart.push({id:product.id,quantity:1});saveData("cafe-cart",cart);window.dispatchEvent(new Event("cart-updated"));});
}
