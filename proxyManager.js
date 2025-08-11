const axios = require('axios');
const puppeteer = require('puppeteer'); // Still needed for type definitions if we use them
const { URL } = require('url');

// آدرس لیست پراکسی جدید از گیت‌هاب
const PROXY_LIST_URL = "https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/countries/US/data.txt";

// آدرسی که برای تست سلامت پراکسی‌ها استفاده می‌شود.
const VALIDATION_URL = "https://2ad.ir/";
const VALIDATION_TIMEOUT = 10000; // 10 ثانیه

// لیست موقت برای نگهداری پراکسی‌های سالم و تست‌شده.
let proxyCache = [];
let proxyIndex = 0;

/**
 * یک پراکسی را با استفاده از Puppeteer تست می‌کند. این روش برای انواع پراکسی (HTTP, SOCKS4, SOCKS5) کار می‌کند.
 */
async function validateProxy(proxy) {
    let browser = null;
    try {
        // یک نمونه مرورگر بسیار سبک و سریع برای تست راه‌اندازی می‌کنیم.
        browser = await puppeteer.launch({
            headless: true,
            args: [
                `--proxy-server=${proxy}`,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--ignore-certificate-errors',
            ],
            // برای بهینه‌سازی، تنها یک صفحه خالی را باز می‌کنیم
            defaultViewport: null,
        });
        const page = await browser.newPage();

        // تلاش برای رفتن به یک سایت ساده جهت تست اتصال
        await page.goto(VALIDATION_URL, {
            waitUntil: 'domcontentloaded',
            timeout: VALIDATION_TIMEOUT,
        });

        // اگر پراکسی کار کند، آن را برمی‌گردانیم
        console.log(`✔️ پراکسی ${proxy} سالم است.`);
        await browser.close();
        return proxy;

    } catch (error) {
        // برای جلوگیری از لاگ‌های اضافی، خطای پراکسی‌های ناموفق را نمایش نمی‌دهیم
        if (browser) {
            await browser.close();
        }
        return null;
    }
}

/**
 * پراکسی‌ها را از لیست گیت‌هاب دریافت کرده، آن‌ها را تست می‌کند و سالم‌ها را ذخیره می‌نماید.
 */
async function fetchAndValidateProxies() {
    console.log(`⏳ در حال دریافت لیست پراکسی از گیت‌هاب...`);
    try {
        const response = await axios.get(PROXY_LIST_URL, { timeout: 20000 });
        const rawProxies = response.data.trim().split('\n').filter(p => p.trim());

        if (rawProxies.length === 0) {
            console.warn("⚠️ لیست پراکسی دریافت شده از گیت‌هاب خالی است.");
            return;
        }

        console.log(`✔️ تعداد ${rawProxies.length} پراکسی خام دریافت شد. شروع به تست سلامت...`);

        // تست کردن تمام پراکسی‌ها به صورت موازی برای افزایش سرعت
        const validationPromises = rawProxies.map(validateProxy);
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
