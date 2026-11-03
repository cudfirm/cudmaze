/**
 * ==============================================
 * --- MASTER SCRIPT FOR CUDMAZE ---
 * ==============================================
 */

// =============================================
// GLOBAL STATE
// =============================================
let originalSectionsInOrder = [];
let activeTabIdBeforeSearch = null;

const ALL_TAB_IDS = [
    'blog-content', 'explore-content', 'tab1', 'forum-content', 'connect-content',
    'tab2','tab3','tab4','tab5','tab6','tab7','tab8','tab9','tab10','tab11','tab12'
];
let currentTabIndex = 2;

const TAB_NAMES = {
    "tab1": "Home",
    "tab2": "Categories",
    "tab3": "Shop",
    "tab4": "Deals",
    "tab5": "Sellers",
    "tab6": "Lagos Markets",
    "tab7": "Market Days",
    "tab8": "How It Works",
    "tab9": "Delivery & Help",
    "tab10": "Request an Item",
    "tab11": "Sell With Us",
    "tab12": "About & Reviews",
    "blog-content": "Today",
    "explore-content": "Stores",
    "forum-content": "Offers",
    "connect-content": "Contact"
};

let breadcrumbHistory = [];

// =============================================
// 1. CORE TAB SWITCHING
// =============================================
function openTab(event, tabId) {
    const appContainer = document.querySelector('.app-container');
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    if (event && searchInput && searchInput.value) {
        searchInput.value = '';
        if (clearSearchBtn) clearSearchBtn.style.display = 'none';
        filterContent('');
    }

    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });
    document.querySelectorAll('.tab-button, .nav-item').forEach(el => el.classList.remove('active'));

    const isSidebarTab = tabId.startsWith('tab') && !tabId.includes('-content');

    if (isSidebarTab) {
        appContainer.classList.remove('sidebar-hidden');
    } else {
        appContainer.classList.add('sidebar-hidden');
    }

    const targetContent = document.getElementById(tabId);
    if (targetContent) {
        targetContent.classList.add('active');
        targetContent.style.display = 'block';
        if (targetContent.classList.contains('view')) {
            animateView(targetContent);
        }
    }

    if (isSidebarTab) {
        const sidebarButton = document.querySelector(`.tab-button[onclick*="'${tabId}'"]`);
        if (sidebarButton) sidebarButton.classList.add('active');
        if (tabId === 'tab1') {
            const homeFooterButton = document.querySelector('.nav-item[onclick*="tab1"]');
            if (homeFooterButton) homeFooterButton.classList.add('active');
        }
    } else {
        const footerButton = document.querySelector(`.nav-item[onclick*="'${tabId}'"]`);
        if (footerButton) footerButton.classList.add('active');
    }

    const activeNavItem = document.querySelector('.nav-item.active');
    if (activeNavItem) {
        const activeIndex = activeNavItem.dataset.index;
        const footerNav = document.querySelector('.footer-nav');
        if (footerNav) footerNav.style.setProperty('--active-index', activeIndex);
    }

    const idx = ALL_TAB_IDS.indexOf(tabId);
    if (idx !== -1) currentTabIndex = idx;

    try { localStorage.setItem('cudfirm_last_tab', tabId); } catch(e) {}

    updateBreadcrumb(tabId);

    const contentMain = document.querySelector('.content-main');
    if (contentMain) contentMain.scrollTop = 0;
}

// =============================================
// 2. GSAP ANIMATION
// =============================================
function animateView(viewElement) {
    if (typeof gsap === 'undefined') return;
    gsap.fromTo(viewElement,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', clearProps: 'opacity,transform' }
    );
    const items = viewElement.querySelectorAll('.card, .list-item');
    if (items.length) {
        gsap.from(items, { opacity: 0, duration: 0.35, stagger: { amount: 0.3 }, ease: 'power2.out', delay: 0.05, clearProps: 'opacity,transform' });
    }
}

// =============================================
// 3. VIEW-SPECIFIC SEARCH
// =============================================
function handleViewSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const targetListSelector = e.target.dataset.targetList;
    if (!targetListSelector) return;
    const listContainer = document.querySelector(targetListSelector);
    if (!listContainer) return;
    listContainer.querySelectorAll('.card, .list-item').forEach(item => {
        const text = item.dataset.searchText || item.textContent;
        item.style.display = text.toLowerCase().includes(searchTerm) ? '' : 'none';
    });
}

// =============================================
// 4. MODAL
// =============================================
function openModal(title, content) {
    const modal = document.getElementById('modal');
    if (!modal) return;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = content;
    modal.classList.add('visible');
    if (typeof gsap !== 'undefined') gsap.from('.modal-content', { scale: 0.9, opacity: 0, duration: 0.3, ease: 'power2.out' });
}

