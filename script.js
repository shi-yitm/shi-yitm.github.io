function escapeHtml(v) {
    return String(v || "").replace(/[&<>"']/g, function (c) {
        return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
}

async function copyText(value, dependencies = {}) {
    const clipboard = dependencies.clipboard;
    const documentRef = dependencies.document;

    if (clipboard && typeof clipboard.writeText === 'function') {
        try {
            await clipboard.writeText(value);
            return true;
        } catch (_) {
            // Some browsers expose Clipboard API but deny access outside secure contexts.
        }
    }

    if (!documentRef?.body || typeof documentRef.createElement !== 'function') {
        return false;
    }

    let temporaryInput;
    try {
        temporaryInput = documentRef.createElement('textarea');
        temporaryInput.value = value;
        temporaryInput.readOnly = true;
        temporaryInput.style?.setProperty('position', 'fixed');
        temporaryInput.style?.setProperty('opacity', '0');
        documentRef.body.appendChild(temporaryInput);
        temporaryInput.select();
        return documentRef.execCommand('copy') === true;
    } catch (_) {
        return false;
    } finally {
        if (temporaryInput) {
            try {
                documentRef.body.removeChild(temporaryInput);
            } catch (_) {
                // The node may already have been detached by page code.
            }
        }
    }
}

function initCopyButtons(options = {}) {
    const documentRef = options.document;
    if (!documentRef || typeof documentRef.addEventListener !== 'function') {
        return () => {};
    }

    const clipboard = options.clipboard;
    const setTimer = options.setTimeout || setTimeout;
    const clearTimer = options.clearTimeout || clearTimeout;
    const restoreDelay = options.restoreDelay ?? 1600;
    const timers = new WeakMap();
    const activeTimers = new Set();
    const originals = new WeakMap();
    const clickVersions = new WeakMap();
    let disposed = false;

    const handleClick = async (event) => {
        if (disposed) {
            return;
        }

        const button = event.target?.closest?.('[data-copy]');
        if (!button?.dataset) {
            return;
        }

        if (!originals.has(button)) {
            originals.set(button, {
                text: button.textContent,
                ariaLabel: button.getAttribute('aria-label'),
            });
        }

        const oldTimer = timers.get(button);
        if (oldTimer !== undefined) {
            clearTimer(oldTimer);
            activeTimers.delete(oldTimer);
            timers.delete(button);
        }

        const version = (clickVersions.get(button) || 0) + 1;
        clickVersions.set(button, version);
        const copied = await copyText(button.dataset.copy, {
            clipboard,
            document: documentRef,
        });

        if (disposed || clickVersions.get(button) !== version) {
            return;
        }

        const status = copied ? '已复制' : '复制失败，请手动选择';
        button.textContent = status;
        button.setAttribute('aria-label', status);

        let timer;
        timer = setTimer(() => {
            activeTimers.delete(timer);
            if (disposed || clickVersions.get(button) !== version) {
                return;
            }
            const original = originals.get(button);
            button.textContent = original.text;
            if (original.ariaLabel === null) {
                button.removeAttribute?.('aria-label');
            } else {
                button.setAttribute('aria-label', original.ariaLabel);
            }
            timers.delete(button);
            originals.delete(button);
        }, restoreDelay);
        timers.set(button, timer);
        activeTimers.add(timer);
    };

    documentRef.addEventListener('click', handleClick);
    return () => {
        documentRef.removeEventListener('click', handleClick);
        disposed = true;
        for (const timer of activeTimers) {
            clearTimer(timer);
        }
        activeTimers.clear();
    };
}

function initMobileNavigation(documentRef, windowRef) {
    if (!documentRef || !windowRef) {
        return;
    }

    const nav = documentRef.querySelector('.nav-links');
    const toggle = documentRef.querySelector('.menu-toggle');

    toggle?.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = nav?.classList.toggle('is-open') ?? false;
        toggle.setAttribute('aria-expanded', String(isOpen));
    });

    documentRef.addEventListener('click', (event) => {
        if (!nav || !toggle || windowRef.innerWidth > 720) {
            return;
        }

        const target = event.target;
        if (target && !nav.contains(target) && !toggle.contains(target)) {
            nav.classList.remove('is-open');
            toggle.setAttribute('aria-expanded', 'false');
        }
    });

    windowRef.addEventListener('resize', () => {
        if (windowRef.innerWidth > 720) {
            nav?.classList.remove('is-open');
            toggle?.setAttribute('aria-expanded', 'false');
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { copyText, initCopyButtons, initMobileNavigation };
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    initMobileNavigation(document, window);
    initCopyButtons({
        document,
        clipboard: typeof navigator !== 'undefined' ? navigator.clipboard : undefined,
        setTimeout: window.setTimeout.bind(window),
        clearTimeout: window.clearTimeout.bind(window),
    });
}

/* ===== Dark Mode Toggle ===== */
function initThemeToggle(documentRef, windowRef) {
    console.log('[Theme] initThemeToggle called');
    if (!documentRef || !windowRef) return;
    
    const STORAGE_KEY = 'blog-theme';
    const html = documentRef.documentElement;
    const toggle = documentRef.querySelector('.theme-toggle');
    
    // Load saved theme or respect OS preference
    function getPreferredTheme() {
        const saved = windowRef.localStorage?.getItem(STORAGE_KEY);
        if (saved) return saved;
        return windowRef.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    function applyTheme(theme) {
        console.log('[Theme] Applying:', theme);
        html.setAttribute('data-theme', theme);
        if (toggle) {
            toggle.textContent = theme === 'dark' ? '☀️' : '🌙';
            toggle.setAttribute('aria-label', theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式');
        }
    }
    
    // Apply on load
    applyTheme(getPreferredTheme());
    
    // Toggle on click
    toggle?.addEventListener('click', () => {
        console.log('[Theme] Toggle clicked');
        const current = html.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        windowRef.localStorage?.setItem(STORAGE_KEY, next);
    });
    
    // Listen for OS preference changes
    windowRef.matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener('change', (e) => {
        if (!windowRef.localStorage?.getItem(STORAGE_KEY)) {
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { initThemeToggle(document, window); });
    } else {
        initThemeToggle(document, window);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports.initThemeToggle = initThemeToggle;
}

/* ===== Homepage: Load Latest Articles ===== */
async function loadLatestArticles(documentRef) {
    if (!documentRef) return;
    
    const container = documentRef.getElementById('latestPosts');
    if (!container) return;
    
    try {
        const res = await fetch('/blog-api/articles?limit=3');
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        const articles = data.data || [];
        
        if (articles.length === 0) {
            container.innerHTML = '<article class="post-card" style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:2rem">暂无文章</article>';
            return;
        }
        
        container.innerHTML = articles.map(a => {
            const tagClass = (a.category === '技术' || a.category === 'tech') ? 'tag-dev' : 'tag-life';
            const tagText = a.category || '未分类';
            const date = a.created_at ? a.created_at.split('T')[0] : '';
            const excerpt = a.summary || '';
            const link = '/blog-api/post/' + a.id;
            const readingTime = Math.ceil((a.content || '').length / 500);
            return '<article class="post-card">' +
                '<div class="post-tag ' + tagClass + '">' + escapeHtml(tagText) + '</div>' +
                '<h3 class="post-title"><a href="' + link + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(a.title) + '</a></h3>' +
                '<p class="post-excerpt">' + escapeHtml(excerpt) + '</p>' +
                '<div class="post-meta"><span>' + date + ' · ' + readingTime + ' 分钟阅读</span>' +
                '<a class="post-readmore" href="' + link + '">阅读全文</a></div></article>';
        }).join('');
    } catch (err) {
        container.innerHTML = '<article class="post-card" style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:2rem">文章加载失败</article>';
    }
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    loadLatestArticles(document);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports.loadLatestArticles = loadLatestArticles;
}
