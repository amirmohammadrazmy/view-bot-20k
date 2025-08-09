const puppeteer = require('puppeteer');
const fs = require('fs/promises');
const path = require('path');
const UserAgent = require('user-agents');
const { fetchAndValidateProxies, getNextProxy } = require('./proxyManager');

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
            console.log(`⏳ ایجنت ${this.agentId}: در حال راه‌اندازی مرورگر پیشرفته Puppeteer...`);

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
                headless: true,
                args: args,
                // غیرفعال کردن برخی ویژگی‌های اتوماسیون که توسط سایت‌ها قابل شناسایی است
                ignoreDefaultArgs: ['--enable-automation'],
            });

            const page = await this.browser.newPage();

            // --- جعل کردن مشخصات مرورگر برای حداکثر ناشناسی ---
            await page.setUserAgent(this.userAgent);
            await page.setViewport({ width: 1280, height: 720 });

            // اجرای یک اسکریپت قبل از بارگذاری هر صفحه برای تغییر مشخصات مرورگر
            await page.evaluateOnNewDocument(() => {
                // جعل زبان مرورگر
                Object.defineProperty(navigator, 'language', { get: () => 'en-US' });
                Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
                // جعل پلاگین‌ها
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
                // جعل منطقه زمانی (Timezone)
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
            console.log(`✅ ایجنت ${this.agentId}: کلیک روی '${selector}' با موفقیت انجام شد.`);
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

            // برای هر تسک، یک پراکسی سالم جدید دریافت می‌کنیم.
            const proxy = await getNextProxy();
            if (!proxy) {
                console.error("❌ پراکسی سالمی برای ادامه کار پیدا نشد. تسک متوقف می‌شود.");
                // اگر پراکسی وجود نداشته باشد، می‌توانیم یا کار را متوقف کنیم یا بدون پراکسی ادامه دهیم.
                // در اینجا برای اطمینان کار را متوقف می‌کنیم.
                continue;
            }

            const bm = new BrowserManager(this.agentId, proxy);

            try {
                await this._processSingleLink(bm, url);
            } catch (error) {
                console.error(`🔥 خطای فاجعه‌بار برای ایجنت ${this.agentId} در URL ${url}: ${error.message}`);
            } finally {
                await bm.shutdown();
                // یک وقفه کوتاه و تصادفی (بین ۱ تا ۲.۵ ثانیه) برای جلوگیری از شناسایی شدن.
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

        // مرحله ۱: ناوبری اولیه
        if (!await browserManager.navigate(page, url)) return;

        // مرحله ۲: کلیک اول روی دکمه "برای ادامه اینجا کلیک کنید"
        console.log("--- مرحله ۱: کلیک روی دکمه ادامه ---");

        // همزمان با کلیک، منتظر باز شدن پاپ‌آپ می‌مانیم
        const [popup] = await Promise.all([
            new Promise(resolve => page.once('popup', resolve)),
            browserManager.click(page, 'button#cntn'),
        ]);

        if (popup) {
            console.log("✔️ پاپ‌آپ شناسایی شد. در حال بستن آن...");
            await popup.close();
        } else {
            console.warn("⚠️ پاپ‌آپی پس از کلیک اول باز نشد.");
        }

        // مرحله ۳: کلیک روی لینک "کپچای ساده"
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

        // TODO: فاز ۳ و ۴ در اینجا پیاده‌سازی خواهند شد
        // ۱. فراخوانی ماژول OCR برای حل کپچا
        // ۲. وارد کردن کد و تلاش مجدد در صورت نیاز
        // ۳. کلیک نهایی و مدیریت دانلود

        console.log("--- مراحل OCR و نهایی در فاز بعدی پیاده‌سازی خواهد شد ---");

        console.log(`✅ ایجنت ${this.agentId}: پردازش URL ${url} تا مرحله OCR با موفقیت انجام شد.`);
    }
}

// --- نقطه شروع اصلی برنامه ---
async function main() {
    // خواندن ID ایجنت از آرگومان‌های خط فرمان
    const args = process.argv.slice(2);
    const agentIdArg = args.find(arg => arg.startsWith('--agent-id='));
    const agentId = agentIdArg ? parseInt(agentIdArg.split('=')[1]) : (process.env.AGENT_ID || 1);

    // دیگر نیازی به فراخوانی اولیه پراکسی‌ها نیست، چون در لحظه نیاز دریافت می‌شوند.

    const executor = new TaskExecutor(agentId);
    await executor.runDailyTasks();
}

main().catch(error => {
    console.error('❌ خطای نهایی در اجرای برنامه:', error);
    process.exit(1);
});