function closeModal() {
    const modal = document.getElementById('modal');
    if (!modal) return;
    if (typeof gsap !== 'undefined') {
        gsap.to('.modal-content', { scale: 0.9, opacity: 0, duration: 0.2, ease: 'power2.in', onComplete: () => modal.classList.remove('visible') });
    } else {
        modal.classList.remove('visible');
    }
}

// =================================
// SEND TO ADMIN (Google Sheets + redirect)
// =================================
function sendToAdmin() {
    const name = document.getElementById('contactName').value.trim();
    const contactInfo = document.getElementById('contactInfo').value.trim();
    const message = document.getElementById('contactMessage').value.trim();

    if (!name || !contactInfo || !message) {
        openModal('Input Required', '<p>Please fill in all fields before submitting.</p>');
        return;
    }

    submitToGoogleSheets(name, contactInfo, message);

    setTimeout(function () {
        window.location.href = 'success.html';
    }, 1000);
}

// =============================================
// SEND TO WHATSAPP (with form content pre-filled)
// =============================================
function sendToWhatsAppWithForm() {
    const yourNumber = '2348028699824';
    const name = document.getElementById('contactName').value.trim();
    const contactInfo = document.getElementById('contactInfo').value.trim();
    const message = document.getElementById('contactMessage').value.trim();

    if (!name || !contactInfo || !message) {
        openModal('Input Required', '<p>Please fill in all fields before sending.</p>');
        return;
    }

    const text = `Hello CUDMAZE,\nMy Name: ${name}\nMy Contact: ${contactInfo}\n\nMy Request:\n${message}`;
    window.open(`https://wa.me/${yourNumber}?text=${encodeURIComponent(text)}`, '_blank');
}

// =============================================
// SEND TO EMAIL (opens email client with body)
// =============================================
function sendToEmail() {
    const name = document.getElementById('contactName').value.trim();
    const contactInfo = document.getElementById('contactInfo').value.trim();
    const message = document.getElementById('contactMessage').value.trim();

    if (!name || !contactInfo || !message) {
        openModal('Input Required', '<p>Please fill in all fields before sending.</p>');
        return;
    }

    const subject = encodeURIComponent('New Message - CUDMAZE');
    const body = encodeURIComponent(
        `Name: ${name}\nContact Info: ${contactInfo}\n\nMessage:\n${message}`
    );
    window.location.href = `mailto:cudfirm@gmail.com?subject=${subject}&body=${body}`;
}

// =============================================
// GOOGLE SHEETS SUBMISSION
// =============================================
function submitToGoogleSheets(name, contactInfo, message) {
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxQGJLYV8bR1HeXJJfBPx1boRR-jcW4prS2hojJfxasiDtl6eqfUxYnJEsL1tO52CbM/exec';

    const formData = new FormData();
    formData.append('name', name);
    formData.append('contact_info', contactInfo);
    formData.append('message', message);
    formData.append('timestamp', new Date().toISOString());

    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: formData
    }).catch(function (err) {
        console.warn('Google Sheets submission failed:', err);
    });
}

// ==============================
// 6. GLOBAL SEARCH
// ===============================
function unhighlight(container) {
    container.querySelectorAll('mark.highlight').forEach(mark => {
        mark.parentNode.replaceChild(document.createTextNode(mark.textContent), mark);
    });
    container.normalize();
}

function highlightText(node, term) {
    if (!term.trim()) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null, false);
    let textNode;
    const replacements = [];
    const lower = term.toLowerCase();
    while (textNode = walker.nextNode()) {
        const tag = textNode.parentElement.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE') continue;
        const lowerVal = textNode.nodeValue.toLowerCase();
        if (!lowerVal.includes(lower)) continue;
        const frag = document.createDocumentFragment();
        let last = 0, start = 0;
        while ((start = lowerVal.indexOf(lower, last)) > -1) {
            frag.appendChild(document.createTextNode(textNode.nodeValue.substring(last, start)));
            const mark = document.createElement('mark');
            mark.className = 'highlight';
            mark.textContent = textNode.nodeValue.substring(start, start + term.length);
            frag.appendChild(mark);
            last = start + term.length;
        }
        frag.appendChild(document.createTextNode(textNode.nodeValue.substring(last)));
        replacements.push({ original: textNode, replacement: frag });
    }
    replacements.forEach(r => { if (r.original.parentNode) r.original.parentNode.replaceChild(r.replacement, r.original); });
}

