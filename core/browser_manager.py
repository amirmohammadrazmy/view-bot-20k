import asyncio
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError
from fake_useragent import UserAgent

# --- کلاس مدیر مرورگر ---
# این کلاس مسئولیت تمام تعاملات با مرورگر (مانند باز کردن، ناوبری، کلیک و بستن) را بر عهده دارد.
# استفاده از این کلاس باعث می‌شود کدهای اصلی تمیزتر و مدیریت عملیات مرورگر متمرکز باشد.
class BrowserManager:
    def __init__(self, agent_id, proxy=None):
        """
        سازنده کلاس

        Args:
            agent_id (int): شناسه ایجنت برای استفاده در لاگ‌ها.
            proxy (str, optional): آدرس پراکسی برای استفاده در مرورگر. مثال: "http://user:pass@host:port"
        """
        self.agent_id = agent_id
        self.proxy = proxy
        # کتابخانه fake_useragent یک User-Agent تصادفی و معتبر برای ما ایجاد می‌کند تا شناسایی نشویم.
        # توجه: اولین اجرای این دستور ممکن است به دلیل نیاز به دانلود لیست، کمی طول بکشد.
        self.user_agent = UserAgent().random
        self.playwright = None
        self.browser = None
        print(f"✔️ ایجنت {self.agent_id}: مدیر مرورگر با User-Agent زیر ساخته شد:\n{self.user_agent}")

    async def start(self):
        """
        مرورگر را راه‌اندازی کرده و یک صفحه جدید ایجاد می‌کند.
        این متد باید در ابتدای هر تسک فراخوانی شود.
        """
        try:
            print(f"⏳ ایجنت {self.agent_id}: در حال راه‌اندازی Playwright و مرورگر Chromium...")
            self.playwright = await async_playwright().start()

            launch_options = {
                'headless': True,
                'args': ['--no-sandbox', '--disable-setuid-sandbox']
            }

            # اگر پراکسی در تنظیمات وجود داشت، آن را به مرورگر اعمال می‌کنیم.
            if self.proxy:
                launch_options['proxy'] = {
                    'server': self.proxy
                }
                print(f"ℹ️ ایجنت {self.agent_id}: از پراکسی {self.proxy} استفاده خواهد شد.")

            self.browser = await self.playwright.chromium.launch(**launch_options)

            context = await self.browser.new_context(
                user_agent=self.user_agent,
                viewport={'width': 1920, 'height': 1080}
            )

            page = await context.new_page()
            print(f"✅ ایجنت {self.agent_id}: مرورگر با موفقیت راه‌اندازی شد و صفحه جدید آماده است.")
            return page, context

        except Exception as e:
            print(f"❌ ایجنت {self.agent_id}: خطای بحرانی در زمان راه‌اندازی مرورگر: {e}")
            # در صورت بروز خطا، منابع را آزاد می‌کنیم.
            await self.shutdown()
            return None, None

    async def navigate(self, page, url):
        """
        به یک URL جدید در صفحه مشخص شده می‌رود.

        Args:
            page: نمونه صفحه‌ای که توسط متد start ایجاد شده.
            url (str): آدرس وب‌سایتی که باید باز شود.

        Returns:
            bool: در صورت موفقیت True و در غیر این صورت False را برمی‌گرداند.
        """
        print(f"⏳ ایجنت {self.agent_id}: در حال ناوبری به آدرس: {url}")
        try:
            # منتظر می‌مانیم تا ساختار اولیه صفحه (DOM) لود شود.
            await page.goto(url, wait_until='domcontentloaded', timeout=45000)
            print(f"✅ ایجنت {self.agent_id}: ناوبری به {url} با موفقیت انجام شد.")
            return True
        except PlaywrightTimeoutError:
            print(f"❌ ایجنت {self.agent_id}: خطای Timeout! صفحه {url} در زمان مشخص شده بارگذاری نشد.")
            return False
        except Exception as e:
            print(f"❌ ایجنت {self.agent_id}: خطای نامشخص در زمان ناوبری به {url}: {e}")
            return False

    async def click(self, page, selector, timeout=15000):
        """
        روی یک عنصر در صفحه کلیک می‌کند.

        Args:
            page: نمونه صفحه‌ای که در آن عملیات انجام می‌شود.
            selector (str): انتخابگر CSS یا XPath برای پیدا کردن عنصر.
            timeout (int): حداکثر زمان انتظار برای پیدا شدن عنصر (به میلی‌ثانیه).

        Returns:
            bool: در صورت موفقیت True و در غیر این صورت False را برمی‌گرداند.
        """
        print(f"⏳ ایجنت {self.agent_id}: در حال تلاش برای کلیک روی عنصر: '{selector}'")
        try:
            # ابتدا منتظر می‌مانیم تا عنصر در صفحه ظاهر شود.
            await page.wait_for_selector(selector, state='visible', timeout=timeout)
            # سپس روی آن کلیک می‌کنیم.
            await page.click(selector)
            print(f"✅ ایجنت {self.agent_id}: کلیک روی '{selector}' با موفقیت انجام شد.")
            return True
        except PlaywrightTimeoutError:
            print(f"❌ ایجنت {self.agent_id}: خطای Timeout! عنصر '{selector}' در زمان مشخص شده پیدا نشد.")
            return False
        except Exception as e:
            print(f"❌ ایجنت {self.agent_id}: خطای نامشخص در زمان کلیک روی '{selector}': {e}")
            return False

    async def check_for_captcha(self, page):
        """
        بررسی می‌کند که آیا در صفحه عنصر کپچا وجود دارد یا خیر.
        از یک timeout کوتاه استفاده می‌کند تا سرعت کلی فرآیند کم نشود.

        Returns:
            bool: اگر کپچا پیدا شود True، در غیر این صورت False.
        """
        # لیست انتخابگرهای رایج برای انواع کپچا
        captcha_selectors = [
            'iframe[src*="recaptcha"]',  # Google reCAPTCHA
            'iframe[src*="hcaptcha"]',   # hCaptcha
            'div#cf-turnstile',          # Cloudflare Turnstile
            'div.g-recaptcha',           # Div عمومی reCAPTCHA
        ]

        print(f"🕵️ ایجنت {self.agent_id}: در حال بررسی صفحه برای شناسایی کپچا...")
        for selector in captcha_selectors:
            try:
                # با یک timeout کوتاه بررسی می‌کنیم تا معطل نشویم.
                if await page.is_visible(selector, timeout=1000):
                    print(f"⚠️ ایجنت {self.agent_id}: کپچا با انتخابگر '{selector}' شناسایی شد!")
                    return True
            except PlaywrightTimeoutError:
                # اگر عنصر پیدا نشد، این خطا رخ می‌دهد که طبیعی است.
                continue
            except Exception:
                # خطاهای دیگر هم نادیده گرفته می‌شوند.
                continue

        return False

    async def shutdown(self):
        """
        مرورگر و Playwright را به درستی می‌بندد تا منابع آزاد شوند.
        این متد باید در انتهای هر تسک فراخوانی شود.
        """
        print(f"⏳ ایجنت {self.agent_id}: در حال بستن مرورگر و آزادسازی منابع...")
        try:
            if self.browser and self.browser.is_connected():
                await self.browser.close()
            if self.playwright:
                await self.playwright.stop()
            print(f"✅ ایجنت {self.agent_id}: مرورگر با موفقیت بسته شد.")
        except Exception as e:
            print(f"❌ ایجنت {self.agent_id}: خطایی در زمان بستن مرورگر رخ داد: {e}")