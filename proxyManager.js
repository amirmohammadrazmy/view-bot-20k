const axios = require('axios');

// آدرس API برای دریافت پراکسی از ProxyScrape.
// !!! توجه: این آدرس یک نمونه است. لطفاً آن را با آدرس API مخصوص خودتان از داشبورد ProxyScrape جایگزین کنید.
const PROXY_API_URL = "https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=elite";

// آدرسی که برای تست سلامت پراکسی‌ها استفاده می‌شود.
const VALIDATION_URL = "https://2ad.ir/";
const VALIDATION_TIMEOUT = 10000; // 10 ثانیه

// لیست موقت برای نگهداری پراکسی‌های سالم و تست‌شده.
let proxyCache = [];
let proxyIndex = 0;

/**
 * یک پراکسی را با اتصال به VALIDATION_URL تست می‌کند.
 * @param {string} proxy - پراکسی برای تست کردن (فرمت: http://ip:port)
 * @returns {Promise<string|null>} پراکسی در صورت سالم بودن، در غیر این صورت null.
 */
async function validateProxy(proxy) {
    try {
        const proxyUrl = new URL(proxy);
        // از متد HEAD استفاده می‌کنیم که سریع‌تر است چون محتوای صفحه را دانلود نمی‌کند.
        await axios.head(VALIDATION_URL, {
            proxy: {
                protocol: proxyUrl.protocol.replace(':', ''),
                host: proxyUrl.hostname,
                port: parseInt(proxyUrl.port),
            },
            timeout: VALIDATION_TIMEOUT,
        });
        // console.log(`✅ پراکسی سالم: ${proxy}`); // برای دیباگ می‌توانید این خط را فعال کنید
        return proxy;
    } catch (error) {
        // هرگونه خطای شبکه یا تایم‌اوت به معنی خراب بودن پراکسی است.
        // console.log(`❌ پراکسی خراب: ${proxy}`); // برای دیباگ می‌توانید این خط را فعال کنید
        return null;
    }
}

/**
 * پراکسی‌ها را از API دریافت کرده، آن‌ها را تست می‌کند و پراکسی‌های سالم را در حافظه ذخیره می‌نماید.
 */
async function fetchAndValidateProxies() {
    console.log("⏳ در حال دریافت لیست پراکسی‌های خام از API...");
    try {
        const response = await axios.get(PROXY_API_URL, { timeout: 20000 });
        const rawProxies = response.data.trim().split('\r\n').filter(p => p);

        if (rawProxies.length === 0) {
            console.warn("⚠️ هشدار: API پراکسی لیست خالی برگرداند.");
            return;
        }

        const formattedProxies = rawProxies.map(p => `http://${p.trim()}`);
        console.log(`✔️ تعداد ${formatted_proxies.length} پراکسی خام دریافت شد. شروع به تست سلامت پراکسی‌ها...`);

        // تست کردن تمام پراکسی‌ها به صورت موازی برای افزایش سرعت
        const validationPromises = formatted_proxies.map(validateProxy);
        const results = await Promise.all(validationPromises);

        const healthyProxies = results.filter(p => p !== null);

        if (healthyProxies.length === 0) {
            console.error("❌ تمام پراکسی‌های دریافت شده تست سلامت را رد کردند.");
            return;
        }

        proxyCache = healthy_proxies;
        proxyIndex = 0;
        // پراکسی‌ها را به هم می‌ریزیم تا توزیع تصادفی باشد.
        proxyCache.sort(() => Math.random() - 0.5);
        console.log(`✅ تست کامل شد. تعداد ${proxyCache.length} پراکسی سالم و آماده استفاده است.`);

    } catch (error) {
        console.error(`❌ خطای فاجعه‌بار هنگام دریافت و تست پراکسی‌ها: ${error.message}`);
    }
}

/**
 * یک پراکسی سالم از لیست ذخیره شده برمی‌گرداند.
 * @returns {string|null} یک پراکسی یا در صورت نبود پراکسی سالم، null.
 */
function getNextProxy() {
    if (proxyCache.length === 0) {
        return null;
    }
    const proxy = proxyCache[proxyIndex];
    proxyIndex = (proxyIndex + 1) % proxyCache.length;
    return proxy;
}

module.exports = {
    fetchAndValidateProxies,
    getNextProxy,
};
