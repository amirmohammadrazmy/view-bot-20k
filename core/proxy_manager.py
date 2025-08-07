import httpx
import random
import asyncio

# آدرس API برای دریافت پراکسی از ProxyScrape.
# !!! توجه: این آدرس یک نمونه است. لطفاً آن را با آدرس API مخصوص خودتان از داشبورد ProxyScrape جایگزین کنید.
PROXY_API_URL = "https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=elite"

# آدرسی که برای تست سلامت پراکسی‌ها استفاده می‌شود.
VALIDATION_URL = "https://2ad.ir/"
VALIDATION_TIMEOUT = 10  # 10 ثانیه

# لیست موقت برای نگهداری پراکسی‌های سالم و تست‌شده.
_proxy_cache = []
_proxy_index = 0

async def _validate_proxy(proxy):
    """
    یک پراکسی را با اتصال به VALIDATION_URL تست می‌کند.
    """
    try:
        async with httpx.AsyncClient(proxies=proxy, timeout=VALIDATION_TIMEOUT) as client:
            # از متد HEAD استفاده می‌کنیم که سریع‌تر است چون محتوای صفحه را دانلود نمی‌کند.
            response = await client.head(VALIDATION_URL)
        # اگر کد وضعیت موفقیت‌آمیز بود (مثلا 200 OK)، پراکسی سالم است.
        if 200 <= response.status_code < 400:
            return proxy
    except (httpx.RequestError, httpx.TimeoutException):
        # هرگونه خطای شبکه یا تایم‌اوت به معنی خراب بودن پراکسی است.
        pass
    except Exception:
        # سایر خطاهای پیش‌بینی نشده
        pass
    return None

async def fetch_and_validate_proxies():
    """
    پراکسی‌ها را از API دریافت کرده، آن‌ها را تست می‌کند و پراکسی‌های سالم را در حافظه ذخیره می‌نماید.
    """
    global _proxy_cache, _proxy_index
    print("⏳ در حال دریافت لیست پراکسی‌های خام از API...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(PROXY_API_URL, timeout=20)
            response.raise_for_status()

        raw_proxies = response.text.strip().split('\r\n')
        if not raw_proxies or not raw_proxies[0]:
            print("⚠️ هشدار: API پراکسی لیست خالی برگرداند.")
            _proxy_cache = []
            return

        formatted_proxies = [f"http://{p.strip()}" for p in raw_proxies if p.strip()]
        print(f"✔️ تعداد {len(formatted_proxies)} پراکسی خام دریافت شد. شروع به تست سلامت پراکسی‌ها...")

        # تست کردن تمام پراکسی‌ها به صورت موازی برای افزایش سرعت
        validation_tasks = [_validate_proxy(p) for p in formatted_proxies]
        validated_results = await asyncio.gather(*validation_tasks)

        # فقط پراکسی‌هایی که تست را با موفقیت گذرانده‌اند (None نیستند) به لیست نهایی اضافه می‌شوند.
        healthy_proxies = [p for p in validated_results if p is not None]

        if not healthy_proxies:
            print("❌ تمام پراکسی‌های دریافت شده تست سلامت را رد کردند.")
            _proxy_cache = []
            return

        _proxy_cache = healthy_proxies
        _proxy_index = 0
        random.shuffle(_proxy_cache)
        print(f"✅ تست کامل شد. تعداد {len(_proxy_cache)} پراکسی سالم و آماده استفاده است.")

    except Exception as e:
        print(f"❌ خطای فاجعه‌بار هنگام دریافت و تست پراکسی‌ها: {e}")
        _proxy_cache = []

def get_next_proxy():
    """
    یک پراکسی سالم از لیست ذخیره شده برمی‌گرداند.
    """
    global _proxy_index
    if not _proxy_cache:
        return None

    proxy = _proxy_cache[_proxy_index]
    _proxy_index = (_proxy_index + 1) % len(_proxy_cache)
    return proxy