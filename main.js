const puppeteer = require('puppeteer-core');
const fs = require('fs/promises');
const path = require('path');
const UserAgent = require('user-agents');
const { fetchAndValidateProxies, getNextProxy } = require('./proxyManager');
const { solveCaptcha } = require('./ocrSolver.js');

// --- کلاس مدیر مرورگر (مبتنی بر Puppeteer) ---
// این کلاس مسئولیت تمام تعاملات با مرورگر را با قابلیت‌های پیشرفته ناشناس‌سازی بر عهده دارد.
class BrowserManager {
    constructor(agentId, proxy) {
        this.agentId = agentId;
        this.proxy = proxy;
        this.browser = null;
        // یک User-Agent واقعی و تصادفی برای مخفی کردن ربات ایجاد می‌کنیم.
        this.userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();
        console.log(`✔️ ایجنت ${this.agentId}: مدیر مرورگر با User-Agent زیر آماده شد:\n${this.userAgent}`);
        if (this.proxy) {
            console.log(`ℹ️ ایجنت ${this.agentId}: از پراکسی ${this.proxy} استفاده خواهد شد.`);
        }
    }

    /**
     * مرورگر را با تنظیمات پیشرفته برای جلوگیری از شناسایی، راه‌اندازی می‌کند.
     */
    async start() {
        try {
            console.log(`⏳ ایجنت ${this.agentId}: در حال راه‌اندازی مرورگر پیشرفته...`);

            const args = [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--incognito',
                '--disable-extensions',
                '--disable-plugins-discovery',
                '--disable-default-apps',
                '--window-size=1280,720',
            ];
            if (this.proxy) {
                args.push(`--proxy-server=${this.proxy}`);
            }

            this.browser = await puppeteer.launch({
                executablePath: '/usr/bin/chromium-browser',
                headless: true,
                args: args,
                ignoreDefaultArgs: ['--enable-automation'],
            });

            const page = await this.browser.newPage();

            await page.setUserAgent(this.userAgent);
            await page.setViewport({ width: 1280, height: 720 });

            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'language', { get: () => 'en-US' });
                Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
                try {
                    const timezones = ['America/New_York', 'Europe/London', 'Asia/Tokyo', 'Australia/Sydney'];
                    const randomTz = timezones[Math.floor(Math.random() * timezones.length)];
                    Intl.DateTimeFormat.prototype.resolvedOptions = function() { return { timeZone: randomTz }; };
                } catch (e) { /* ignore */ }
            });

            console.log(`✅ ایجنت ${this.agentId}: مرورگر پیشرفته با موفقیت راه‌اندازی شد.`);
            return page;
        } catch (error) {
            console.error(`❌ ایجنت ${this.agentId}: خطای بحرانی در زمان راه‌اندازی مرورگر: ${error.message}`);
            await this.shutdown();
            return null;
        }
    }

    /**
     * به یک URL جدید می‌رود.
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
     */
    async click(page, selector, timeout = 15000) {
        console.log(`⏳ ایجنت ${this.agentId}: در حال تلاش برای کلیک روی عنصر: '${selector}'`);
        try {
            await page.waitForSelector(selector, { visible: true, timeout });
            await page.click(selector);
            console.log(`✅ ایجنت ${this.agentId}: کلیک روی '${selector}' با موفقیت انجام شد.`);
            return true;
        } catch (error) {
            console.error(`❌ ایجنت ${this.agentId}: خطای کلیک روی '${selector}': ${error.message}`);
            return false;
        }
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
                const sleepTime = Math.random() * 1.5 + 1;
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
     * فرآیند کامل کار روی یک URL را بر اساس گردش کار جدید (با حل کپچا) انجام می‌دهد.
     */
    async _processSingleLink(browserManager, url) {
        const page = await browserManager.start();
        if (!page) return;

        if (!await browserManager.navigate(page, url)) return;

        console.log("--- مرحله ۱: کلیک روی دکمه ادامه ---");
        const [popup] = await Promise.all([
            new Promise(resolve => page.once('popup', resolve)),
            browserManager.click(page, 'button#cntn'),
        ]).catch(() => [null]);

        if (popup) {
            console.log("✔️ پاپ‌آپ شناسایی شد. در حال بستن آن...");
            await popup.close();
        } else {
            console.warn("⚠️ پاپ‌آپی پس از کلیک اول باز نشد یا خطایی رخ داد.");
        }

        console.log("--- مرحله ۲: کلیک روی لینک 'کپچای ساده' ---");
        if (!await browserManager.click(page, 'a[href="?capt=def"]')) {
            console.error("❌ لینک 'کپچای ساده' پیدا نشد.");
            return;
        }

        try {
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
            console.log("✔️ صفحه کپچای ساده با موفقیت بارگذاری شد.");
        } catch (error) {
            console.error("❌ صفحه کپچای ساده بارگذاری نشد.");
            return;
        }

        let captchaSolved = false;
        const maxTries = 3;
        for (let i = 0; i < maxTries; i++) {
            console.log(`--- تلاش شماره ${i + 1} برای حل کپچا ---`);
            const captchaCode = await solveCaptcha(page, 'img#captchaShortlink_captcha_img');

            if (captchaCode) {
                const inputSelector = 'input#captchaShortlink_captcha';
                await page.type(inputSelector, captchaCode, { delay: 100 });
                await page.keyboard.press('Enter');

                try {
                    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
                    console.log("✔️ کپچا با موفقیت حل شد! در حال رفتن به صفحه نهایی...");
                    captchaSolved = true;
                    break;
                } catch (e) {
                    console.warn(`⚠️ تلاش شماره ${i + 1} ناموفق بود. احتمالاً کد کپچا اشتباه است.`);
                }
            } else {
                console.warn("⚠️ ماژول OCR نتوانست کدی را از تصویر استخراج کند.");
            }

            if (i === maxTries - 1) {
                console.error("❌ پس از چندین بار تلاش، حل کپچا ناموفق بود. این لینک رها می‌شود.");
                return;
            }
        }

        if (!captchaSolved) return;

        console.log("--- مرحله نهایی: تلاش برای یافتن و کلیک روی لینک دانلود ---");
        const finalButtonSelector = 'button.get-link';
        try {
            const [newTarget] = await Promise.all([
                new Promise(resolve => browserManager.browser.once('targetcreated', resolve)),
                browserManager.click(page, finalButtonSelector, 20000),
            ]);

            const newPage = await newTarget.page();
            if (newPage) {
                console.log("✔️ تب جدید برای دانلود باز شد. در حال بستن آن...");
                await newPage.close();
            }

            console.log("🎉🎉🎉 فرآیند با موفقیت به پایان رسید! 🎉🎉🎉");

        } catch (error) {
            console.error(`❌ دکمه نهایی "دریافت لینک" پیدا نشد. ${error.message}`);
        }
    }
}

// --- نقطه شروع اصلی برنامه ---
async function main() {
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
