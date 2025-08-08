const puppeteer = require('puppeteer');
const fs = require('fs/promises');
const path = require('path');
const { fetchAndValidateProxies, getNextProxy } = require('./proxyManager');

// --- کلاس مدیر مرورگر (مبتنی بر Puppeteer) ---
// این کلاس مسئولیت تمام تعاملات با مرورگر را بر عهده دارد.
class BrowserManager {
    constructor(agentId, proxy) {
        this.agentId = agentId;
        this.proxy = proxy;
        this.browser = null;
        console.log(`✔️ ایجنت ${this.agentId}: مدیر مرورگر آماده شد.`);
        if (this.proxy) {
            console.log(`ℹ️ ایجنت ${this.agentId}: از پراکسی ${this.proxy} استفاده خواهد شد.`);
        }
    }

    /**
     * مرورگر را راه‌اندازی کرده و یک صفحه جدید ایجاد می‌کند.
     */
    async start() {
        try {
            console.log(`⏳ ایجنت ${this.agentId}: در حال راه‌اندازی مرورگر Puppeteer...`);
            const args = ['--no-sandbox', '--disable-setuid-sandbox'];
            if (this.proxy) {
                args.push(`--proxy-server=${this.proxy}`);
            }

            this.browser = await puppeteer.launch({
                headless: true,
                args: args,
            });

            const page = await this.browser.newPage();
            await page.setViewport({ width: 1920, height: 1080 });
            console.log(`✅ ایجنت ${this.agentId}: مرورگر با موفقیت راه‌اندازی شد.`);
            return page;
        } catch (error) {
            console.error(`❌ ایجنت ${this.agentId}: خطای بحرانی در زمان راه‌اندازی مرورگر: ${error.message}`);
            await this.shutdown();
            return null;
        }
    }

    /**
     * به یک URL جدید می‌رود.
     * @returns {Promise<boolean>} موفقیت یا شکست.
     */
    async navigate(page, url) {
        console.log(`⏳ ایجنت ${this.agentId}: در حال ناوبری به آدرس: ${url}`);
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
            console.log(`✅ ایجنت ${this.agentId}: ناوبری به ${url} با موفقیت انجام شد.`);
            return true;
        } catch (error) {
            console.error(`❌ ایجنت ${this.agentId}: خطای ناوبری به ${url}: ${error.message}`);
            return false;
        }
    }

    /**
     * روی یک عنصر در صفحه کلیک می‌کند.
     * @returns {Promise<boolean>} موفقیت یا شکست.
     */
    async click(page, selector, timeout = 15000) {
        console.log(`⏳ ایجنت ${this.agentId}: در حال تلاش برای کلیک روی عنصر: '${selector}'`);
        try {
            await page.waitForSelector(selector, { visible: true, timeout });
            await page.click(selector);
            console.log(`✅ ایجنت ${this.agentId}: کلیک روی '{selector}' با موفقیت انجام شد.`);
            return true;
        } catch (error) {
            console.error(`❌ ایجنت ${this.agentId}: خطای کلیک روی '${selector}': ${error.message}`);
            return false;
        }
    }

    /**
     * بررسی می‌کند که آیا کپچا در صفحه وجود دارد یا خیر.
     * @returns {Promise<boolean>}
     */
    async checkForCaptcha(page) {
        console.log(`🕵️ ایجنت ${this.agentId}: در حال بررسی صفحه برای شناسایی کپچا...`);
        const captchaSelectors = [
            'iframe[src*="recaptcha"]',
            'iframe[src*="hcaptcha"]',
            'div#cf-turnstile',
            'div.g-recaptcha',
        ];
        for (const selector of captchaSelectors) {
            const element = await page.$(selector);
            if (element) {
                console.log(`⚠️ ایجنت ${this.agentId}: کپچا با انتخابگر '${selector}' شناسایی شد!`);
                return true;
            }
        }
        return false;
    }

    /**
     * مرورگر را می‌بندد.
     */
    async shutdown() {
        if (this.browser) {
            console.log(`⏳ ایجنت ${this.agentId}: در حال بستن مرورگر...`);
            await this.browser.close();
            console.log(`✅ ایجنت ${this.agentId}: مرورگر با موفقیت بسته شد.`);
            this.browser = null;
        }
    }
}

