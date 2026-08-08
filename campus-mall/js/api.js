/* API封装 */
/* ============================================
   CampusMall - API 请求封装
   ============================================ */

const API_BASE = '/mall-api';

// Token 管理
const Token = {
    get() {
        return localStorage.getItem('token');
    },
    set(token) {
        localStorage.setItem('token', token);
    },
    remove() {
        localStorage.removeItem('token');
    }
};

// 用户信息缓存
const UserInfo = {
    get() {
        const data = localStorage.getItem('userInfo');
        return data ? JSON.parse(data) : null;
    },
    set(info) {
        localStorage.setItem('userInfo', JSON.stringify(info));
    },
    remove() {
        localStorage.removeItem('userInfo');
    }
};

/**
 * 统一请求方法
 * @param {string} url - API 路径（不含 /api 前缀）
 * @param {object} options - fetch 选项
 * @returns {Promise<any>}
 */
async function request(url, options = {}) {
    const token = Token.get();
    const headers = {
        ...options.headers,
    };

    // FormData 不设置 Content-Type，让浏览器自动加 boundary
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_BASE}${url}`, {
            ...options,
            headers,
        });

        // 处理 401 未授权
        if (response.status === 401) {
            Token.remove();
            UserInfo.remove();
            // 避免无限跳转
            if (!location.pathname.endsWith('login.html')) {
                Toast.warning('登录已过期，请重新登录');
                setTimeout(() => {
                    location.href = 'login.html';
                }, 1000);
            }
            throw new Error('未授权');
        }

        const data = await response.json();

        if (response.ok && (data.code === 0 || data.code === 200 || data.success)) {
            return data.data !== undefined ? data.data : data;
        }

        // 业务错误
        const errMsg = data.message || data.msg || '请求失败';
        throw new Error(errMsg);
    } catch (error) {
        if (error.message === '未授权') throw error;
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('网络连接失败，请检查后端服务是否启动');
        }
        throw error;
    }
}

// 快捷方法
const API = {
    get(url, params) {
        let queryStr = '';
        if (params) {
            const searchParams = new URLSearchParams();
            Object.entries(params).forEach(([k, v]) => {
                if (v !== undefined && v !== null && v !== '') {
                    searchParams.append(k, v);
                }
            });
            const qs = searchParams.toString();
            if (qs) queryStr = '?' + qs;
        }
        return request(url + queryStr);
    },

    post(url, data) {
        return request(url, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    put(url, data) {
        return request(url, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    delete(url) {
        return request(url, { method: 'DELETE' });
    },
};

/* ============================================
   Toast 提示
   ============================================ */
const Toast = {
    _container: null,

    _getContainer() {
        if (!this._container) {
            this._container = document.createElement('div');
            this._container.className = 'toast-container';
            document.body.appendChild(this._container);
        }
        return this._container;
    },

    show(message, type = 'info', duration = 3000) {
        const container = this._getContainer();
        const toast = document.createElement('div');
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ',
        };
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            toast.style.transition = 'all 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    success(msg) { this.show(msg, 'success'); },
    error(msg) { this.show(msg, 'error', 4000); },
    warning(msg) { this.show(msg, 'warning'); },
    info(msg) { this.show(msg, 'info'); },
};

/* ============================================
   工具函数
   ============================================ */
const Utils = {
    /** 格式化价格 */
    formatPrice(price) {
        return '¥' + Number(price).toFixed(2);
    },

    /** 获取 URL 参数 */
    getParam(name) {
        const params = new URLSearchParams(location.search);
        return params.get(name);
    },

    /** 生成订单号 */
    genOrderNo() {
        const now = new Date();
        const ts = now.getFullYear().toString() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') +
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0') +
            String(now.getSeconds()).padStart(2, '0');
        return ts + String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    },

    /** 格式化日期 */
    formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0') + ' ' +
            String(d.getHours()).padStart(2, '0') + ':' +
            String(d.getMinutes()).padStart(2, '0');
    },

    /** 订单状态文字 */
    orderStatus(status) {
        const map = {
            0: '待付款', 1: '待发货', 2: '待收货',
            3: '已完成', 4: '已取消', 5: '已退款',
        };
        return map[status] || '未知';
    },

    /** 订单状态颜色 class */
    orderStatusClass(status) {
        const map = {
            0: 'text-danger', 1: 'text-primary', 2: '',
            3: 'text-success', 4: 'text-light', 5: 'text-light',
        };
        return map[status] || '';
    },

    /** 节流 */
    throttle(fn, delay = 300) {
        let timer = null;
        return function (...args) {
            if (timer) return;
            timer = setTimeout(() => {
                fn.apply(this, args);
                timer = null;
            }, delay);
        };
    },

    /** 防抖 */
    debounce(fn, delay = 300) {
        let timer = null;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    },
};
