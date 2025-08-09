const Jimp = require('jimp');
const Tesseract = require('tesseract.js');

/**
 * یک بافر تصویر را برای خوانایی بهتر توسط OCR پیش‌پردازش می‌کند.
 * @param {Buffer} imageBuffer - بافر تصویر خام.
 * @returns {Promise<Buffer>} بافر تصویر پردازش شده.
 */
async function preprocessCaptcha(imageBuffer) {
    const image = await Jimp.read(imageBuffer);

    image
        .greyscale() // سیاه و سفید کردن
        .contrast(0.7) // افزایش کنتراست
        .normalize() // نرمال‌سازی رنگ‌ها
        .threshold({ max: 255, a: 180 }) // تبدیل به تصویر سیاه و سفید مطلق با آستانه ۱۸۰
        .resize(200, Jimp.AUTO); // تغییر اندازه به عرض ۲۰۰ پیکسل

    return image.getBufferAsync(Jimp.MIME_PNG);
}

/**
 * تلاش می‌کند تا کپچای عددی را از یک تصویر در صفحه وب حل کند.
 * @param {import('puppeteer').Page} page - نمونه صفحه Puppeteer.
 * @param {string} imageSelector - انتخابگر CSS برای تصویر کپچا.
 * @returns {Promise<string|null>} کد عددی استخراج شده یا در صورت شکست null.
 */
async function solveCaptcha(page, imageSelector) {
    try {
        console.log("--- شروع فرآیند OCR ---");
        const captchaElement = await page.waitForSelector(imageSelector, { visible: true, timeout: 5000 });
        if (!captchaElement) {
            console.error("❌ عنصر تصویر کپچا پیدا نشد.");
            return null;
        }

        // گرفتن اسکرین‌شات فقط از ناحیه کپچا
        const clip = await captchaElement.boundingBox();
        if (!clip) {
             console.error("❌ ابعاد تصویر کپچا برای اسکرین‌شات قابل محاسبه نیست.");
             return null;
        }
        const imageBuffer = await page.screenshot({ clip });

        // پیش‌پردازش تصویر
        console.log("⏳ در حال پیش‌پردازش تصویر کپچا...");
        const processedImageBuffer = await preprocessCaptcha(imageBuffer);

        // تشخیص متن با Tesseract.js
        console.log("🤖 در حال اجرای Tesseract OCR روی تصویر...");
        const { data: { text } } = await Tesseract.recognize(
            processedImageBuffer,
            'eng', // زبان انگلیسی
            {
                tessedit_char_whitelist: '0123456789', // فقط اعداد را تشخیص بده
                tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE, // حالت تشخیص: یک خط تنها
                dpi: 150,
            }
        );

        const ocrResult = text.trim();
        console.log(`✔️ نتیجه OCR: "${ocrResult}"`);

        if (!/^\d+$/.test(ocrResult)) {
            console.warn("⚠️ نتیجه OCR یک عدد معتبر نیست.");
            return null;
        }

        return ocrResult;
    } catch (error) {
        console.error(`❌ خطای پیش‌بینی نشده در فرآیند OCR: ${error.message}`);
        return null;
    }
}

module.exports = { solveCaptcha };