function filterContent(term) {
    const lowerTerm = term.toLowerCase();
    const contentMain = document.querySelector('.content-main');
    contentMain.style.opacity = '0';
    setTimeout(() => {
        unhighlight(contentMain);
        const existing = contentMain.querySelector('.no-results-message');
        if (existing) existing.remove();
        if (!lowerTerm) {
            originalSectionsInOrder.forEach(s => s.style.display = 'none');
            const restore = activeTabIdBeforeSearch || 'tab1';
            openTab(null, restore);
            activeTabIdBeforeSearch = null;
        } else {
            if (activeTabIdBeforeSearch === null) {
                const active = document.querySelector('.tab-content.active');
                activeTabIdBeforeSearch = active ? active.id : 'tab1';
            }
            document.querySelectorAll('.tab-content, .tab-button, .nav-item').forEach(el => {
                el.classList.remove('active');
                if (el.matches('.tab-content')) el.style.display = 'none';
            });
            let found = 0;
            originalSectionsInOrder.forEach(s => {
                if (s.textContent.toLowerCase().includes(lowerTerm)) {
                    highlightText(s, term);
                    s.style.display = 'block';
                    found++;
                } else {
                    s.style.display = 'none';
                }
            });
            if (found === 0) {
                const msg = document.createElement('div');
                msg.className = 'no-results-message';
                msg.innerHTML = `No results found for '<strong>${term.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</strong>'`;
                contentMain.appendChild(msg);
            }
        }
        contentMain.style.opacity = '1';
    }, 300);
}

// =============================================
// 7. COURSE ICONS
// =============================================
function populateCourseIcons() {
    const iconData = {
        'classic-regular-icons-container': [
            {
                        "name": "Phones & Accessories",
                        "icon": "fa-mobile-screen",
                        "badge": "HOT"
            },
            {
                        "name": "Fashion & Fabrics",
                        "icon": "fa-shirt",
                        "badge": ""
            },
            {
                        "name": "Foodstuff & Groceries",
                        "icon": "fa-basket-shopping",
                        "badge": "NEW"
            },
            {
                        "name": "Beauty & Hair",
                        "icon": "fa-spa",
                        "badge": ""
            },
            {
                        "name": "Home & Kitchen",
                        "icon": "fa-kitchen-set",
                        "badge": ""
            },
            {
                        "name": "Electronics & Gadgets",
                        "icon": "fa-tv",
                        "badge": "-15%"
            },
            {
                        "name": "Solar & Power",
                        "icon": "fa-solar-panel",
                        "badge": "HOT"
            },
            {
                        "name": "Health & Pharmacy",
                        "icon": "fa-pills",
                        "badge": ""
            },
            {
                        "name": "Baby & Kids",
                        "icon": "fa-baby",
                        "badge": ""
            },
            {
                        "name": "Auto Parts & Care",
                        "icon": "fa-car",
                        "badge": ""
            },
            {
                        "name": "Building & Hardware",
                        "icon": "fa-hammer",
                        "badge": ""
            },
            {
                        "name": "Services",
                        "icon": "fa-screwdriver-wrench",
                        "badge": "NEW"
            }
],
        'classic-light-icons-container': [
            {
                        "name": "Laundry",
                        "icon": "fa-soap",
                        "filter": "laundry",
                        "badge": ""
            },
            {
                        "name": "Tailoring",
                        "icon": "fa-scissors",
                        "filter": "tailoring",
                        "badge": ""
            },
            {
                        "name": "Phone Repair",
                        "icon": "fa-wrench",
                        "filter": "repair",
                        "badge": ""
            },
            {
                        "name": "Dispatch",
                        "icon": "fa-motorcycle",
                        "filter": "dispatch",
                        "badge": ""
            },
            {
                        "name": "Home Hair",
                        "icon": "fa-spa",
                        "filter": "braiding",
                        "badge": ""
            },
            {
                        "name": "Event Decor",
                        "icon": "fa-champagne-glasses",
                        "filter": "decoration",
                        "badge": ""
            },
            {
                        "name": "AC Service",
                        "icon": "fa-snowflake",
                        "filter": "servicing",
                        "badge": ""
            },
            {
                        "name": "Generator Fix",
                        "icon": "fa-gears",
                        "filter": "generator",
                        "badge": ""
            },
            {
                        "name": "Cleaning",
                        "icon": "fa-broom",
                        "filter": "cleaning",
                        "badge": ""
            },
            {
                        "name": "Photography",
                        "icon": "fa-camera",
                        "filter": "photography",
                        "badge": ""
            },
            {
                        "name": "Plumbing",
                        "icon": "fa-faucet",
                        "filter": "plumbing",
                        "badge": ""
            },
            {
                        "name": "Electrician",
                        "icon": "fa-bolt",
                        "filter": "electrician",
                        "badge": ""
            }
]
    };
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    for (const containerId in iconData) {
        const container = document.getElementById(containerId);
        if (!container) continue;
        let html = '';
        iconData[containerId].forEach(item => {
            html += `<div class="col"><a href="#" class="icon-item-explore" data-filter="${esc(item.filter || item.name)}">
                <i class="fa-solid ${item.icon}" aria-hidden="true"></i>
                <span class="flex-grow-1">${item.name}</span>
                ${item.badge ? '<div class="free-badge">' + item.badge + '</div>' : ''}
            </a></div>`;
        });
        if (containerId === 'classic-regular-icons-container') {
            html += `<div class="col"><a href="#" class="view-more-btn" data-filter="">
                <span>All items</span><i class="fa-solid fa-arrow-right ms-2" aria-hidden="true"></i>
            </a></div>`;
        }
        container.innerHTML = html;
    }
}

