// 移动端菜单切换
document.querySelector('.menu-toggle')?.addEventListener('click', function() {
    const nav = document.querySelector('.nav-links');
    if (nav.style.display === 'flex') {
        nav.style.display = 'none';
    } else {
        nav.style.display = 'flex';
        nav.style.flexDirection = 'column';
        nav.style.position = 'absolute';
        nav.style.top = '60px';
        nav.style.left = '0';
        nav.style.right = '0';
        nav.style.background = 'rgba(255,255,255,0.95)';
        nav.style.backdropFilter = 'blur(12px)';
        nav.style.padding = '20px 24px';
        nav.style.gap = '16px';
        nav.style.borderBottom = '1px solid var(--border)';
        nav.style.zIndex = '99';
    }
});

// 点击页面其他地方关闭菜单
document.addEventListener('click', function(e) {
    const nav = document.querySelector('.nav-links');
    const toggle = document.querySelector('.menu-toggle');
    if (!toggle?.contains(e.target) && !nav?.contains(e.target) && window.innerWidth <= 640) {
        nav.style.display = 'none';
    }
});
