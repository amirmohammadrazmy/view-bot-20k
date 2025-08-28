const axios = require('axios');
const puppeteer = require('puppeteer'); // Re-added for validation

// URL to the JSON file of US proxies
const PROXY_JSON_URL = "https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/countries/US/data.json";
const VALIDATION_URL = "https://2ad.ir/"; // A simple site for testing
const VALIDATION_TIMEOUT = 10000; // 10 seconds

// This will hold the raw, unchecked list of proxies
let proxyQueue = [];

/**
 * Fetches the list of proxies from the JSON file and populates the queue.
 * It does NOT validate them at this stage.
 */
async function fetchProxies() {
    console.log(`⏳ در حال دریافت لیست پراکسی از فایل JSON...`);
    try {
        const response = await axios.get(PROXY_JSON_URL, { timeout: 20000 });
        const proxyData = response.data;

        if (!proxyData || !Array.isArray(proxyData) || proxyData.length === 0) {
            console.error("❌ فایل JSON پراکسی دریافت نشد یا خالی است.");
            return;
        }

        const rawProxies = proxyData.map(item => item.proxy);
        proxyQueue = rawProxies;
        // Shuffle the queue to not always start with the same proxies
        proxyQueue.sort(() => Math.random() - 0.5);

        console.log(`✅ تعداد ${proxyQueue.length} پراکسی خام به صف اضافه شد.`);

    } catch (error) {
        console.error(`❌ خطای فاجعه‌بار هنگام دریافت فایل JSON پراکسی:`, error);
    }
}

/**
 * Validates a single proxy by trying to connect to a website through it.
 * @param {string} proxy - The proxy string to test.
 * @returns {Promise<string|null>} The proxy string if valid, otherwise null.
 */
async function validateProxy(proxy) {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                `--proxy-server=${proxy}`,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--ignore-certificate-errors',
            ],
            defaultViewport: null,
        });
        const page = await browser.newPage();
        await page.goto(VALIDATION_URL, {
            waitUntil: 'domcontentloaded',
            timeout: VALIDATION_TIMEOUT,
        });
        await browser.close();
        console.log(`\n✔️ پراکسی سالم پیدا شد: ${proxy}`);
        return proxy;
    } catch (error) {
        if (browser) {
            await browser.close();
        }
        return null;
    }
}

/**
 * Gets the next available proxy from the queue and validates it on the fly.
 * It will keep trying proxies from the queue until a working one is found.
 * @returns {Promise<string|null>} A working proxy string, or null if none are left.
 */
async function getNextProxy() {
    while (proxyQueue.length > 0) {
        // Take the next proxy from the front of the queue
        const proxyToTest = proxyQueue.shift();

        process.stdout.write(`\r🔄 در حال تست پراکسی: ${proxyToTest} | پراکسی‌های باقی‌مانده: ${proxyQueue.length} `);

        const workingProxy = await validateProxy(proxyToTest);
        if (workingProxy) {
            return workingProxy; // Found a working one
        }
    }

    // If the loop finishes, no working proxies were found
    console.warn("\n⚠️ تمام پراکسی‌های موجود در صف تست شدند و هیچکدام کار نکردند. از اتصال مستقیم استفاده خواهد شد.");
    return null;
}


module.exports = {
    fetchProxies,
    getNextProxy,
};