// =============================================
// 8. DARK MODE
// =============================================
function initDarkMode() {
    const toggle = document.getElementById('darkModeToggle');
    const icon = document.getElementById('darkModeIcon');
    const html = document.documentElement;
    try {
        if (localStorage.getItem('cudfirm_theme') === 'dark') {
            html.setAttribute('data-theme', 'dark');
            if (icon) icon.className = 'bi bi-sun-fill';
        }
    } catch(e) {}
    if (!toggle) return;
    toggle.addEventListener('click', () => {
        const isDark = html.getAttribute('data-theme') === 'dark';
        html.setAttribute('data-theme', isDark ? 'light' : 'dark');
        if (icon) icon.className = isDark ? 'bi bi-moon-fill' : 'bi bi-sun-fill';
        try { localStorage.setItem('cudfirm_theme', isDark ? 'light' : 'dark'); } catch(e) {}
        showToast(isDark ? 'Light mode on ☀️' : 'Dark mode on 🌙');
    });
}

// =============================================
// 9. TOAST
// =============================================
let toastTimer = null;
function showToast(message, duration) {
    duration = duration || 2500;
    const toast = document.getElementById('toastNotification');
    const msg = document.getElementById('toastMessage');
    if (!toast || !msg) return;
    msg.textContent = message;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

// =============================================
// 10. COPY TO CLIPBOARD
// =============================================
function copyToClipboard(text, successMessage) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => showToast(successMessage || 'Copied! ✓')).catch(() => showToast('Could not copy.'));
    } else {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); showToast(successMessage || 'Copied! ✓'); } catch(e) { showToast('Could not copy.'); }
        document.body.removeChild(ta);
    }
}

// =============================================
// 11. READING PROGRESS BAR
// =============================================
function initReadingProgressBar() {
    const bar = document.getElementById('readingProgressBar');
    const contentMain = document.querySelector('.content-main');
    if (!bar || !contentMain) return;
    contentMain.addEventListener('scroll', () => {
        const h = contentMain.scrollHeight - contentMain.clientHeight;
        bar.style.width = (h > 0 ? (contentMain.scrollTop / h) * 100 : 0) + '%';
    }, { passive: true });
}

// =============================================
// 12. BACK TO TOP
// =============================================
function initBackToTop() {
    const btn = document.getElementById('backToTopBtn');
    const contentMain = document.querySelector('.content-main');
    if (!btn || !contentMain) return;
    contentMain.addEventListener('scroll', () => btn.classList.toggle('visible', contentMain.scrollTop > 200), { passive: true });
    btn.addEventListener('click', () => contentMain.scrollTo({ top: 0, behavior: 'smooth' }));
}

// =============================================
// 13. BREADCRUMB
// =============================================
function updateBreadcrumb(tabId) {
    const name = TAB_NAMES[tabId] || tabId;
    if (breadcrumbHistory[breadcrumbHistory.length - 1] === name) return;
    breadcrumbHistory.push(name);
    if (breadcrumbHistory.length > 3) breadcrumbHistory.shift();
    const trail = document.getElementById('breadcrumbTrail');
    if (!trail) return;
    trail.innerHTML = breadcrumbHistory.map((item, i) => {
        const isCurrent = i === breadcrumbHistory.length - 1;
        return `<span class="bc-item${isCurrent ? ' bc-current' : ''}">${item}</span>${isCurrent ? '' : '<span class="bc-sep">›</span>'}`;
    }).join('');
}

