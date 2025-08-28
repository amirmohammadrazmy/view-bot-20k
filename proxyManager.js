const axios = require('axios');

// URL مستقیم به فایل JSON پراکسی‌های آمریکا
const PROXY_JSON_URL = "https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/countries/US/data.json";

// لیست موقت برای نگهداری پراکسی‌های سالم.
let proxyCache = [];
let proxyIndex = 0;

/**
 * پراکسی‌ها را مستقیماً از فایل JSON دریافت کرده و در حافظه موقت ذخیره می‌کند.
 * این روش سریع و قابل اعتماد است و نیازی به تست مجدد پراکسی‌ها ندارد.
 */
async function fetchAndValidateProxies() {
    console.log(`⏳ در حال دریافت لیست پراکسی از فایل JSON...`);
    try {
        const response = await axios.get(PROXY_JSON_URL, { timeout: 20000 });
        const proxyData = response.data;

        if (!proxyData || !Array.isArray(proxyData) || proxyData.length === 0) {
            console.error("❌ فایل JSON پراکسی دریافت نشد یا خالی است.");
            return;
        }

        // استخراج رشته کامل پراکسی از هر آبجکت در آرایه JSON
        const healthyProxies = proxyData.map(item => item.proxy);

        proxyCache = healthyProxies;
        proxyIndex = 0;
        // پراکسی‌ها را به صورت تصادفی مرتب می‌کنیم
        proxyCache.sort(() => Math.random() - 0.5);

        console.log(`✅ تعداد ${proxyCache.length} پراکسی با موفقیت از فایل JSON دریافت شد.`);

    } catch (error) {
        console.error(`❌ خطای فاجعه‌بار هنگام دریافت و پردازش فایل JSON پراکسی:`, error);
    }
}

/**
 * یک پراکسی سالم از لیست ذخیره شده برمی‌گرداند.
 */
function getNextProxy() {
    if (proxyCache.length === 0) {
        console.warn("⚠️ مخزن پراکسی خالی است. از اتصال مستقیم استفاده خواهد شد.");
        return null;
    }
    const proxy = proxyCache[proxyIndex];
    proxyIndex = (proxyIndex + 1) % proxyCache.length;
    return proxy;
}

// این تابع دیگر استفاده نمی‌شود اما برای سازگاری باقی می‌ماند
async function getAndValidateSingleProxy(maxRetries = 10) {
    console.log("این تابع دیگر استفاده نمی‌شود. پراکسی‌ها در ابتدا بارگذاری می‌شوند.");
    return getNextProxy();
}

module.exports = {
    fetchAndValidateProxies,
    getNextProxy,
};
