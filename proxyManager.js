const axios = require('axios');
const { URL } = require('url');

// آدرس API جدید برای دریافت پراکسی (PubProxy)
// این API در هر درخواست یک پراکسی تصادفی برمی‌گرداند.
const PROXY_API_URL = "http://pubproxy.com/api/proxy?format=txt&type=http&https-true&speed=25";

// آدرسی که برای تست سلامت پراکسی‌ها استفاده می‌شود.
const VALIDATION_URL = "https://2ad.ir/";
const VALIDATION_TIMEOUT = 10000; // 10 ثانیه

/**
 * یک پراکسی را با اتصال به VALIDATION_URL تست می‌کند.
 */
async function validateProxy(proxy) {
    try {
        const proxyUrl = new URL(proxy);
        await axios.head(VALIDATION_URL, {
            proxy: {
                protocol: proxyUrl.protocol.replace(':', ''),
                host: proxyUrl.hostname,
                port: parseInt(proxyUrl.port),
            },
            timeout: VALIDATION_TIMEOUT,
        });
        return true; // پراکسی سالم است
    } catch (error) {
        return false; // پراکسی خراب است
    }
}

/**
 * یک پراکسی سالم و تست‌شده از API دریافت می‌کند.
 * این تابع تا زمانی که یک پراکسی سالم پیدا کند (یا به تعداد معینی تلاش کند) به کار خود ادامه می‌دهد.
 * @param {number} maxRetries - حداکثر تعداد تلاش برای پیدا کردن پراکسی سالم.
 * @returns {Promise<string|null>} یک پراکسی سالم یا null.
 */
async function getHealthyProxy(maxRetries = 10) {
    console.log("⏳ در حال تلاش برای یافتن یک پراکسی سالم...");
    for (let i = 0; i < maxRetries; i++) {
        try {
            console.log(`--- تلاش شماره ${i + 1} از ${maxRetries} ---`);
            // مرحله ۱: دریافت یک پراکسی از API
            const response = await axios.get(PROXY_API_URL, { timeout: 15000 });
            const proxyAddress = response.data.trim();
            if (!proxyAddress) {
                console.warn("⚠️ هشدار: API پراکسی آدرس خالی برگرداند. تلاش بعدی...");
                continue;
            }
            const proxy = `http://${proxyAddress}`;
            console.log(`✔️ پراکسی دریافت شد: ${proxy}. در حال تست سلامت...`);

            // مرحله ۲: تست سلامت پراکسی
            const isHealthy = await validateProxy(proxy);
            if (isHealthy) {
                console.log(`✅ پراکسی ${proxy} سالم و آماده استفاده است.`);
                return proxy;
            } else {
                console.warn(`❌ پراکسی ${proxy} در تست سلامت رد شد. تلاش بعدی...`);
            }
        } catch (error) {
            console.error(`❌ خطا در هنگام دریافت پراکسی از API: ${error.message}. تلاش بعدی...`);
        }
    }

    console.error(`💀 پس از ${maxRetries} بار تلاش، هیچ پراکسی سالمی پیدا نشد.`);
    return null;
}


// --- بازنویسی توابع اصلی برای سازگاری با ساختار جدید ---

// این تابع اکنون یک مخزن پراکسی ایجاد کرده و آن را پر می‌کند.
async function fetchAndValidateProxies() {
    // این تابع دیگر به طور مستقیم استفاده نمی‌شود، اما برای حفظ ساختار آن را نگه می‌داریم.
    // منطق اصلی به getHealthyProxy منتقل شده است.
    console.log("سیستم پراکسی جدید: پراکسی‌ها به صورت تکی و در حین نیاز دریافت و تست می‌شوند.");
}

// این تابع اکنون یک پراکسی سالم جدید درخواست می‌کند.
async function getNextProxy() {
    // برای هر تسک یک پراکسی سالم جدید می‌گیریم.
    return await getHealthyProxy();
}

module.exports = {
    fetchAndValidateProxies, // این تابع را برای سازگاری نگه می‌داریم
    getNextProxy,
};