// =============================================
// 14. LIVE USER COUNT
// =============================================
function initLiveUserCount() {
    const blogCount = document.getElementById('liveUserCount');
    const sidebarCount = document.getElementById('sidebarLiveCount');
    function update() {
        const count = Math.max(5, 12 + Math.floor(new Date().getHours() * 0.6) + Math.floor(Math.random() * 7) - 3);
        if (blogCount) blogCount.textContent = count + ' Online';
        if (sidebarCount) sidebarCount.textContent = count;
    }
    update();
    setInterval(update, 45000);
}

// =============================================
// 15. KEYBOARD SHORTCUTS
// =============================================
function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return;
        switch(e.key) {
            case 'ArrowRight': case 'ArrowDown':
                e.preventDefault();
                openTab(null, ALL_TAB_IDS[Math.min(ALL_TAB_IDS.length - 1, currentTabIndex + 1)]);
                break;
            case 'ArrowLeft': case 'ArrowUp':
                e.preventDefault();
                openTab(null, ALL_TAB_IDS[Math.max(0, currentTabIndex - 1)]);
                break;
            case 'Escape':
                e.preventDefault();
                openTab(null, 'tab1');
                showToast('Returned to Home');
                break;
            case '/':
                e.preventDefault();
                var si = document.getElementById('searchInput');
                if (si) { si.classList.add('active'); si.focus(); }
                break;
            case '?':
                openModal('Keyboard Shortcuts ⌨️', `
                    <ul style="line-height:2;font-size:0.9rem;padding-left:1rem;">
                        <li><strong>→ / ↓</strong> — Next tab</li>
                        <li><strong>← / ↑</strong> — Previous tab</li>
                        <li><strong>Esc</strong> — Go to Home</li>
                        <li><strong>/</strong> — Open search</li>
                        <li><strong>?</strong> — This help menu</li>
                    </ul>`);
                break;
        }
    });
}

// =============================================
// =============================================
// 16. SWIPE GESTURES
// =============================================
function initSwipeNavigation() {
    const contentMain = document.querySelector('.content-main');
    if (!contentMain) return;
    var startX = 0, startY = 0, swipeLocked = false;

    function isInsideHScrollable(el, dx) {
        while (el && el !== contentMain) {
            var style = window.getComputedStyle(el);
            var overflowX = style.overflowX;
            var canScrollH = (overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth;
            if (canScrollH) {
                var atLeft  = el.scrollLeft <= 0;
                var atRight = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
                if ((dx < 0 && !atRight) || (dx > 0 && !atLeft)) return true;
            }
            el = el.parentElement;
        }
        return false;
    }

    contentMain.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        swipeLocked = false;
    }, { passive: true });

    contentMain.addEventListener('touchmove', function(e) {
        if (swipeLocked) return;
        var dx = e.touches[0].clientX - startX;
        var dy = e.touches[0].clientY - startY;
        if (Math.abs(dx) > Math.abs(dy) && isInsideHScrollable(e.target, dx)) {
            swipeLocked = true;
        }
    }, { passive: true });

    contentMain.addEventListener('touchend', function(e) {
        if (swipeLocked) return;
        var dx = e.changedTouches[0].clientX - startX;
        var dy = e.changedTouches[0].clientY - startY;
        if (Math.abs(dx) > 60 && Math.abs(dy) < 80) {
            if (isInsideHScrollable(e.target, dx)) return;
            var next = dx < 0 ? Math.min(ALL_TAB_IDS.length - 1, currentTabIndex + 1) : Math.max(0, currentTabIndex - 1);
            openTab(null, ALL_TAB_IDS[next]);
        }
    }, { passive: true });
}

// =============================================
// 17. SIDEBAR TAB FILTER
// =============================================
function initSidebarTabFilter() {
    var filterInput = document.getElementById('sidebarTabSearch');
    if (!filterInput) return;
    filterInput.addEventListener('input', function() {
        var term = this.value.toLowerCase().trim();
        document.querySelectorAll('.sidebar-tabs .tab-button').forEach(function(btn) {
            var name = (btn.getAttribute('data-tab-name') || btn.textContent).toLowerCase();
            btn.style.display = (!term || name.includes(term)) ? '' : 'none';
        });
    });
}

