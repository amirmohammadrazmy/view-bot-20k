import httpx
import random

# آدرس API برای دریافت پراکسی از ProxyScrape.
# !!! توجه: این آدرس یک نمونه است. لطفاً آن را با آدرس API مخصوص خودتان از داشبورد ProxyScrape جایگزین کنید.
# شما می‌توانید پارامترهایی مانند کشور، نوع پراکسی و... را در این آدرس تنظیم کنید.
PROXY_API_URL = "https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=elite"

# لیست موقت برای نگهداری پراکسی‌ها در حافظه تا از درخواست‌های تکراری جلوگیری شود.
_proxy_cache = []
_proxy_index = 0

async def fetch_proxies():
    """
    پراکسی‌ها را از API دریافت کرده و در حافظه ذخیره می‌کند.
    """
    global _proxy_cache
    print("⏳ در حال دریافت لیست پراکسی‌های جدید از API...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(PROXY_API_URL, timeout=20)
            # در صورت بروز خطای HTTP، آن را نمایش داده و لیست خالی برمی‌گرداند.
            response.raise_for_status()

        proxies = response.text.strip().split('\r\n')
        if not proxies or not proxies[0]:
            print("⚠️ هشدار: API پراکسی لیست خالی برگرداند.")
            _proxy_cache = []
            return

        # پراکسی‌ها را با فرمت صحیح "http://ip:port" آماده می‌کنیم.
        _proxy_cache = [f"http://{p.strip()}" for p in proxies if p.strip()]
        random.shuffle(_proxy_cache) # لیست پراکسی‌ها را به هم می‌ریزیم تا توزیع تصادفی باشد.
        print(f"✅ تعداد {len(_proxy_cache)} پراکسی جدید با موفقیت دریافت و ذخیره شد.")

    except httpx.RequestError as e:
        print(f"❌ خطا در هنگام درخواست به API پراکسی: {e}")
        _proxy_cache = []
    except Exception as e:
        print(f"❌ خطای نامشخص هنگام دریافت پراکسی‌ها: {e}")
        _proxy_cache = []

def get_next_proxy():
    """
    یک پراکسی از لیست ذخیره شده برمی‌گرداند و به صورت چرخشی بین آن‌ها حرکت می‌کند.
    """
    global _proxy_index
    if not _proxy_cache:
        return None

    # انتخاب پراکسی به روش نوبتی (Round-robin)
    proxy = _proxy_cache[_proxy_index]
    _proxy_index = (_proxy_index + 1) % len(_proxy_cache)
    return proxy