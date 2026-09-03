/* Mnahel's Cafe POS v0.15.39 — app logo, automatic receipt JPG, smooth post-order performance, booked-order cart editing */
(() => {
  'use strict';

  const RELEASE = '0.15.39';
  const AUTO_JPG_KEY = 'mnahels.receipt-auto-jpg';
  const AUTO_JPG_MIGRATION = 'mnahels.receipt-auto-jpg-restored-v39';
  const LOGO_URL = '/assets/brand/mnahels-logo.b64?v=20260903-logo-auto-jpg-performance-39';
  const activeStates = new Set(['New', 'Confirmed', 'Preparing', 'Ready']);
  const state = window.state || {};
  let bootTimer = 0;
  let logoPromise = null;
  let lastOpsFetch = 0;
  let opsBusy = false;
  let lastFocusId = 0;
  let lastOperationRow = null;

  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
  const pref = (key, fallback = '') => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
  const setPref = (key, value) => { try { localStorage.setItem(key, String(value)); } catch { } };
  const toast = message => { if (typeof window.toast === 'function') window.toast(message); };

  async function apiRequest(path, options = {}) {
    if (typeof window.api === 'function') return window.api(path, options);
    const response = await fetch(`/api${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`;
      try { message = (await response.json()).message || message; } catch { }
      throw new Error(message);
    }
    return response.status === 204 ? null : response.json();
  }

  function releaseLabel() {
    document.documentElement.dataset.v56Release = RELEASE;
    const meta = q('meta[name="application-version"]');
    if (meta) meta.content = RELEASE;
    document.title = `Mnahel's Cafe POS v${RELEASE}`;
  }

  function restoreAutoJpg() {
    if (pref(AUTO_JPG_MIGRATION, '0') !== '1') {
      setPref(AUTO_JPG_KEY, '1');
      setPref(AUTO_JPG_MIGRATION, '1');
    }
    const input = q('#v45-auto-jpg');
    if (!input) return;
    input.disabled = false;
    input.removeAttribute('aria-disabled');
    input.checked = pref(AUTO_JPG_KEY, '1') === '1';
    const label = input.closest('label');
    const text = label?.querySelector('span');
    if (text) text.textContent = 'Auto-download receipt as JPG';
    if (!input.dataset.v56Bound) {
      input.dataset.v56Bound = '1';
      input.addEventListener('change', () => setPref(AUTO_JPG_KEY, input.checked ? '1' : '0'));
    }
  }

  function loadBrandLogo() {
    if (document.documentElement.style.getPropertyValue('--mnahels-brand-logo')) return Promise.resolve();
    if (logoPromise) return logoPromise;
    logoPromise = fetch(LOGO_URL, { cache: 'force-cache' })
      .then(response => { if (!response.ok) throw new Error('Logo asset unavailable'); return response.text(); })
      .then(text => {
        const data = `data:image/webp;base64,${text.replace(/\s+/g, '')}`;
        document.documentElement.style.setProperty('--mnahels-brand-logo', `url("${data}")`);
        document.documentElement.classList.add('v56-logo-ready');
        let icon = q('link[rel~="icon"]');
        if (!icon) { icon = document.createElement('link'); icon.rel = 'icon'; document.head.append(icon); }
        icon.href = data;
      })
      .catch(() => { logoPromise = null; });
    return logoPromise;
  }

  function mapCart(order) {
    const variants = state.variants || [];
    const products = state.products || [];
    return (order.items || []).map(item => {
      const variant = variants.find(v => Number(v.id) === Number(item.variantId));
      if (!variant) throw new Error(`${item.productName || 'An item'} is no longer available in the live menu.`);
      const product = products.find(p => Number(p.id) === Number(variant.productId));
      if (!product) throw new Error(`${item.productName || 'An item'} product is no longer available.`);
      return {
        variantId: Number(variant.id), productId: Number(product.id), productName: product.name,
        variantName: variant.name, quantity: Math.max(1, Number(item.quantity || 1)),
        unitPrice: Number(variant.price || item.unitPrice || 0), lineTotal: 0
      };
    }).map(item => ({ ...item, lineTotal: item.unitPrice * item.quantity }));
  }

  function clearEditForm() {
    state.v56EditingOrderId = null;
    state.v56EditingOrder = null;
    state.v56EditServiceContext = null;
    document.documentElement.classList.remove('v56-editing-order', 'v35-booking-active');
    const screen = q('#screen-pos');
    screen?.classList.remove('v56-editing-order', 'v35-booking-open', 'v38-ready');
    q('#v56-edit-banner')?.remove();
    const button = q('#place-order span');
    if (button) button.textContent = 'Place order';
    if (typeof window.renderCart === 'function') window.renderCart();
  }

  function installEditBanner(order) {
    q('#v56-edit-banner')?.remove();
    const panel = q('#screen-pos .cart-panel');
    if (!panel) return;
    const banner = document.createElement('div');
    banner.id = 'v56-edit-banner';
    banner.className = 'v56-edit-banner';
    banner.innerHTML = `<div><small>EDITING BOOKED ORDER</small><strong>${esc(order.tokenNumber)} · ${esc(order.orderNumber)}</strong></div><button type="button">Cancel edit</button>`;
    banner.querySelector('button').addEventListener('click', () => { clearEditForm(); toast('Order edit cancelled.'); });
    panel.prepend(banner);
  }

  async function beginEdit(orderId) {
    if (!Number(orderId)) return;
    try {
      const order = await apiRequest(`/orders/${orderId}/edit`);
      state.cart = mapCart(order);
      state.orderType = order.orderType || 'Takeaway';
      state.paymentMethod = order.paymentMethod || 'Cash';
      state.v56EditingOrderId = Number(order.id);
      state.v56EditingOrder = order;
      state.v56EditServiceContext = { serviceMode: order.serviceMode, serviceAssignmentId: order.serviceAssignmentId };
      const note = q('#order-note'); if (note) note.value = order.notes || '';
      const discount = q('#discount'); if (discount) discount.value = Number(order.discount || 0);
      qa('[data-order-type]').forEach(button => button.classList.toggle('active', button.dataset.orderType === state.orderType));
      qa('[data-payment]').forEach(button => button.classList.toggle('active', button.dataset.payment === state.paymentMethod));
      document.documentElement.classList.add('v56-editing-order', 'v35-booking-active');
      const screen = q('#screen-pos');
      screen?.classList.add('v56-editing-order', 'v35-booking-open', 'v38-ready');
      if (typeof window.showScreen === 'function') window.showScreen('pos');
      if (typeof window.renderCart === 'function') window.renderCart();
      installEditBanner(order);
      const button = q('#place-order span'); if (button) button.textContent = 'Update order';
      q('#v56-order-dialog')?.close();
      setTimeout(() => q('#screen-pos .cart-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
      toast(`Order ${order.tokenNumber} opened in the cart.`);
    } catch (error) { toast(error.message || 'Could not open this order for editing.'); }
  }

  async function updateEditingOrder() {
    const orderId = Number(state.v56EditingOrderId || 0);
    if (!orderId) return false;
    if (!(state.cart || []).length) { toast('Add at least one item before updating the order.'); return true; }
    const button = q('#place-order');
    if (button?.disabled) return true;
    if (button) button.disabled = true;
    try {
      const order = await apiRequest(`/orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({
          orderType: state.orderType || state.v56EditingOrder?.orderType || 'Takeaway',
          paymentMethod: state.paymentMethod || state.v56EditingOrder?.paymentMethod || 'Cash',
          discount: Number(q('#discount')?.value || 0), notes: q('#order-note')?.value || '',
          items: (state.cart || []).map(item => ({ variantId: Number(item.variantId), quantity: Math.max(1, Number(item.quantity || 1)) }))
        })
      });
      clearEditForm();
      state.cart = [];
      if (typeof window.renderCart === 'function') window.renderCart();
      if (typeof window.refreshHub === 'function') window.refreshHub(true);
      toast(`${order.tokenNumber || 'Order'} updated successfully.`);
      if (typeof window.showOrderComplete === 'function') window.showOrderComplete(order);
    } catch (error) { toast(error.message || 'Could not update the order.'); }
    finally { if (button) button.disabled = false; }
    return true;
  }

  function installCheckoutInterceptor() {
    const button = q('#place-order');
    if (!button || button.dataset.v56EditBound) return;
    button.dataset.v56EditBound = '1';
    button.addEventListener('click', event => {
      if (!state.v56EditingOrderId) return;
      event.preventDefault(); event.stopImmediatePropagation(); updateEditingOrder();
    }, true);
  }

  async function applyOperationAction(order, action) {
    if (action === 'edit') return beginEdit(order.id);
    if (action === 'receipt') return window.mnahelsV31?.printUrl?.(`/api/receipts/${order.id}/customer`, 'receipt');
    if (action === 'kitchen') return window.mnahelsV31?.printUrl?.(`/api/receipts/${order.id}/kitchen`, 'kitchen ticket');
    if (action === 'cancel') {
      if (!confirm(`Cancel ${order.tokenNumber || order.orderNumber}?`)) return;
      await apiRequest(`/orders/${order.id}/status`, { method: 'POST', body: JSON.stringify({ status: 'Cancelled' }) });
    } else if (action === 'pay') {
      await apiRequest(`/orders/${order.id}/payment`, { method: 'POST', body: JSON.stringify({ paymentStatus: 'Paid', paymentMethod: order.paymentMethod || 'Cash' }) });
    } else if (action === 'status') {
      const statuses = ['New', 'Confirmed', 'Preparing', 'Ready', 'Completed', 'Cancelled'];
      const next = prompt(`Status: ${statuses.join(', ')}`, order.status || 'New');
      if (!next || !statuses.includes(next)) return;
      await apiRequest(`/orders/${order.id}/status`, { method: 'POST', body: JSON.stringify({ status: next }) });
    }
    if (typeof window.refreshHub === 'function') window.refreshHub(true);
    lastOpsFetch = 0; scheduleBoot(80);
  }

  function canEdit(order) { return activeStates.has(order.status) && order.status !== 'Cancelled' && order.paymentStatus !== 'Paid'; }

  function decorateOperationCards(orders) {
    const byNumber = new Map(orders.map(order => [String(order.orderNumber || '').trim(), order]));
    qa('#admin-orders .order-row').forEach(row => {
      const number = q('.order-main strong', row)?.textContent?.trim();
      const order = byNumber.get(number);
      if (!order) return;
      let actions = q('.v56-operation-actions', row);
      if (!actions) { actions = document.createElement('div'); actions.className = 'v56-operation-actions'; row.append(actions); }
      actions.innerHTML = `
        ${canEdit(order) ? '<button type="button" data-op="edit">Edit order</button>' : ''}
        <button type="button" data-op="receipt">Receipt</button>
        <button type="button" data-op="kitchen">Kitchen</button>
        ${activeStates.has(order.status) ? '<button type="button" data-op="status">Status</button>' : ''}
        ${order.paymentStatus !== 'Paid' && order.status !== 'Cancelled' ? '<button type="button" data-op="pay">Mark paid</button>' : ''}
        ${activeStates.has(order.status) ? '<button type="button" data-op="cancel" class="danger">Cancel</button>' : ''}`;
      actions.onclick = async event => {
        const action = event.target.closest('[data-op]')?.dataset.op;
        if (!action) return;
        lastFocusId = order.id; lastOperationRow = row;
        try { await applyOperationAction(order, action); }
        catch (error) { toast(error.message || 'Could not update the order.'); }
      };
    });
    if (lastFocusId && lastOperationRow?.isConnected) lastOperationRow.classList.add('v56-last-operation');
  }

  async function maybeDecorateOperations() {
    const admin = q('#screen-admin');
    if (!admin?.classList.contains('active') || document.hidden || opsBusy || Date.now() - lastOpsFetch < 12000) return;
    opsBusy = true; lastOpsFetch = Date.now();
    try {
      const result = await apiRequest('/orders?take=120');
      decorateOperationCards(Array.isArray(result) ? result : (result?.items || []));
    } catch { }
    finally { opsBusy = false; }
  }

  function enhanceSettings() {
    const settings = q('.v45-settings-panel');
    if (!settings || q('#v56-printer-recovery', settings)) return;
    const card = document.createElement('section');
    card.id = 'v56-printer-recovery';
    card.className = 'v56-printer-recovery';
    card.innerHTML = '<h4>Printer recovery</h4><p>Use this if the printer was changed, disconnected or Windows kept the old device.</p><div><button type="button" data-v56-print="receipt">Test receipt</button><button type="button" data-v56-print="kitchen">Test kitchen</button><button type="button" data-v56-print="window">Open Windows printers</button></div>';
    card.addEventListener('click', event => {
      const action = event.target.closest('[data-v56-print]')?.dataset.v56Print;
      if (action === 'window') location.href = 'ms-settings:printers';
      else if (action) window.mnahelsV31?.printUrl?.('/api/printers/test', `${action} printer test`);
    });
    settings.append(card);
  }

  function stabilizeAfterOrder() {
    document.documentElement.classList.add('v56-post-order-stable');
    const clean = () => {
      qa('.v40-fly-ghost').forEach(node => node.remove());
      if (typeof document.getAnimations === 'function') {
        document.getAnimations().forEach(animation => {
          const target = animation.effect?.target;
          if (target?.closest?.('#screen-pos .product-card, #screen-pos .product-grid, .v40-fly-ghost')) animation.cancel();
        });
      }
    };
    clean(); setTimeout(clean, 350); setTimeout(clean, 1200);
  }

  function installCompletionHook() {
    const original = window.showOrderComplete;
    if (typeof original !== 'function' || original.__v56Performance) return;
    const wrapped = function (...args) {
      const result = original.apply(this, args);
      stabilizeAfterOrder();
      return result;
    };
    wrapped.__v56Performance = true;
    window.showOrderComplete = wrapped;
  }

  function boot() {
    bootTimer = 0;
    releaseLabel();
    loadBrandLogo();
    restoreAutoJpg();
    installCheckoutInterceptor();
    installCompletionHook();
    enhanceSettings();
    maybeDecorateOperations();
    if (state.v56EditingOrderId && state.v56EditingOrder) installEditBanner(state.v56EditingOrder);
  }

  function scheduleBoot(delay = 160) {
    if (bootTimer) return;
    bootTimer = window.setTimeout(boot, delay);
  }

  window.mnahelsV56 = { beginEdit, clearEditForm, release: RELEASE };
  document.documentElement.classList.add('v56-performance');
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleBoot(40); });
  document.addEventListener('click', event => {
    if (event.target.closest('#refresh-orders, [data-screen="admin"], [data-screen="orders"], #new-order')) scheduleBoot(100);
  }, true);
  new MutationObserver(() => scheduleBoot()).observe(document.body, { childList: true, subtree: true });
  window.setInterval(() => { if (!document.hidden) scheduleBoot(20); }, 10000);
  scheduleBoot(0);
})();