// =============================================
// 18. SERVICE FINDER
// =============================================
function initServiceFinder() {
    var serviceGrid = document.getElementById('service-grid');
    if (!serviceGrid) return;
    var serviceData = [
        {
                "title": "Ikeja Gadget Hub",
                "isRegistered": true,
                "description": "Computer Village, Ikeja. Phones, laptops, accessories & repairs.",
                "image": "img/stores/ikeja-gadget-hub-wide.webp",
                "wa": "https://wa.me/2348028699824?text=Hello%20CUDMAZE%2C%20I%20would%20like%20to%20ask%20about%20items%20from%20Ikeja%20Gadget%20Hub."
        },
        {
                "title": "Balogun Fabric House",
                "isRegistered": true,
                "description": "Balogun Market, Lagos Island. Ankara, adire, lace & ready-to-wear.",
                "image": "img/stores/balogun-fabric-house-wide.webp",
                "wa": "https://wa.me/2348028699824?text=Hello%20CUDMAZE%2C%20I%20would%20like%20to%20ask%20about%20items%20from%20Balogun%20Fabric%20House."
        },
        {
                "title": "Mile 12 Fresh Basket",
                "isRegistered": true,
                "description": "Mile 12 Market, Kosofe. Fresh tomatoes, pepper, fish & vegetables.",
                "image": "img/stores/mile12-fresh-basket-wide.webp",
                "wa": "https://wa.me/2348028699824?text=Hello%20CUDMAZE%2C%20I%20would%20like%20to%20ask%20about%20items%20from%20Mile%2012%20Fresh%20Basket."
        },
        {
                "title": "Oyingbo Grains & Oils",
                "isRegistered": true,
                "description": "Oyingbo Market, Yaba. Rice, beans, garri, oils & spices.",
                "image": "img/stores/oyingbo-grains-and-oils-wide.webp",
                "wa": "https://wa.me/2348028699824?text=Hello%20CUDMAZE%2C%20I%20would%20like%20to%20ask%20about%20items%20from%20Oyingbo%20Grains%20%26%20Oils."
        },
        {
                "title": "Surulere Solar Depot",
                "isRegistered": true,
                "description": "Adeniran Ogunsanya, Surulere. Solar kits, inverters, batteries & lighting.",
                "image": "img/stores/surulere-solar-depot-wide.webp",
                "wa": "https://wa.me/2348028699824?text=Hello%20CUDMAZE%2C%20I%20would%20like%20to%20ask%20about%20items%20from%20Surulere%20Solar%20Depot."
        },
        {
                "title": "Lekki Glow Beauty",
                "isRegistered": true,
                "description": "Lekki Phase 1. Hair, skincare, fragrances & wigs.",
                "image": "img/stores/lekki-glow-beauty-wide.webp",
                "wa": "https://wa.me/2348028699824?text=Hello%20CUDMAZE%2C%20I%20would%20like%20to%20ask%20about%20items%20from%20Lekki%20Glow%20Beauty."
        },
        {
                "title": "Yaba Home Essentials",
                "isRegistered": true,
                "description": "Tejuosho Market, Yaba. Kitchenware, bedding & small appliances.",
                "image": "img/stores/yaba-home-essentials-wide.webp",
                "wa": "https://wa.me/2348028699824?text=Hello%20CUDMAZE%2C%20I%20would%20like%20to%20ask%20about%20items%20from%20Yaba%20Home%20Essentials."
        },
        {
                "title": "Alaba Direct Electronics",
                "isRegistered": true,
                "description": "Alaba International Market, Ojo. TVs, fans, speakers & home electronics.",
                "image": "img/stores/alaba-direct-electronics-wide.webp",
                "wa": "https://wa.me/2348028699824?text=Hello%20CUDMAZE%2C%20I%20would%20like%20to%20ask%20about%20items%20from%20Alaba%20Direct%20Electronics."
        },
        {
                "title": "Ikota Kids & Baby",
                "isRegistered": true,
                "description": "Ikota, Lekki. Diapers, school bags, toys & baby care.",
                "image": "img/stores/ikota-kids-and-baby-wide.webp",
                "wa": "https://wa.me/2348028699824?text=Hello%20CUDMAZE%2C%20I%20would%20like%20to%20ask%20about%20items%20from%20Ikota%20Kids%20%26%20Baby."
        },
        {
                "title": "Ladipo Auto Spares",
                "isRegistered": true,
                "description": "Ladipo Market, Mushin. Engine oil, spare parts & car accessories.",
                "image": "img/stores/ladipo-auto-spares-wide.webp",
                "wa": "https://wa.me/2348028699824?text=Hello%20CUDMAZE%2C%20I%20would%20like%20to%20ask%20about%20items%20from%20Ladipo%20Auto%20Spares."
        },
        {
                "title": "Maryland Care Pharmacy",
                "isRegistered": true,
                "description": "Maryland, Ikeja. Health devices & over-the-counter wellness.",
                "image": "img/stores/maryland-care-pharmacy-wide.webp",
                "wa": "https://wa.me/2348028699824?text=Hello%20CUDMAZE%2C%20I%20would%20like%20to%20ask%20about%20items%20from%20Maryland%20Care%20Pharmacy."
        },
        {
                "title": "CUDMAZE Express",
                "isRegistered": true,
                "description": "All of Lagos. Dispatch riders, laundry pickup & home services.",
                "image": "img/stores/cudmaze-express-wide.webp",
                "wa": "https://wa.me/2348028699824?text=Hello%20CUDMAZE%2C%20I%20would%20like%20to%20ask%20about%20items%20from%20CUDMAZE%20Express."
        },
        {
                "title": "Lagos Home Pros",
                "isRegistered": true,
                "description": "Island & Mainland. AC, generator, plumbing, electrical & cleaning.",
                "image": "img/stores/lagos-home-pros-wide.webp",
                "wa": "https://wa.me/2348028699824?text=Hello%20CUDMAZE%2C%20I%20would%20like%20to%20ask%20about%20items%20from%20Lagos%20Home%20Pros."
        }
];
    var serviceSearchInput = document.getElementById('serviceSearchInput');
    var clearServiceSearchBtn = document.getElementById('clearServiceSearchBtn');

    function renderCards(filter) {
        filter = filter || '';
        serviceGrid.innerHTML = '';
        var lower = filter.toLowerCase();
        var filtered = serviceData.filter(function(i) {
            return i.title.toLowerCase().includes(lower) || i.description.toLowerCase().includes(lower);
        });
        if (!filtered.length) { serviceGrid.innerHTML = '<p class="text-secondary col-12">No stores found.</p>'; return; }
        filtered.forEach(function(item) {
            var col = document.createElement('div');
            col.className = 'col service-card-wrapper';
            var badge = item.isRegistered ? '<span class="position-absolute top-0 end-0 m-2 badge rounded-pill bg-danger z-3">®</span>' : '';
            var desc = item.description;
            if (filter) {
                var re = new RegExp('(' + filter.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')', 'gi');
                desc = desc.replace(re, '<mark>$1</mark>');
            }
            col.innerHTML = '<div class="card service-card shadow-sm rounded-3 p-0 m-1 overflow-hidden">' +
                '<div class="position-relative">' +
                '<img src="' + item.image + '" alt="' + item.title + '" class="card-img-top" width="400" height="200" loading="lazy" decoding="async">' +
                badge +
                '<div class="card-title-diagonal">' + item.title + '</div>' +
                '</div>' +
                '<div class="card-body">' +
                '<p class="card-text mb-3">' + desc + '</p>' +
                '<div class="card-footer d-flex justify-content-between align-items-center">' +
                '<a href="' + item.wa + '" target="_blank" rel="noopener" class="text-secondary text-decoration-none" aria-label="Message ' + item.title + ' on WhatsApp"><i class="fab fa-whatsapp"></i> Chat</a>' +
                '<a href="#" data-filter="' + item.title + '" class="fw-semibold small text-decoration-none">Visit Store &rarr;</a>' +
                '</div></div></div>';
            serviceGrid.appendChild(col);
        });
    }

    if (serviceSearchInput) {
        serviceSearchInput.addEventListener('input', function(e) {
            renderCards(e.target.value);
            if (clearServiceSearchBtn) clearServiceSearchBtn.classList.toggle('d-none', !e.target.value);
        });
    }
    if (clearServiceSearchBtn) {
        clearServiceSearchBtn.addEventListener('click', function() {
            if (serviceSearchInput) serviceSearchInput.value = '';
            renderCards();
            this.classList.add('d-none');
            if (serviceSearchInput) serviceSearchInput.focus();
        });
    }

    var disclaimerBtn = document.getElementById('disclaimer-toggle-btn');
    var disclaimerModalEl = document.getElementById('disclaimer-modal');
    if (disclaimerBtn && disclaimerModalEl && typeof bootstrap !== 'undefined') {
        var disclaimerModal = new bootstrap.Modal(disclaimerModalEl);
        disclaimerBtn.addEventListener('click', function() { disclaimerModal.show(); });
    }

    renderCards();
}

