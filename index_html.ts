export const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CyberMarket — Tactical & Neural Gear</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --accent: #00ffcc;
      --accent-hover: #00cca3;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --border: #1f2937;
      --danger: #ef4444;
      --success: #10b981;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); padding-bottom: 60px; }
    header { background: #0b1120; border-bottom: 1px solid var(--border); padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; }
    header h1 { font-size: 1.4rem; color: var(--accent); letter-spacing: 1px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
    .badge { background: rgba(0,255,204,0.1); color: var(--accent); border: 1px solid rgba(0,255,204,0.3); font-size: 0.75rem; padding: 2px 8px; border-radius: 9999px; }
    .header-actions { display: flex; align-items: center; gap: 1rem; }
    .cart-btn { background: #1f2937; border: 1px solid var(--border); color: #fff; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 6px; }
    .cart-btn:hover { background: #374151; }
    .cart-count { background: var(--accent); color: #000; font-weight: bold; border-radius: 9999px; padding: 2px 8px; font-size: 0.8rem; }
    
    .container { max-width: 1200px; margin: 2rem auto; padding: 0 1rem; }
    .hero { background: linear-gradient(135deg, rgba(0,255,204,0.05) 0%, rgba(17,24,39,0) 100%); border: 1px solid var(--border); border-radius: 12px; padding: 2rem; margin-bottom: 2rem; text-align: center; }
    .hero h2 { font-size: 2rem; margin-bottom: 0.5rem; }
    .hero p { color: var(--text-muted); max-width: 600px; margin: 0 auto; }

    .search-bar { display: flex; gap: 1rem; margin-bottom: 2rem; }
    .search-bar input { flex: 1; background: var(--card-bg); border: 1px solid var(--border); padding: 0.75rem 1rem; border-radius: 8px; color: #fff; font-size: 1rem; }
    .search-bar input:focus { outline: none; border-color: var(--accent); }

    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.2s, border-color 0.2s; }
    .card:hover { transform: translateY(-4px); border-color: rgba(0,255,204,0.4); }
    .card-title { font-size: 1.2rem; font-weight: 700; margin-bottom: 0.5rem; color: #fff; }
    .card-desc { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1rem; flex: 1; }
    .card-price-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1rem; }
    .card-price { font-size: 1.3rem; font-weight: 800; color: var(--accent); }
    .card-stock { font-size: 0.8rem; color: var(--text-muted); }
    .btn-add { background: var(--accent); color: #000; border: none; padding: 0.6rem; border-radius: 8px; font-weight: 700; cursor: pointer; width: 100%; transition: background 0.2s; }
    .btn-add:hover { background: var(--accent-hover); }
    .btn-add:disabled { background: #4b5563; color: #9ca3af; cursor: not-allowed; }

    /* Modal / Drawer */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: none; justify-content: flex-end; z-index: 200; }
    .modal-overlay.active { display: flex; }
    .drawer { background: var(--card-bg); width: 100%; max-width: 440px; height: 100%; padding: 2rem; display: flex; flex-direction: column; box-shadow: -4px 0 20px rgba(0,0,0,0.5); }
    .drawer-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem; }
    .close-btn { background: none; border: none; color: #fff; font-size: 1.5rem; cursor: pointer; }
    .cart-items { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem; }
    .cart-item { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border); }
    .cart-item-info h4 { font-size: 0.95rem; margin-bottom: 4px; }
    .cart-item-info p { color: var(--accent); font-weight: 600; font-size: 0.85rem; }
    .cart-item-qty { display: flex; align-items: center; gap: 8px; }
    .cart-item-qty button { background: #1f2937; border: 1px solid var(--border); color: #fff; width: 26px; height: 26px; border-radius: 4px; cursor: pointer; }
    .cart-summary { border-top: 1px solid var(--border); padding-top: 1.5rem; margin-top: 1rem; }
    .cart-total { display: flex; justify-content: space-between; font-size: 1.2rem; font-weight: 800; margin-bottom: 1rem; }
    .btn-checkout { background: var(--accent); color: #000; border: none; padding: 0.8rem; border-radius: 8px; font-weight: 800; width: 100%; cursor: pointer; }
    .btn-checkout:hover { background: var(--accent-hover); }

    /* Notification toast */
    .toast { position: fixed; bottom: 20px; right: 20px; background: #1f2937; border: 1px solid var(--accent); color: #fff; padding: 1rem 1.5rem; border-radius: 8px; display: none; z-index: 300; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
    .toast.show { display: block; animation: slideIn 0.3s; }
    @keyframes slideIn { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

    /* Checkout Modal */
    .checkout-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: none; justify-content: center; align-items: center; z-index: 250; }
    .checkout-modal.active { display: flex; }
    .checkout-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; width: 90%; max-width: 500px; padding: 2rem; position: relative; }
    .form-group { margin-bottom: 1.2rem; }
    .form-group label { display: block; margin-bottom: 0.4rem; color: var(--text-muted); font-size: 0.85rem; font-weight: 600; }
    .form-group input, .form-group select { width: 100%; background: #0d131f; border: 1px solid var(--border); color: #fff; padding: 0.6rem 0.8rem; border-radius: 6px; }
  </style>
</head>
<body>
  <header>
    <h1>⚡ CyberMarket <span class="badge">PROD BUILD</span></h1>
    <div class="header-actions">
      <button class="cart-btn" id="open-cart-btn" onclick="toggleCart(true)">
        🛒 Cart <span class="cart-count" id="cart-count">0</span>
      </button>
    </div>
  </header>

  <div class="container">
    <div class="hero">
      <h2>Underground Hardware & Tactical Enclaves</h2>
      <p>Hardened hardware, quantum audio, and neural interfaces verified on localhost testbed.</p>
    </div>

    <div class="search-bar">
      <input type="text" id="search-input" placeholder="Search catalog..." oninput="handleSearch(this.value)">
    </div>

    <div id="product-grid" class="grid">
      <p style="color: var(--text-muted);">Loading products...</p>
    </div>
  </div>

  <!-- Cart Drawer -->
  <div class="modal-overlay" id="cart-drawer">
    <div class="drawer">
      <div class="drawer-header">
        <h2>Your Tactical Cart</h2>
        <button class="close-btn" onclick="toggleCart(false)">&times;</button>
      </div>
      <div class="cart-items" id="cart-items-container">
        <p style="color: var(--text-muted); text-align: center; margin-top: 2rem;">Cart is empty.</p>
      </div>
      <div class="cart-summary" id="cart-summary" style="display: none;">
        <div class="cart-total">
          <span>Total:</span>
          <span id="cart-total-amount" style="color: var(--accent);">$0</span>
        </div>
        <button class="btn-checkout" id="checkout-btn" onclick="openCheckoutModal()">Proceed to Checkout</button>
      </div>
    </div>
  </div>

  <!-- Checkout Modal -->
  <div class="checkout-modal" id="checkout-modal">
    <div class="checkout-card">
      <h3 style="margin-bottom: 1rem; color: var(--accent);">Confirm Tactical Order</h3>
      <div class="form-group">
        <label>Shipping Dropzone / Address</label>
        <input type="text" id="checkout-address" value="Sector 7 Safehouse, Unit 4B" placeholder="Full Address">
      </div>
      <div class="form-group">
        <label>Payment Channel</label>
        <select id="checkout-payment-method">
          <option value="cryptographic_vault">Cryptographic Vault Transfer (Instant)</option>
          <option value="credit_card">Secure Corporate Wire</option>
        </select>
      </div>
      <div id="checkout-order-summary" style="margin-bottom: 1.5rem; background: #090d16; padding: 1rem; border-radius: 8px; border: 1px solid var(--border);">
        <p style="color: var(--text-muted); font-size: 0.9rem;">Order Total: <strong id="checkout-total" style="color: var(--accent);">$0</strong></p>
      </div>
      <div style="display: flex; gap: 1rem;">
        <button style="flex: 1; background: #1f2937; color: #fff; border: 1px solid var(--border); padding: 0.6rem; border-radius: 6px; cursor: pointer;" onclick="closeCheckoutModal()">Cancel</button>
        <button style="flex: 2; background: var(--accent); color: #000; border: none; padding: 0.6rem; border-radius: 6px; font-weight: 800; cursor: pointer;" id="pay-confirm-btn" onclick="executeCheckoutAndPay()">Confirm & Pay</button>
      </div>
    </div>
  </div>

  <!-- Toast -->
  <div class="toast" id="toast"></div>

  <script>
    const USER_ID = 'local-user-' + Math.random().toString(36).substring(2, 7);
    let allProducts = [];
    let currentCart = null;

    async function api(path, options = {}) {
      options.headers = {
        'Content-Type': 'application/json',
        'x-user-id': USER_ID,
        ...(options.headers || {})
      };
      const res = await fetch(path, options);
      return res.json();
    }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      toast.innerText = msg;
      toast.className = 'toast show';
      setTimeout(() => { toast.className = 'toast'; }, 3000);
    }

    async function loadProducts(query = '') {
      const url = query ? ('/api/products?q=' + encodeURIComponent(query)) : '/api/products';
      const res = await api(url);
      allProducts = res.data || [];
      renderProducts(allProducts);
    }

    function renderProducts(products) {
      const grid = document.getElementById('product-grid');
      if (products.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1;">No products found.</p>';
        return;
      }
      grid.innerHTML = products.map(p => \`
        <div class="card" id="product-\${p.id}">
          <div>
            <div class="card-title">\${p.name}</div>
            <div class="card-desc">\${p.description || 'Special operations grade hardware.'}</div>
          </div>
          <div>
            <div class="card-price-row">
              <span class="card-price">$\${p.price}</span>
              <span class="card-stock" id="stock-\${p.id}">Stock: \${p.stock}</span>
            </div>
            <button class="btn-add" id="btn-add-\${p.id}" \${p.stock <= 0 ? 'disabled' : ''} onclick="addToCart('\${p.id}')">
              \${p.stock > 0 ? '+ Add to Cart' : 'Out of Stock'}
            </button>
          </div>
        </div>
      \`).join('');
    }

    function handleSearch(q) {
      loadProducts(q);
    }

    async function loadCart() {
      const res = await api('/api/cart');
      currentCart = res.data;
      updateCartUI();
    }

    function updateCartUI() {
      if (!currentCart) return;
      const countEl = document.getElementById('cart-count');
      const container = document.getElementById('cart-items-container');
      const summary = document.getElementById('cart-summary');
      const totalAmountEl = document.getElementById('cart-total-amount');

      countEl.innerText = currentCart.totalItems || 0;

      if (!currentCart.items || currentCart.items.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin-top: 2rem;" id="empty-cart-msg">Cart is empty.</p>';
        summary.style.display = 'none';
        return;
      }

      summary.style.display = 'block';
      totalAmountEl.innerText = '$' + currentCart.totalAmount;

      container.innerHTML = currentCart.items.map(item => {
        const prod = allProducts.find(p => p.id === item.productId) || { name: item.productId };
        return \`
          <div class="cart-item" id="cart-item-\${item.productId}">
            <div class="cart-item-info">
              <h4>\${prod.name}</h4>
              <p>$\${item.unitPrice} x \${item.quantity} = $\${item.unitPrice * item.quantity}</p>
            </div>
            <div class="cart-item-qty">
              <button onclick="changeQty('\${item.productId}', -1)">-</button>
              <span id="qty-\${item.productId}">\${item.quantity}</span>
              <button onclick="changeQty('\${item.productId}', 1)">+</button>
            </div>
          </div>
        \`;
      }).join('');
    }

    async function addToCart(productId) {
      const res = await api('/api/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId, quantity: 1 })
      });
      if (res.error) {
        showToast('Error: ' + res.message);
      } else {
        showToast('Added to cart!');
        currentCart = res.data;
        updateCartUI();
      }
    }

    async function changeQty(productId, delta) {
      if (delta > 0) {
        await api('/api/cart/items', {
          method: 'POST',
          body: JSON.stringify({ productId, quantity: 1 })
        });
      } else {
        await api('/api/cart/items/' + productId, {
          method: 'DELETE'
        });
      }
      await loadCart();
    }

    function toggleCart(show) {
      const drawer = document.getElementById('cart-drawer');
      if (show) drawer.classList.add('active');
      else drawer.classList.remove('active');
    }

    function openCheckoutModal() {
      if (!currentCart || currentCart.items.length === 0) return;
      document.getElementById('checkout-total').innerText = '$' + currentCart.totalAmount;
      document.getElementById('checkout-modal').classList.add('active');
    }

    function closeCheckoutModal() {
      document.getElementById('checkout-modal').classList.remove('active');
    }

    async function executeCheckoutAndPay() {
      const payBtn = document.getElementById('pay-confirm-btn');
      payBtn.disabled = true;
      payBtn.innerText = 'Processing Order...';

      try {
        // 1. Checkout Order
        const checkoutRes = await api('/api/orders/checkout', { method: 'POST' });
        if (checkoutRes.error) {
          alert('Checkout error: ' + checkoutRes.message);
          return;
        }

        const order = checkoutRes.data;

        // 2. Pay Order
        const payRes = await api('/api/payments', {
          method: 'POST',
          body: JSON.stringify({
            orderId: order.id,
            amount: order.totalAmount,
            paymentMethod: document.getElementById('checkout-payment-method').value
          })
        });

        if (payRes.error) {
          alert('Payment error: ' + payRes.message);
          return;
        }

        closeCheckoutModal();
        toggleCart(false);
        showToast('Order Paid Successfully! Ref: ' + payRes.data.payment.transactionRef);

        // Reload fresh products & cart
        await loadProducts();
        await loadCart();

        // Show confirmation alert banner
        const hero = document.querySelector('.hero');
        hero.innerHTML = \`
          <div style="background: rgba(16,185,129,0.15); border: 1px solid var(--success); padding: 1.5rem; border-radius: 8px;">
            <h3 style="color: var(--success); margin-bottom: 0.5rem;" id="checkout-success-title">Order Confirmed & Paid</h3>
            <p>Order ID: <code id="confirmed-order-id">\${order.id}</code></p>
            <p>Transaction: <code>\${payRes.data.payment.transactionRef}</code></p>
            <p style="margin-top: 0.5rem; color: #fff;">Status: <span class="badge" style="background: var(--success); color: #000;">PAID</span></p>
          </div>
        \`;
      } catch (err) {
        alert('Exception: ' + err.message);
      } finally {
        payBtn.disabled = false;
        payBtn.innerText = 'Confirm & Pay';
      }
    }

    // Initialize
    loadProducts();
    loadCart();

    // SSE Realtime events listener
    const sse = new EventSource('/api/events/stream');
    sse.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data);
        if (ev.type === 'stock_changed') {
          const el = document.getElementById('stock-' + ev.data.productId);
          if (el) el.innerText = 'Stock: ' + ev.data.remainingStock;
        }
      } catch {}
    };
  </script>
</body>
</html>
`;
