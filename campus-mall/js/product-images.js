/* 商品图片映射 - 所有页面共用 */
const ProductImageMap = {
    'iPhone 15 Pro': 'images/products/iphone15pro.jpg',
    '华为Mate 60 Pro': 'images/products/mate60pro.jpg',
    '小米14': 'images/products/xiaomi14.jpg',
    'MacBook Pro 14寸': 'images/products/macbookpro14.jpg',
    'AirPods Pro 2': 'images/products/airpodspro2.jpg',
    '高等数学同济第七版': 'images/products/math.jpg',
    '数据库系统概论': 'images/products/db.jpg',
    'Nike Air Force 1': 'images/products/af1.jpg',
    '优衣库摇粒绒卫衣': 'images/products/fleece.jpg',
    '小米台灯Pro': 'images/products/lamp.jpg',
};

/**
 * 根据商品名获取图片URL（支持模糊匹配）
 * @param {string} title - 商品名称
 * @param {string} fallback - 兜底图片URL
 * @returns {string} 图片路径
 */
function getProductImageUrl(title, fallback) {
    if (!title) return fallback || '';
    // 精确匹配
    if (ProductImageMap[title]) return ProductImageMap[title];
    // 模糊匹配
    for (const [key, url] of Object.entries(ProductImageMap)) {
        if (title.includes(key) || key.includes(title)) return url;
    }
    return fallback || '';
}
