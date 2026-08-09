/* ============================================
   CampusMall - 公共逻辑（导航栏、登录状态、登出）
   ============================================ */

/**
 * 检查是否已登录
 */
function isLoggedIn() {
    return !!Token.get();
}

/**
 * 要求登录，未登录则跳转
 */
function requireLogin() {
    if (!isLoggedIn()) {
        Toast.warning('请先登录');
        setTimeout(() => {
            location.href = 'login.html';
        }, 800);
        return false;
    }
    return true;
}

/**
 * 渲染顶部导航栏
 */
function renderNavbar() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    const user = UserInfo.get();
    const searchValue = Utils.getParam('keyword') || '';

    let userSection = '';
    if (isLoggedIn() && user) {
        userSection = `
            <a href="user-center.html" title="个人中心">
                👤 <span class="nav-text">${user.nickname || user.username}</span>
            </a>
            <button onclick="doLogout()" title="退出登录">🚪 <span class="nav-text">退出</span></button>
        `;
    } else {
        userSection = `
            <a href="login.html">登录</a>
        `;
    }

    navbar.innerHTML = `
        <div class="navbar">
            <div class="container">
                <a href="index.html" class="navbar-logo">
                    🛒 <span>CampusMall</span>
                </a>
                <div class="navbar-search">
                    <input type="text" id="searchInput" placeholder="搜索商品..."
                           value="${searchValue}" onkeydown="if(event.key==='Enter')doSearch()">
                    <button onclick="doSearch()">🔍</button>
                </div>
                <div class="navbar-nav">
                    <a href="cart.html" title="购物车">
                        🛍️ <span class="nav-text">购物车</span>
                        <span class="cart-badge" id="cartBadge" style="display:none">0</span>
                    </a>
                    <a href="order-list.html" title="我的订单">📦 <span class="nav-text">我的订单</span></a>
                    <a href="coupon.html" title="领券中心">🎫 <span class="nav-text">领券</span></a>
                    ${userSection}
                </div>
            </div>
        </div>
    `;

    // 加载购物车数量
    if (isLoggedIn()) {
        updateCartBadge();
    }
}

/**
 * 更新购物车角标
 */
async function updateCartBadge() {
    try {
        const list = await API.get('/cart/list');
        const badge = document.getElementById('cartBadge');
        if (!badge) return;
        const count = Array.isArray(list) ? list.length : 0;
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    } catch (e) {
        // 静默失败
    }
}

/**
 * 搜索跳转
 */
function doSearch() {
    const keyword = document.getElementById('searchInput')?.value?.trim() || '';
    if (keyword) {
        location.href = `index.html?keyword=${encodeURIComponent(keyword)}`;
    } else {
        location.href = 'index.html';
    }
}

/**
 * 退出登录
 */
function doLogout() {
    Token.remove();
    UserInfo.remove();
    Toast.success('已退出登录');
    setTimeout(() => {
        location.href = 'index.html';
    }, 500);
}

/**
 * 渲染分类导航
 */
async function renderCategoryNav(activeCategoryId) {
    const container = document.getElementById('categoryNav');
    if (!container) return;

    try {
        const tree = await API.get('/category/tree');
        if (!Array.isArray(tree) || tree.length === 0) {
            container.style.display = 'none';
            return;
        }

        let html = '<div class="container">';
        html += `<div class="category-nav-item ${!activeCategoryId ? 'active' : ''}" onclick="location.href='index.html'">首页</div>`;

        tree.forEach(cat => {
            const isActive = cat.category_id == activeCategoryId ||
                (cat.children || []).some(c => c.category_id == activeCategoryId);
            html += `<div class="category-nav-item ${isActive ? 'active' : ''}"
                          onclick="location.href='index.html?category_id=${cat.category_id}'">
                        ${cat.name}
                     </div>`;
        });

        html += '</div>';
        container.innerHTML = html;
    } catch (e) {
        container.style.display = 'none';
    }
}

/**
 * 分页渲染
 * @param {number} current - 当前页
 * @param {number} total - 总条数
 * @param {number} size - 每页条数
 * @param {Function} onPageChange - 页码点击回调
 */
function renderPagination(current, total, size, onPageChange) {
    const totalPages = Math.ceil(total / size);
    if (totalPages <= 1) return '';

    let html = '<div class="pagination">';

    // 上一页
    html += `<button ${current <= 1 ? 'disabled' : ''} onclick="(${onPageChange})(${current - 1})">‹</button>`;

    // 页码（最多显示 7 个）
    let start = Math.max(1, current - 3);
    let end = Math.min(totalPages, start + 6);
    start = Math.max(1, end - 6);

    if (start > 1) {
        html += `<button onclick="(${onPageChange})(1)">1</button>`;
        if (start > 2) html += `<button disabled>...</button>`;
    }

    for (let i = start; i <= end; i++) {
        html += `<button class="${i === current ? 'active' : ''}" onclick="(${onPageChange})(${i})">${i}</button>`;
    }

    if (end < totalPages) {
        if (end < totalPages - 1) html += `<button disabled>...</button>`;
        html += `<button onclick="(${onPageChange})(${totalPages})">${totalPages}</button>`;
    }

    // 下一页
    html += `<button ${current >= totalPages ? 'disabled' : ''} onclick="(${onPageChange})(${current + 1})">›</button>`;

    html += '</div>';
    return html;
}

/**
 * 页面初始化：渲染导航 + 页脚
 */
function initPage() {
    renderNavbar();

    // 添加页脚
    const existingFooter = document.querySelector('.footer');
    if (!existingFooter) {
        const footer = document.createElement('footer');
        footer.className = 'footer';
        footer.innerHTML = `
            <div class="container">
                <span>© 2024 CampusMall 校园购物商城 - 数据库课程设计</span>
                <span>基于 MySQL + Spring Boot + 原生前端</span>
            </div>
        `;
        document.body.appendChild(footer);
    }
}

// DOM Ready 自动初始化
document.addEventListener('DOMContentLoaded', initPage);