// --- کلاس اجرا کننده تسک ---
class TaskExecutor {
    constructor(agentId) {
        this.agentId = agentId;
    }

    /**
     * تسک‌های روزانه ایجنت را اجرا می‌کند.
     */
    async runDailyTasks() {
        console.log(`🚀 ایجنت ${this.agentId}: شروع به کار کرد.`);
        const links = await this._getLinksForAgent();
        if (!links || links.length === 0) {
            console.log(`✅ ایجنت ${this.agentId}: هیچ لینکی برای پردازش وجود ندارد. کار تمام شد.`);
            return;
        }
        console.log(`ℹ️ ایجنت ${this.agentId}: تعداد ${links.length} لینک برای پردازش اختصاص داده شد.`);

        for (let i = 0; i < links.length; i++) {
            const url = links[i];
            console.log(`\n--- شروع پردازش لینک ${i + 1} از ${links.length} ---`);
            console.log(`🔗 ایجنت ${this.agentId}: در حال پردازش URL: ${url}`);

            const proxy = getNextProxy();
            const bm = new BrowserManager(this.agentId, proxy);

            try {
                await this._processSingleLink(bm, url);
            } catch (error) {
                console.error(`🔥 خطای فاجعه‌بار برای ایجنت ${this.agentId} در URL ${url}: ${error.message}`);
            } finally {
                await bm.shutdown();
                const sleepTime = Math.random() * (7 - 3) + 3;
                console.log(`--- پایان پردازش لینک. استراحت برای ${sleepTime.toFixed(2)} ثانیه ---`);
                await new Promise(res => setTimeout(res, sleepTime * 1000));
            }
        }
        console.log(`🎉 ایجنت ${this.agentId}: پردازش تمام لینک‌ها با موفقیت به پایان رسید.`);
    }

    /**
     * لینک‌ها را از فایل خوانده و بر اساس ID ایجنت تقسیم می‌کند.
     */
    async _getLinksForAgent() {
        try {
            const linksPath = path.join(__dirname, 'data', 'links.txt');
            const data = await fs.readFile(linksPath, 'utf8');
            const allLinks = data.split('\n').map(l => l.trim()).filter(Boolean);

            const linksPerAgent = 50;
            const startIndex = (this.agentId - 1) * linksPerAgent;
            const endIndex = startIndex + linksPerAgent;

            return allLinks.slice(startIndex, endIndex);
        } catch (error) {
            console.error(`❌ ایجنت ${this.agentId}: فایل data/links.txt پیدا نشد یا قابل خواندن نیست.`);
            return [];
        }
    }

    /**
     * فرآیند کامل کار روی یک URL را انجام می‌دهد.
     */
    async _processSingleLink(browserManager, url) {
        const page = await browserManager.start();
        if (!page) return;

        if (!await browserManager.navigate(page, url)) return;
        await new Promise(res => setTimeout(res, Math.random() * 2000 + 2000));

        if (!await browserManager.click(page, '#invisibleCaptchaShortlink')) return;

        console.log("⏳ ایجنت در حال انتظار برای لود شدن صفحه پس از کلیک اول (۱۱ ثانیه)...");
        await new Promise(res => setTimeout(res, 11000));

        if (await browserManager.checkForCaptcha(page)) return;

        if (!await browserManager.click(page, '.get-link')) return;

        console.log(`✅ ایجنت ${this.agentId}: پردازش URL ${url} با موفقیت کامل شد.`);
    }
}

// --- نقطه شروع اصلی برنامه ---
async function main() {
    // خواندن ID ایجنت از آرگومان‌های خط فرمان
    const args = process.argv.slice(2);
    const agentIdArg = args.find(arg => arg.startsWith('--agent-id='));
    const agentId = agentIdArg ? parseInt(agentIdArg.split('=')[1]) : (process.env.AGENT_ID || 1);

    console.log("--- شروع فرآیند دریافت و تست پراکسی‌ها ---");
    await fetchAndValidateProxies();

    const executor = new TaskExecutor(agentId);
    await executor.runDailyTasks();
}

main().catch(error => {
    console.error('❌ خطای نهایی در اجرای برنامه:', error);
    process.exit(1);
});
