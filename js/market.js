/* CUDMAZE marketplace: product modal, WhatsApp purchase, accounts, saved cart, WhatsApp checkout.
   Guests can browse and buy over WhatsApp with no account. Accounts/carts use the /api/* Worker. */
(function () {
  'use strict';

  var WA_NUMBER = '2348028699824';       // digits only, as wa.me requires
  var DEFAULT_IMAGE = 'img/logo.webp';
  var MAX_CART = 30;
  var USERNAME_RE = /^(?![0-9])[a-zA-Z0-9_]{3,20}$/;
  var MOBILE_RE = /^\+?\d{7,15}$/;

  var products = {};
  var state = { user: null, cart: [] };
  var current = null;                    // product open in the product modal
  var stack = [];                        // open overlays, last = top
  var lastFocus = new Map();
  var saveTimer = null;

  var $ = function (id) { return document.getElementById(id); };

  // ---------- tiny DOM helper (always textContent, never innerHTML) ----------
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (k === 'text') n.textContent = v;
      else if (k === 'class') n.className = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else if (v === true) n.setAttribute(k, '');
      else if (v !== false && v != null) n.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function icon(name) { return el('i', { class: 'bi bi-' + name, 'aria-hidden': 'true' }); }
  function toast(msg, ms) { if (typeof showToast === 'function') showToast(msg, ms || 2500); }

  function slug(s) { return s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function parseVariations(str) {
    if (!str) return [];
    return str.split(';').map(function (g) {
      var p = g.split(':');
      return { name: p[0].trim(), options: (p[1] || '').split('|').map(function (o) { return o.trim(); }).filter(Boolean) };
    }).filter(function (g) { return g.name && g.options.length; });
  }
  function money(n) { return '\u20A6' + Number(n).toLocaleString('en-NG'); }
  function priceOf(x) { var n = Number(x); return (x !== '' && x != null && !isNaN(n) && n > 0) ? n : null; }
  function priceLabel(p) { var pr = priceOf(p.price); return pr ? (p.from ? 'From ' : '') + money(pr) : null; }
  function abs(path) { return new URL(path, document.baseURI).href; }
  function productUrl(id) { return location.href.split('#')[0] + '#product=' + id; }

  // ---------- overlay manager (shared by every modal) ----------
  function openOverlay(o) {
    if (stack.indexOf(o) === -1) { lastFocus.set(o, document.activeElement); stack.push(o); }
    o.classList.add('visible');
    o.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('pm-lock');
    setTimeout(function () { var d = o.querySelector('.pm-dialog'); if (d) d.focus(); }, 30);
  }
  function closeOverlay(o) {
    var i = stack.indexOf(o);
    if (i === -1) return;
    stack.splice(i, 1);
    o.classList.remove('visible');
    o.setAttribute('aria-hidden', 'true');
    if (!stack.length) document.documentElement.classList.remove('pm-lock');
    if (o.id === 'productModal') {
      current = null;
      if (history.replaceState && /^#product=/.test(location.hash)) history.replaceState(null, '', location.href.split('#')[0]);
    }
    var f = lastFocus.get(o);
    if (f && f.focus && document.contains(f)) f.focus();
  }
  function trapTab(e, o) {
    var d = o.querySelector('.pm-dialog');
    var f = Array.prototype.filter.call(d.querySelectorAll('button:not([disabled]), input, select, textarea, [href]'),
      function (n) { return n.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === d)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // ---------- API ----------
  function api(method, path, body) {
    return fetch(path, {
      method: method, credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().then(function (d) { d.status = r.status; return d; })
        .catch(function () { return { ok: false, status: r.status, error: 'Accounts are not available right now. You can still buy over WhatsApp.' }; });
    }).catch(function () {
      return { ok: false, status: 0, error: 'Can\u2019t reach the server. Check your connection and try again.' };
    });
  }

  // ---------- products (built from the existing Services rows) ----------
  function collect() {
    document.querySelectorAll('#serviceList .list-item').forEach(function (item) {
      var btn = item.querySelector('[data-product-open]');
      var nameEl = item.querySelector('.item-icon');
      if (!btn || !nameEl) return;
      var name = nameEl.textContent.trim();
      var id = item.dataset.productId || slug(name);
      var descEl = item.querySelector('h6');
      products[id] = {
        id: id, name: name,
        description: descEl ? descEl.textContent.trim() : '',
        tags: Array.prototype.map.call(item.querySelectorAll('.tag'), function (t) { return t.textContent.trim(); }),
        price: item.dataset.price || '',
        image: item.dataset.image || DEFAULT_IMAGE,
        variations: parseVariations(item.dataset.variations),
        qty: item.dataset.qty !== 'off',
        kind: item.dataset.kind || 'product',
        from: item.dataset.from === '1',
        was: Number(item.dataset.was) || 0
      };
      item.dataset.productId = id;
      btn.setAttribute('aria-haspopup', 'dialog');
      btn.setAttribute('aria-label', (products[id].kind === 'service' ? 'Book ' : 'View ') + name);
      if (!item.querySelector('.product-price')) {
        var pr = priceOf(item.dataset.price);
        var line = el('div', { class: 'product-price' + (pr ? '' : ' is-tbc'), text: pr ? money(pr) : 'Price on request' });
        var tagsP = item.querySelector('p');
        item.insertBefore(line, tagsP);
      }
    });
  }

  // ---------- PRODUCT MODAL ----------
  var pm;
  function renderProduct(p) {
    $('pmName').textContent = p.name;
    var pr = priceOf(p.price), pe = $('pmPrice');
    pe.textContent = priceLabel(p) || 'Price on request \u2013 message us to agree one';
    if (pr && p.was > pr) {
      pe.appendChild(document.createTextNode(' '));
      pe.appendChild(el('s', { class: 'was', text: money(p.was) }));
      pe.appendChild(el('span', { class: 'save', text: ' -' + Math.round((p.was - pr) * 100 / p.was) + '%' }));
    }
    pe.classList.toggle('pm-price-tbc', !pr);
    var buy = $('pmBuy'); buy.textContent = '';
    buy.appendChild(icon('whatsapp')); buy.appendChild(document.createTextNode(' ' + (p.kind === 'service' ? 'Book on WhatsApp' : 'Buy on WhatsApp')));
    $('pmDesc').textContent = p.description;
    $('pmTags').textContent = p.tags.join('  ');
    var img = $('pmImage'); img.alt = p.name; img.src = p.image;
    img.onerror = function () { this.onerror = null; this.src = DEFAULT_IMAGE; };
    var vw = $('pmVariations'); vw.textContent = '';
    p.variations.forEach(function (g, i) {
      var id = 'pmVar' + i;
      var sel = el('select', { id: id, class: 'pm-input', 'data-name': g.name }, [el('option', { value: '', text: 'Select ' + g.name.toLowerCase() })]);
      g.options.forEach(function (o) { sel.appendChild(el('option', { value: o, text: o })); });
      vw.appendChild(el('div', { class: 'pm-field' }, [el('label', { for: id, text: g.name }), sel]));
    });
    $('pmQtyRow').hidden = !p.qty;
    $('pmQty').value = 1; $('pmMessage').value = ''; setPmError('');
    renderProductActions();
  }
  function renderProductActions() {
    if (!pm) return;
    $('pmCart').hidden = !state.user;
    $('pmSignin').hidden = !!state.user;
  }
  function setPmError(msg) { var e = $('pmError'); e.textContent = msg; e.hidden = !msg; }

  function openProduct(id, fromHash) {
    var p = products[id]; if (!p) return;
    current = p; renderProduct(p); openOverlay(pm);
    if (!fromHash && history.replaceState) history.replaceState(null, '', '#product=' + p.id);
  }

  // validates quantity + variations; returns {qty, variation} or null (and shows the error)
  function readProductChoices() {
    var qty = current.qty ? parseInt($('pmQty').value, 10) : 1;
    if (!qty || qty < 1 || qty > 99) { setPmError('Please enter a quantity between 1 and 99.'); $('pmQty').focus(); return null; }
    var chosen = [], bad = null;
    pm.querySelectorAll('#pmVariations select').forEach(function (s) {
      if (!s.value && !bad) bad = s;
      chosen.push(s.dataset.name + ': ' + s.value);
    });
    if (bad) { setPmError('Please choose an option for ' + bad.dataset.name + '.'); bad.focus(); return null; }
    setPmError('');
    return { qty: qty, variation: chosen.join(', ') };
  }

  // ---------- WhatsApp ----------
  function openWhatsApp(text) {
    var url = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text);
    if (url.length > 6000) { return false; }
    var w = window.open(url, '_blank');
    if (w) { w.opener = null; } else { location.href = url; }
    toast('Opening WhatsApp\u2026');
    return true;
  }
  function singleMessage(p, c, note) {
    var svc = p.kind === 'service';
    var lines = ['Hello CUDMAZE,', '', svc ? 'I would like to book the following service:' : 'I am interested in purchasing the following product:', '',
      (svc ? 'Service: ' : 'Product: ') + p.name,
      'Price: ' + (priceLabel(p) || 'To be confirmed \u2013 please advise')];
    if (p.qty) lines.push('Quantity: ' + c.qty);
    if (c.variation) lines.push('Variation: ' + c.variation);
    lines.push((svc ? 'Service Link: ' : 'Product Link: ') + productUrl(p.id), (svc ? 'Service Image: ' : 'Product Image: ') + abs(p.image));
    if (note) lines.push('', 'Additional Message: ' + note);
    lines.push('', svc ? 'I would like to proceed with this booking. Please provide further details.' : 'I would like to proceed with this purchase. Please provide further details.', '', 'Thank you.');
    return lines.join('\n');
  }
  function cartMessage(note) {
    var total = 0, unpriced = 0;
    var lines = ['Hello CUDMAZE,', '', 'I would like to order the following items:', ''];
    state.cart.forEach(function (it, i) {
      var pr = priceOf(it.price);
      lines.push((i + 1) + '. ' + it.name);
      lines.push('   Price: ' + (pr ? fromPrefix(it) + money(pr) : 'To be confirmed') + '  |  Quantity: ' + it.qty);
      if (it.variation) lines.push('   Variation: ' + it.variation);
      if (pr) { lines.push('   Subtotal: ' + money(pr * it.qty)); total += pr * it.qty; } else unpriced++;
      lines.push('   Link: ' + productUrl(it.id), '');
    });
    lines.push('Total: ' + (total ? money(total) : 'To be confirmed') + (unpriced && total ? ' (excluding ' + unpriced + ' item' + (unpriced > 1 ? 's' : '') + ' with price to be confirmed)' : ''));
    var u = state.user;
    lines.push('', 'Name: ' + (u.fullName || u.username), 'Phone: ' + u.mobile);
    if (u.address) lines.push('Address: ' + u.address);
    if (note) lines.push('', 'Additional Message: ' + note);
    lines.push('', 'Please confirm availability and the next steps. Thank you.');
    return lines.join('\n');
  }

  // ---------- CART ----------
  function fromPrefix(it) { return products[it.id] && products[it.id].from ? 'From ' : ''; }
  function cartCount() { return state.cart.reduce(function (s, i) { return s + i.qty; }, 0); }
  function updateHeader() {
    var n = cartCount(), c = $('cartCount');
    c.textContent = n > 99 ? '99+' : n; c.hidden = !n;
    $('cartBtn').setAttribute('aria-label', n ? 'Open cart, ' + n + ' item' + (n > 1 ? 's' : '') : 'Open cart');
    var u = state.user;
    $('accountIcon').className = 'bi ' + (u ? 'bi-person-check-fill' : 'bi-person');
    $('accountBtn').setAttribute('aria-label', u ? 'My account (' + u.username + ')' : 'Sign in or create an account');
    $('accountBtn').title = u ? 'My account' : 'Sign in / Register';
    renderProductActions();
  }
  function saveCartSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveCartNow, 350);
  }
  function saveCartNow() {
    clearTimeout(saveTimer);
    if (!state.user) return Promise.resolve();
    return api('PUT', '/api/cart', { items: state.cart }).then(function (r) {
      if (r.status === 401) { state.user = null; state.cart = []; updateHeader(); toast('Your session expired. Please sign in again.', 3500); }
      else if (!r.ok) toast('Couldn\u2019t save your cart. Please check your connection.', 3500);
    });
  }
  function addToCart(p, c) {
    var key = p.id + '|' + c.variation;
    var hit = state.cart.filter(function (i) { return i.id + '|' + i.variation === key; })[0];
    if (hit) hit.qty = Math.min(99, hit.qty + c.qty);
    else {
      if (state.cart.length >= MAX_CART) { setPmError('Your cart is full (' + MAX_CART + ' items). Remove something first.'); return false; }
      state.cart.push({ id: p.id, name: p.name, price: p.price || '', qty: c.qty, variation: c.variation, image: p.image });
    }
    updateHeader(); saveCartSoon();
    return true;
  }
  function cartTotals() {
    var total = 0, unpriced = 0;
    state.cart.forEach(function (i) { var pr = priceOf(i.price); if (pr) total += pr * i.qty; else unpriced++; });
    return { total: total, unpriced: unpriced };
  }

  var cartMode = 'view';   // view | confirmClear | afterCheckout
  function renderCart() {
    var body = $('cartBody'), actions = $('cartActions');
    body.textContent = ''; actions.textContent = '';
    body.appendChild(el('h2', { id: 'cartTitle', text: 'My Cart' }));
    if (!state.user) {
      body.appendChild(el('p', { class: 'pm-note', text: 'Sign in to keep a cart that is saved to your account and follows you across devices. You can always buy any product directly over WhatsApp without an account.' }));
      actions.appendChild(el('button', { type: 'button', class: 'btn btn-success', onclick: function () { closeOverlay($('cartModal')); openAuth('login'); } }, ['Sign in / Register']));
      return;
    }
    if (!state.cart.length) {
      body.appendChild(el('div', { class: 'pm-empty' }, [icon('bag'), el('p', { text: 'Your cart is empty.' }), el('p', { class: 'pm-note', text: 'Open any item and choose \u201CAdd to Cart\u201D.' })]));
      actions.appendChild(el('button', { type: 'button', class: 'btn btn-success', onclick: function () { closeOverlay($('cartModal')); if (typeof openTab === 'function') openTab(null, 'tab3'); } }, ['Browse the shop']));
      return;
    }
    if (cartMode === 'afterCheckout') {
      body.appendChild(el('div', { class: 'pm-banner', role: 'status' }, [
        el('strong', { text: 'WhatsApp opened.' }),
        el('span', { text: ' Your cart is still saved. Clear it only once you have sent your order.' }),
        el('div', { class: 'pm-banner-actions' }, [
          el('button', { type: 'button', class: 'btn btn-sm btn-success', onclick: function () { clearCart(); } }, ['Yes, clear my cart']),
          el('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary', onclick: function () { cartMode = 'view'; renderCart(); } }, ['Keep it'])
        ])
      ]));
    }
    var list = el('ul', { class: 'cart-list' });
    state.cart.forEach(function (it, idx) {
      var pr = priceOf(it.price);
      list.appendChild(el('li', { class: 'cart-item' }, [
        el('img', { src: it.image || DEFAULT_IMAGE, alt: '', width: 600, height: 340, loading: 'lazy' }),
        el('div', { class: 'cart-info' }, [
          el('div', { class: 'cart-name', text: it.name }),
          it.variation ? el('div', { class: 'cart-var', text: it.variation }) : null,
          el('div', { class: 'cart-price', text: pr ? fromPrefix(it) + money(pr) + ' each' : 'Price on request' }),
          el('div', { class: 'pm-qty cart-qty' }, [
            el('button', { type: 'button', 'aria-label': 'Decrease quantity of ' + it.name, onclick: function () { changeQty(idx, -1); } }, ['\u2212']),
            el('span', { class: 'cart-q', 'aria-live': 'polite', text: String(it.qty) }),
            el('button', { type: 'button', 'aria-label': 'Increase quantity of ' + it.name, onclick: function () { changeQty(idx, 1); } }, ['+']),
            el('button', { type: 'button', class: 'cart-remove', 'aria-label': 'Remove ' + it.name + ' from cart', onclick: function () { removeItem(idx); } }, [icon('trash')])
          ])
        ])
      ]));
    });
    body.appendChild(list);
    var t = cartTotals();
    body.appendChild(el('div', { class: 'cart-total' }, [
      el('span', { text: 'Total' }),
      el('strong', { text: t.total ? money(t.total) : 'To be confirmed' })
    ]));
    if (t.unpriced) body.appendChild(el('p', { class: 'pm-note', text: t.unpriced + ' item' + (t.unpriced > 1 ? 's have' : ' has') + ' no listed price yet \u2013 we\u2019ll confirm it on WhatsApp.' }));
    body.appendChild(el('div', { class: 'pm-field' }, [
      el('label', { for: 'cartMessage' }, ['Message ', el('span', { text: '(optional)' })]),
      el('textarea', { id: 'cartMessage', class: 'pm-input', rows: 2, maxlength: 500, placeholder: 'Negotiation, delivery details or any question\u2026' })
    ]));
    body.appendChild(el('div', { class: 'pm-error', id: 'cartError', role: 'alert', hidden: true }));

    if (cartMode === 'confirmClear') {
      actions.appendChild(el('p', { class: 'pm-note', text: 'Remove every item from your cart?' }));
      actions.appendChild(el('div', { class: 'pm-btn-row' }, [
        el('button', { type: 'button', class: 'btn btn-danger', onclick: function () { clearCart(); } }, ['Yes, clear cart']),
        el('button', { type: 'button', class: 'btn btn-outline-secondary', onclick: function () { cartMode = 'view'; renderCart(); } }, ['Cancel'])
      ]));
    } else {
      actions.appendChild(el('button', { type: 'button', class: 'btn btn-whatsapp', onclick: checkout }, [icon('whatsapp'), ' Checkout on WhatsApp']));
      actions.appendChild(el('button', { type: 'button', class: 'btn btn-link pm-signin', onclick: function () { cartMode = 'confirmClear'; renderCart(); } }, ['Clear cart']));
    }
  }
  function keepNote() { var m = $('cartMessage'); return m ? m.value : ''; }
  function rerenderKeepingNote() { var n = keepNote(); renderCart(); var m = $('cartMessage'); if (m) m.value = n; }
  function changeQty(i, d) {
    var it = state.cart[i]; if (!it) return;
    it.qty = Math.max(1, Math.min(99, it.qty + d));
    updateHeader(); saveCartSoon(); rerenderKeepingNote();
  }
  function removeItem(i) {
    var gone = state.cart.splice(i, 1)[0];
    updateHeader(); saveCartSoon(); rerenderKeepingNote();
    if (gone) toast('Removed ' + gone.name);
  }
  function clearCart() {
    state.cart = []; cartMode = 'view'; updateHeader(); saveCartNow(); renderCart(); toast('Cart cleared');
  }
  function checkout() {
    var note = keepNote().trim();
    var ok = openWhatsApp(cartMessage(note));
    if (!ok) { var e = $('cartError'); e.textContent = 'This cart is too long for one WhatsApp message. Please remove a few items and try again.'; e.hidden = false; return; }
    cartMode = 'afterCheckout'; rerenderKeepingNote();   // cart is NOT cleared automatically
    $('cartBody').scrollTop = 0;
  }
  function openCart() {
    cartMode = 'view'; renderCart(); openOverlay($('cartModal'));
  }

  // ---------- AUTH ----------
  function fieldRow(id, label, props, hint) {
    var input = el('input', Object.assign({ id: id, class: 'pm-input', 'aria-describedby': id + 'Err' }, props));
    return el('div', { class: 'pm-field' }, [
      el('label', { for: id, text: label }), input,
      hint ? el('div', { class: 'pm-hint', text: hint }) : null,
      el('div', { class: 'pm-error pm-field-error', id: id + 'Err', hidden: true })
    ]);
  }
  function fieldError(id, msg) {
    var e = $(id + 'Err'), i = $(id);
    e.textContent = msg || ''; e.hidden = !msg;
    if (i) i.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  }
  function busy(btn, on, label) {
    btn.disabled = on;
    btn.textContent = on ? 'Please wait\u2026' : label;
  }

  function openAuth(tab) {
    var body = $('authBody'); body.textContent = '';
    body.appendChild(el('h2', { id: 'authTitle', text: 'Welcome to CUDMAZE' }));
    body.appendChild(el('p', { class: 'pm-note', text: 'An account is optional. It lets you save a cart across devices. You can buy over WhatsApp without one.' }));
    var tabs = el('div', { class: 'pm-tabs', role: 'tablist' });
    var tLogin = el('button', { type: 'button', role: 'tab', id: 'tabLogin', text: 'Sign in' });
    var tReg = el('button', { type: 'button', role: 'tab', id: 'tabReg', text: 'Create account' });
    tabs.appendChild(tLogin); tabs.appendChild(tReg); body.appendChild(tabs);

    var login = el('form', { id: 'loginForm', novalidate: true, role: 'tabpanel', 'aria-labelledby': 'tabLogin' }, [
      fieldRow('lgUser', 'Username', { type: 'text', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false' }),
      fieldRow('lgPass', 'Password', { type: 'password', autocomplete: 'current-password' }),
      el('div', { class: 'pm-error', id: 'lgError', role: 'alert', hidden: true }),
      el('button', { type: 'submit', class: 'btn btn-success pm-submit', id: 'lgSubmit', text: 'Sign in' })
    ]);
    var reg = el('form', { id: 'regForm', novalidate: true, role: 'tabpanel', 'aria-labelledby': 'tabReg' }, [
      fieldRow('rgUser', 'Username', { type: 'text', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false' }, '3\u201320 letters, numbers or underscores. Cannot start with a number.'),
      fieldRow('rgMobile', 'Mobile number', { type: 'tel', inputmode: 'tel', autocomplete: 'tel', placeholder: '+2348012345678' }),
      fieldRow('rgPass', 'Password', { type: 'password', autocomplete: 'new-password' }, 'At least 8 characters.'),
      fieldRow('rgPass2', 'Confirm password', { type: 'password', autocomplete: 'new-password' }),
      el('div', { class: 'pm-error', id: 'rgError', role: 'alert', hidden: true }),
      el('button', { type: 'submit', class: 'btn btn-success pm-submit', id: 'rgSubmit', text: 'Create account' })
    ]);
    body.appendChild(login); body.appendChild(reg);

    function show(which) {
      var isLogin = which === 'login';
      login.hidden = !isLogin; reg.hidden = isLogin;
      tLogin.setAttribute('aria-selected', isLogin); tReg.setAttribute('aria-selected', !isLogin);
      tLogin.classList.toggle('active', isLogin); tReg.classList.toggle('active', !isLogin);
    }
    tLogin.addEventListener('click', function () { show('login'); });
    tReg.addEventListener('click', function () { show('register'); });
    show(tab || 'login');

    login.addEventListener('submit', function (e) {
      e.preventDefault();
      var u = $('lgUser').value.trim(), p = $('lgPass').value;
      var ok = fieldError('lgUser', u ? '' : 'Enter your username.');
      ok = fieldError('lgPass', p ? '' : 'Enter your password.') && ok;
      if (!ok) return;
      var b = $('lgSubmit'); busy(b, true); $('lgError').hidden = true;
      api('POST', '/api/login', { username: u, password: p }).then(function (r) {
        busy(b, false, 'Sign in');
        if (!r.ok) { $('lgError').textContent = r.error || 'Could not sign in.'; $('lgError').hidden = false; return; }
        signedIn(r);
      });
    });
    reg.addEventListener('submit', function (e) {
      e.preventDefault();
      var u = $('rgUser').value.trim(), m = $('rgMobile').value.trim().replace(/[\s-]/g, ''), p = $('rgPass').value, p2 = $('rgPass2').value;
      var ok = fieldError('rgUser', USERNAME_RE.test(u) ? '' : 'Use 3\u201320 letters, numbers or underscores, not starting with a number.');
      ok = fieldError('rgMobile', MOBILE_RE.test(m) ? '' : 'Enter a valid mobile number, e.g. +2348012345678.') && ok;
      ok = fieldError('rgPass', p.length >= 8 && p.length <= 64 ? '' : 'Password must be 8\u201364 characters.') && ok;
      ok = fieldError('rgPass2', p === p2 ? '' : 'Passwords do not match.') && ok;
      if (!ok) return;
      var b = $('rgSubmit'); busy(b, true); $('rgError').hidden = true;
      api('POST', '/api/register', { username: u, mobile: m, password: p }).then(function (r) {
        busy(b, false, 'Create account');
        if (!r.ok) { $('rgError').textContent = r.error || 'Could not create the account.'; $('rgError').hidden = false; return; }
        signedIn(r);
      });
    });
    openOverlay($('authModal'));
  }
  function signedIn(r) {
    var guestCart = state.cart;   // always empty for guests; carts are account-only
    state.user = r.user; state.cart = r.cart || guestCart || [];
    updateHeader(); closeOverlay($('authModal'));
    toast('Welcome, ' + (r.user.fullName || r.user.username) + '!');
  }

  // ---------- ACCOUNT / PROFILE ----------
  function openAccount() {
    if (!state.user) { openAuth('login'); return; }
    var u = state.user, body = $('accountBody'); body.textContent = '';
    body.appendChild(el('h2', { id: 'accountTitle', text: 'My Account' }));
    var form = el('form', { id: 'profileForm', novalidate: true }, [
      el('div', { class: 'pm-field' }, [el('label', { for: 'acUser', text: 'Username' }), el('input', { id: 'acUser', class: 'pm-input', value: u.username, readonly: true })]),
      fieldRow('acName', 'Full name', { type: 'text', autocomplete: 'name', maxlength: 80, value: u.fullName }),
      fieldRow('acMobile', 'Mobile number', { type: 'tel', inputmode: 'tel', autocomplete: 'tel', value: u.mobile }),
      el('div', { class: 'pm-field' }, [el('label', { for: 'acAddr' }, ['Delivery address ', el('span', { text: '(optional)' })]),
        el('textarea', { id: 'acAddr', class: 'pm-input', rows: 2, maxlength: 240, autocomplete: 'street-address' })]),
      el('div', { class: 'pm-error', id: 'acError', role: 'alert', hidden: true }),
      el('button', { type: 'submit', class: 'btn btn-success pm-submit', id: 'acSave', text: 'Save changes' }),
      el('button', { type: 'button', class: 'btn btn-outline-secondary pm-submit', id: 'acOut', text: 'Sign out' })
    ]);
    body.appendChild(form);
    $('acAddr').value = u.address || '';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var m = $('acMobile').value.trim().replace(/[\s-]/g, '');
      if (!fieldError('acMobile', MOBILE_RE.test(m) ? '' : 'Enter a valid mobile number, e.g. +2348012345678.')) return;
      var b = $('acSave'); busy(b, true); $('acError').hidden = true;
      api('PUT', '/api/me', { fullName: $('acName').value, mobile: m, address: $('acAddr').value }).then(function (r) {
        busy(b, false, 'Save changes');
        if (!r.ok) { $('acError').textContent = r.error || 'Could not save your profile.'; $('acError').hidden = false; return; }
        state.user = r.user; updateHeader(); toast('Profile saved');
      });
    });
    $('acOut').addEventListener('click', function () {
      busy($('acOut'), true);
      saveCartNow().then(function () { return api('POST', '/api/logout', {}); }).then(function () {
        state.user = null; state.cart = []; updateHeader(); closeOverlay($('accountModal')); toast('You have signed out.');
      });
    });
    openOverlay($('accountModal'));
  }

  // ---------- INIT ----------
  function init() {
    pm = $('productModal');
    if (!pm) return;
    collect();

    var list = $('serviceList');
    if (list) list.addEventListener('click', function (e) {
      if (e.target.closest('[data-suggest]')) {
        openWhatsApp('Hello CUDMAZE,\n\nI know a service that should be listed on the marketplace:\n\n(Service name & details)\n\nThank you.'); return;
      }
      var item = e.target.closest('.list-item');
      if (item && item.dataset.productId && !e.target.closest('a')) openProduct(item.dataset.productId);
    });

    // every overlay: close button, backdrop click
    document.querySelectorAll('.pm-overlay').forEach(function (o) {
      o.addEventListener('click', function (e) { if (e.target === o || e.target.closest('[data-close]')) closeOverlay(o); });
    });
    document.addEventListener('keydown', function (e) {
      var top = stack[stack.length - 1]; if (!top) return;
      if (e.key === 'Escape') { e.stopPropagation(); closeOverlay(top); }
      else if (e.key === 'Tab') trapTab(e, top);
    }, true);

    // product modal controls
    $('pmMinus').addEventListener('click', function () { var q = $('pmQty'); q.value = Math.max(1, (parseInt(q.value, 10) || 1) - 1); });
    $('pmPlus').addEventListener('click', function () { var q = $('pmQty'); q.value = Math.min(99, (parseInt(q.value, 10) || 0) + 1); });
    $('pmBuy').addEventListener('click', function () {
      if (!current) return; var c = readProductChoices(); if (!c) return;
      openWhatsApp(singleMessage(current, c, $('pmMessage').value.trim()));
    });
    $('pmCart').addEventListener('click', function () {
      if (!current || !state.user) return; var c = readProductChoices(); if (!c) return;
      if (addToCart(current, c)) { var n = current.name; closeOverlay(pm); toast('Added ' + n + ' to your cart'); }
    });
    $('pmSignin').addEventListener('click', function () { openAuth('login'); });

    // --- marketplace navigation helpers (work on every page section) ---
    function closeAll() { while (stack.length) closeOverlay(stack[stack.length - 1]); }
    function goTab(id) { closeAll(); if (typeof openTab === 'function') openTab(null, id); window.scrollTo(0, 0); var m = document.querySelector('.content-main'); if (m) m.scrollTop = 0; }
    var shopInput = document.querySelector('#tab3 .view-search');
    function updateEmpty() {
      var box = $('shopEmpty'); if (!box || !list) return;
      var any = Array.prototype.some.call(list.querySelectorAll('.list-item'), function (n) { return n.style.display !== 'none'; });
      box.hidden = any;
    }
    if (shopInput) shopInput.addEventListener('input', function () { setTimeout(updateEmpty, 0); });
    function applyFilter(value) {
      goTab('tab3');
      if (shopInput) { shopInput.value = value || ''; shopInput.dispatchEvent(new Event('input', { bubbles: true })); }
      toast(value ? 'Showing: ' + value : 'Showing everything', 2200);
    }
    document.addEventListener('click', function (e) {
      var f = e.target.closest('[data-filter]');
      if (f) { e.preventDefault(); applyFilter(f.getAttribute('data-filter')); return; }
      var t = e.target.closest('[data-tab]');
      if (t) { e.preventDefault(); goTab(t.getAttribute('data-tab')); return; }
      var o = e.target.closest('[data-open-product]');
      if (o) { e.preventDefault(); openProduct(o.getAttribute('data-open-product')); return; }
      var w = e.target.closest('[data-wa]');
      if (w) { e.preventDefault(); openWhatsApp(w.getAttribute('data-wa')); }
    });
    document.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="button"][data-filter]')) { e.preventDefault(); e.target.click(); }
    });
    var rf = $('requestForm');
    if (rf) rf.addEventListener('submit', function (e) {
      e.preventDefault();
      var item = $('reqItem').value.trim(), budget = $('reqBudget').value.replace(/[^\d]/g, ''), notes = $('reqNotes').value.trim(), err = $('reqError');
      if (!item) { err.textContent = 'Please tell us what you are looking for.'; err.hidden = false; $('reqItem').focus(); return; }
      err.hidden = true;
      openWhatsApp(['Hello CUDMAZE,', '', 'I could not find this item on the site:', '', 'Item: ' + item]
        .concat(budget ? ['Budget: ' + money(budget)] : [], notes ? ['Details: ' + notes] : [], ['', 'Please let me know if you can source it and the price. Thank you.']).join('\n'));
    });

    // header buttons
    $('cartBtn').addEventListener('click', openCart);
    $('accountBtn').addEventListener('click', openAccount);

    // restore session + saved cart
    api('GET', '/api/me').then(function (r) {
      if (r.ok && r.user) { state.user = r.user; state.cart = r.cart || []; }
      updateHeader();
    });
    updateHeader();
    window.addEventListener('pagehide', function () { if (state.user && saveTimer) saveCartNow(); });

    function fromHash() {
      var m = location.hash.match(/^#product=([a-z0-9-]+)$/);
      if (m && products[m[1]]) { if (typeof openTab === 'function') openTab(null, 'tab3'); openProduct(m[1], true); }
    }
    window.addEventListener('hashchange', fromHash);
    setTimeout(fromHash, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.CUDMAZE = { isAuthed: function () { return !!state.user; } };
})();
