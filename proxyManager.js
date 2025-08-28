const Proxifly = require('proxifly');

// مقداردهی اولیه کلاینت پراکسی‌فلای
// نیازی به کلید API برای استفاده رایگان نیست
const proxifly = new Proxifly();

// لیست موقت برای نگهداری پراکسی‌های سالم و تست‌شده.
let proxyCache = [];
let proxyIndex = 0;

/**
 * پراکسی‌های سالم را با استفاده از ماژول `proxifly` دریافت و در حافظه موقت ذخیره می‌کند.
 * این روش بسیار بهینه‌تر است زیرا پراکسی‌ها قبلاً توسط سرویس تست شده‌اند.
 */
async function fetchAndValidateProxies() {
    console.log(`⏳ در حال دریافت پراکسی‌های سالم از سرویس Proxifly...`);
    try {
        const options = {
            country: 'US',   // دریافت پراکسی فقط از آمریکا
            quantity: 100,   // درخواست ۱۰۰ پراکسی سالم
            format: 'text',  // فرمت خروجی: protocol://ip:port
        };

        const healthyProxies = await proxifly.getProxy(options);

        if (!healthyProxies || healthyProxies.length === 0) {
            console.error("❌ سرویس Proxifly هیچ پراکسی سالمی برنگرداند.");
            return;
        }

        proxyCache = healthyProxies;
        proxyIndex = 0;
        // پراکسی‌ها را به صورت تصادفی مرتب می‌کنیم تا هر بار از پراکسی‌های متفاوتی استفاده شود
        proxyCache.sort(() => Math.random() - 0.5);

        console.log(`✅ تعداد ${proxyCache.length} پراکسی سالم و تست‌شده با موفقیت از Proxifly دریافت شد.`);

    } catch (error) {
        console.error(`❌ خطای فاجعه‌بار هنگام دریافت پراکسی از Proxifly: ${error.message}`);
        // در صورت خطا، سعی می‌کنیم از فایل پشتیبان محلی استفاده کنیم (اگر وجود داشته باشد)
        // این بخش می‌تواند در آینده برای پایداری بیشتر اضافه شود.
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
