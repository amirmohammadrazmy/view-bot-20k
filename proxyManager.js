const axios = require('axios');
const puppeteer = require('puppeteer'); // Still needed for type definitions if we use them
const { URL } = require('url');

// آدرس لیست پراکسی جدید از گیت‌هاب (HTTP proxies)
const PROXY_LIST_URL = "https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/countries/US/data.txt";

// آدرسی که برای تست سلامت پراکسی‌ها استفاده می‌شود.
const VALIDATION_URL = "https://2ad.ir/";
const VALIDATION_TIMEOUT = 10000; // 10 ثانیه

// لیست موقت برای نگهداری پراکسی‌های سالم و تست‌شده.
let proxyCache = [];
let proxyIndex = 0;

/**
 * یک پراکسی HTTP را با استفاده از axios تست می‌کند. این روش سریع و بهینه است.
 */
async function validateProxy(proxy) {
    try {
        const proxyUrl = new URL(proxy);
        await axios.head(VALIDATION_URL, {
            proxy: {
                protocol: 'http',
                host: proxyUrl.hostname,
                port: parseInt(proxyUrl.port),
            },
            timeout: VALIDATION_TIMEOUT,
        });
        return proxy;
    } catch (error) {
        return null;
    }
}

/**
 * پراکسی‌ها را از لیست گیت‌هاب دریافت کرده، آن‌ها را تست می‌کند و سالم‌ها را ذخیره می‌نماید.
 */
async function fetchAndValidateProxies() {
    console.log(`⏳ در حال دریافت لیست پراکسی‌های HTTP از گیت‌هاب...`);
    try {
        const response = await axios.get(PROXY_LIST_URL, { timeout: 20000 });
        const rawProxies = response.data.trim().split('\n').filter(p => p.trim());

        if (rawProxies.length === 0) {
            console.warn("⚠️ لیست پراکسی دریافت شده از گیت‌هاب خالی است.");
            return;
        }

        // پراکسی‌ها را با پروتکل صحیح فرمت می‌کنیم
        const formattedProxies = rawProxies.map(p => `http://${p.trim()}`);
        console.log(`✔️ تعداد ${formattedProxies.length} پراکسی خام دریافت شد. شروع به تست سلامت...`);

        // تست کردن تمام پراکسی‌ها به صورت موازی برای افزایش سرعت
        const validationPromises = formattedProxies.map(validateProxy);
        const results = await Promise.all(validationPromises);
        const healthyProxies = results.filter(p => p !== null);

        if (healthyProxies.length === 0) {
            console.error("❌ هیچکدام از پراکسی‌های لیست، تست سلامت را پاس نکردند.");
            return;
        }

        proxyCache = healthyProxies;
        proxyIndex = 0;
        proxyCache.sort(() => Math.random() - 0.5); // Shuffle
        console.log(`✅ تست کامل شد. تعداد ${proxyCache.length} پراکسی سالم و آماده استفاده است.`);

    } catch (error) {
        console.error(`❌ خطای فاجعه‌بار هنگام دریافت و تست پراکسی‌ها از گیت‌هاب: ${error.message}`);
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

// برای سازگاری با main.js، تابع اصلی را دوباره تعریف می‌کنیم
// و منطق را به سمت دریافت پراکسی در لحظه نیاز، تغییر می‌دهیم.
async function getAndValidateSingleProxy(maxRetries = 10) {
    console.log("این تابع دیگر استفاده نمی‌شود. پراکسی‌ها در ابتدا بارگذاری می‌شوند.");
    return getNextProxy();
}

module.exports = {
    fetchAndValidateProxies, // تابع اصلی ما اکنون این است
    getNextProxy,
};
