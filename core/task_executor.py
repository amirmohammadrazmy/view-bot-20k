import asyncio
import random
from core.browser_manager import BrowserManager
from core.proxy_manager import get_next_proxy

# --- کلاس اجرا کننده تسک ---
# این کلاس وظیفه مدیریت و اجرای تسک‌های اصلی هر ایجنت را بر عهده دارد.
class TaskExecutor:
    def __init__(self, agent_id):
        """
        سازنده کلاس

        Args:
            agent_id (int): شناسه ایجنت که برای تقسیم کار و لاگ‌گیری استفاده می‌شود.
        """
        self.agent_id = agent_id

    async def run_daily_tasks(self):
        """
        تسک‌های روزانه ایجنت را اجرا می‌کند.
        این متد، لیست لینک‌ها را می‌خواند، آن‌ها را بر اساس ID ایجنت تقسیم می‌کند و سپس پردازش می‌کند.
        """
        print(f"🚀 ایجنت {self.agent_id}: شروع به کار کرد.")

        # مرحله ۱: خواندن و آماده‌سازی لینک‌ها
        links = self._get_links_for_agent()
        if not links:
            # اگر لینکی برای پردازش وجود نداشته باشد، کار ایجنت تمام می‌شود.
            print(f"✅ ایجنت {self.agent_id}: هیچ لینکی برای پردازش وجود ندارد. کار تمام شد.")
            return

        print(f"ℹ️ ایجنت {self.agent_id}: تعداد {len(links)} لینک برای پردازش اختصاص داده شد.")

        # مرحله ۲: پردازش هر لینک در یک حلقه
        for i, url in enumerate(links):
            print(f"\n--- شروع پردازش لینک {i+1} از {len(links)} ---")
            print(f"🔗 ایجنت {self.agent_id}: در حال پردازش URL: {url}")

            # یک پراکسی از مدیر پراکسی دریافت می‌کنیم.
            current_proxy = get_next_proxy()

            # برای هر لینک یک مرورگر جدید با پراکسی مشخص باز می‌کنیم.
            bm = BrowserManager(self.agent_id, proxy=current_proxy)
            try:
                # اجرای فرآیند اصلی برای یک لینک
                await self._process_single_link(bm, url)
            except Exception as e:
                # خطاهای پیش‌بینی نشده در اینجا ثبت می‌شوند.
                print(f"🔥 خطای فاجعه‌بار برای ایجنت {self.agent_id} در URL {url}: {e}")
            finally:
                # در هر صورت (موفقیت یا شکست)، مرورگر باید بسته شود تا منابع آزاد شوند.
                await bm.shutdown()
                # یک وقفه تصادفی بین تسک‌ها برای جلوگیری از شناسایی شدن به عنوان ربات.
                sleep_time = random.uniform(3, 7)
                print(f"--- پایان پردازش لینک. استراحت برای {sleep_time:.2f} ثانیه ---")
                await asyncio.sleep(sleep_time)

        print(f"🎉 ایجنت {self.agent_id}: پردازش تمام لینک‌ها با موفقیت به پایان رسید.")

    def _get_links_for_agent(self):
        """
        لینک‌ها را از فایل می‌خواند و بر اساس شناسه ایجنت، بخشی از آن‌ها را برمی‌گرداند.
        """
        print(f"⏳ ایجنت {self.agent_id}: در حال خواندن لینک‌ها از فایل data/links.txt...")
        try:
            with open('data/links.txt', 'r', encoding='utf-8') as f:
                links = [line.strip() for line in f if line.strip()]
        except FileNotFoundError:
            print(f"❌ ایجنت {self.agent_id}: فایل data/links.txt پیدا نشد!")
            return []

        if not links:
            print(f"⚠️ ایجنت {self.agent_id}: فایل data/links.txt خالی است.")
            return []

        # تقسیم لینک‌ها بین ایجنت‌ها: هر ایجنت 50 لینک
        start_index = (self.agent_id - 1) * 50
        end_index = start_index + 50
        return links[start_index:end_index]

    async def _process_single_link(self, browser_manager, url):
        """
        فرآیند کامل باز کردن یک لینک، انجام کلیک‌ها و استخراج اطلاعات را برای یک URL انجام می‌دهد.
        """
        # مرحله ۱: راه‌اندازی مرورگر
        page, context = await browser_manager.start()
        if not page:
            print(f"❌ ایجنت {self.agent_id}: راه‌اندازی مرورگر با شکست مواجه شد. این تسک لغو می‌شود.")
            return

        # مرحله ۲: ناوبری به صفحه
        if not await browser_manager.navigate(page, url):
            print(f"❌ ایجنت {self.agent_id}: ناوبری به {url} شکست خورد. ادامه به لینک بعدی...")
            return

        await asyncio.sleep(random.uniform(2, 4))

        # مرحله ۳: کلیک اول
        if not await browser_manager.click(page, '#invisibleCaptchaShortlink'):
            print(f"❌ ایجنت {self.agent_id}: کلیک اول (#invisibleCaptchaShortlink) شکست خورد.")
            return
            
        print("⏳ ایجنت در حال انتظار برای لود شدن صفحه پس از کلیک اول (۱۱ ثانیه)...")
        await asyncio.sleep(11)

        # مرحله ۴: بررسی وجود کپچا قبل از کلیک نهایی
        if await browser_manager.check_for_captcha(page):
            # اگر کپچا پیدا شد، این تسک را رها کرده و به سراغ بعدی می‌رویم.
            return

        # مرحله ۵: کلیک دوم
        if not await browser_manager.click(page, '.get-link'):
            print(f"❌ ایجنت {self.agent_id}: کلیک دوم (.get-link) شکست خورد.")
            return

        print(f"✅ ایجنت {self.agent_id}: پردازش URL {url} با موفقیت کامل شد.")