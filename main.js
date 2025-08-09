const puppeteer = require('puppeteer');
const fs = require('fs/promises');
const path = require('path');
const UserAgent = require('user-agents');
const { fetchAndValidateProxies, getNextProxy } = require('./proxyManager');

// --- کلاس مدیر مرورگر (مبتنی بر Puppeteer) ---
// این کلاس مسئولیت تمام تعاملات با مرورگر را بر عهده دارد.
class BrowserManager {
    constructor(agentId, proxy) {
        this.agentId = agentId;
        this.proxy = proxy;
        this.browser = null;
        // یک User-Agent واقعی و تصادفی برای مخفی کردن ربات ایجاد می‌کنیم.
        this.userAgent = new UserAgent({ deviceCategory: 'desktop' });
        console.log(`✔️ ایجنت ${this.agentId}: مدیر مرورگر با User-Agent زیر آماده شد:\n${this.userAgent.toString()}`);
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
            // User-Agent صفحه را برای جلوگیری از شناسایی شدن، تغییر می‌دهیم.
            await page.setUserAgent(this.userAgent.toString());
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
     * فرآیند کامل کار روی یک URL را بر اساس گردش کار جدید انجام می‌دهد.
     */
    async _processSingleLink(browserManager, url) {
        const page = await browserManager.start();
        if (!page) return;

        // مرحله ۱: ناوبری اولیه
        if (!await browserManager.navigate(page, url)) return;

        // مرحله ۲: کلیک اول روی دکمه "برای ادامه اینجا کلیک کنید"
        console.log("--- مرحله ۱: کلیک روی دکمه ادامه ---");
        if (!await browserManager.click(page, 'button#cntn')) return;

        // منتظر می‌مانیم تا صفحه جدید پس از کلیک بارگذاری شود.
        try {
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
            console.log("✔️ صفحه جدید با موفقیت بارگذاری شد.");
        } catch (error) {
            console.error("❌ صفحه جدید پس از کلیک اول بارگذاری نشد. احتمالاً لینک خراب است.");
            return;
        }

        // مرحله ۳: کلیک دوم روی دکمه کپچا
        console.log("--- مرحله ۲: کلیک روی دکمه کپچا ---");
        if (!await browserManager.click(page, 'button#invisibleCaptchaShortlink')) return;

        console.log("⏳ ایجنت در حال انتظار (۵ ثانیه) برای بررسی احتمال ظهور کپچای فعال...");
        await new Promise(res => setTimeout(res, 5000));

        // مرحله ۴: بررسی هوشمند کپچا
        if (await browserManager.checkForCaptcha(page)) {
            console.log("نتیجه: کپچای فعال شناسایی شد. این لینک رها می‌شود.");
            return;
        }
        console.log("✔️ کپچای فعالی مشاهده نشد. ادامه فرآیند...");

        // مرحله ۵: کلیک نهایی برای دریافت لینک دانلود
        console.log("--- مرحله ۳: تلاش برای یافتن و کلیک روی لینک نهایی ---");
        const finalLinkSelector = 'a ::-p-text(دریافت لینک)';
        try {
            await page.waitForSelector(finalLinkSelector, { visible: true, timeout: 20000 });
            // به جای کلیک، آدرس لینک را استخراج می‌کنیم که هدف نهایی است.
            const downloadLink = await page.$eval(finalLinkSelector, el => el.href);
            console.log("🎉🎉🎉 لینک نهایی با موفقیت پیدا شد! 🎉🎉🎉");
            console.log(`🔗 لینک دانلود: ${downloadLink}`);

            // میتوانید اینجا لینک را در یک فایل ذخیره کنید
            // await fs.appendFile('download_links.txt', downloadLink + '\n');

        } catch (error) {
            console.error(`❌ لینک نهایی "دریافت لینک" پیدا نشد. ${error.message}`);
            return;
        }

        console.log(`✅ ایجنت ${this.agentId}: پردازش URL ${url} با موفقیت کامل شد.`);
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