// =============================================
// PWA INSTALL
// =============================================
var deferredPrompt = null;
var installBtn = document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.style.display = 'inline-flex';
});
if (installBtn) {
    installBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(function() { deferredPrompt = null; installBtn.style.display = 'none'; });
        }
    });
}

// =============================================
// LIGHTBOX — FIXED: opens in new tab, hides
// Enter button when no real link is set
// =============================================
function openLightbox(src, caption, link) {
    var lb = document.getElementById('imageLightbox');
    if (!lb) return;

    document.getElementById('lightboxImg').src = src;
    document.getElementById('lightboxCaption').textContent = caption;

    var enterBtn = document.getElementById('lightboxEnterBtn');
    // Only show Enter button if a real URL is provided
    var hasRealLink = link && link !== '#' && link.trim() !== '';
    if (hasRealLink) {
        enterBtn.href = link;
        enterBtn.target = '_self';
        enterBtn.rel = '';
   //   enterBtn.rel = 'noopener noreferrer';
        enterBtn.style.display = 'inline-block';
    } else {
        enterBtn.href = '#';
        enterBtn.style.display = 'none';
    }

    lb.style.display = 'flex';
    if (typeof gsap !== 'undefined') {
        gsap.fromTo('.lightbox-content-wrapper', { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4 });
    }
}
function closeLightbox() {
    var lb = document.getElementById('imageLightbox');
    if (!lb) return;
    if (typeof gsap !== 'undefined') {
        gsap.to('.lightbox-content-wrapper', { scale: 0.7, opacity: 0, duration: 0.2, onComplete: function() { lb.style.display = 'none'; } });
    } else { lb.style.display = 'none'; }
}
function closeLightboxOutside(e) {
    if (e.target.id === 'imageLightbox') closeLightbox();
}

// =============================================
// DOM READY — ONE LISTENER
// =============================================
document.addEventListener('DOMContentLoaded', function () {

    // STEP 1: Always open Home first so page is never blank
    var homeBtn = document.querySelector('.nav-item[onclick*="tab1"]');
    if (homeBtn) {
        homeBtn.click();
    } else {
        openTab(null, 'tab1');
    }

    // Restore last visited tab after Home renders
    try {
        var saved = localStorage.getItem('cudfirm_last_tab');
        if (saved && saved !== 'tab1' && document.getElementById(saved)) {
            setTimeout(function() { openTab(null, saved); }, 50);
        }
    } catch(e) {}

    // STEP 2: Store sections for global search
    var contentMain = document.querySelector('.content-main');
    if (contentMain) {
        originalSectionsInOrder = Array.from(contentMain.children).filter(function(n) { return n.tagName === 'SECTION'; });
    }

    // STEP 3: Populate dynamic content
    populateCourseIcons();

    // STEP 4: Global Search
    var searchIcon = document.getElementById('searchIcon');
    var searchInput = document.getElementById('searchInput');
    var searchContainer = document.getElementById('searchContainer');
    var clearSearchBtn = document.getElementById('clearSearchBtn');

    if (searchIcon && searchInput) {
        searchIcon.addEventListener('click', function(e) {
            e.stopPropagation();
            searchInput.classList.toggle('active');
            if (searchInput.classList.contains('active')) { searchInput.focus(); }
            else if (searchInput.value && clearSearchBtn) { clearSearchBtn.click(); }
        });
    }
    if (clearSearchBtn && searchInput) {
        clearSearchBtn.addEventListener('click', function() {
            searchInput.value = '';
            this.style.display = 'none';
            filterContent('');
            searchInput.focus();
        });
    }
    if (searchInput && clearSearchBtn) {
        searchInput.addEventListener('input', function() {
            clearSearchBtn.style.display = this.value ? 'block' : 'none';
            filterContent(this.value);
        });
    }
    if (searchContainer && searchInput) {
        document.addEventListener('click', function(e) {
            if (!searchContainer.contains(e.target) && searchInput.classList.contains('active')) {
                searchInput.classList.remove('active');
            }
        });
    }

    // STEP 5: View-specific search
    document.querySelectorAll('.view-search').forEach(function(input) {
        input.addEventListener('input', handleViewSearch);
    });

    // STEP 6: Modal close
    var modal = document.getElementById('modal');
    var modalCloseBtn = document.querySelector('.modal-close');
    if (modal && modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', function(e) { if (e.target === modal) closeModal(); });
    }

    // STEP 7: Lightbox on Home images
    document.querySelectorAll('#tab1 .grid-item:not([data-filter]) img').forEach(function(img) {
        img.addEventListener('click', function() {
            openLightbox(this.src, this.alt || 'View Item', this.getAttribute('data-link') || '#');
        });
    });

    // STEP 8: All new features
    initDarkMode();
    initReadingProgressBar();
    initBackToTop();
    initLiveUserCount();
    initKeyboardShortcuts();
    /* swipe-to-switch-tabs removed */
    initSidebarTabFilter();
    initServiceFinder();

    // STEP 9: First-visit hint toast
    try {
        if (!localStorage.getItem('cudfirm_hint_shown')) {
            setTimeout(function() {
                if (!window.matchMedia('(pointer: coarse)').matches) showToast('Tip: Press ? for keyboard shortcuts ⌨️', 4000);
                localStorage.setItem('cudfirm_hint_shown', '1');
            }, 3000);
        }
    } catch(e) {}

});

