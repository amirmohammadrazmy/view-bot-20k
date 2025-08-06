import asyncio
import argparse
import os
from core.task_executor import TaskExecutor

# --- نقطه شروع اصلی برنامه (Entrypoint) ---
async def main():
    """
    این تابع اصلی برنامه است که هنگام اجرای اسکریپت فراخوانی می‌شود.
    وظیفه آن، خواندن آرگومان‌های ورودی (ID ایجنت) و شروع به کار TaskExecutor است.
    """
    # یک پارسر برای خواندن آرگومان‌های خط فرمان (command-line) ایجاد می‌کنیم.
    parser = argparse.ArgumentParser(description="ربات پردازشگر لینک‌ها")

    # آرگومان agent-id-- را تعریف می‌کنیم. این آرگومان مشخص می‌کند که کدام ایجنت باید اجرا شود.
    # مقدار پیش‌فرض آن از متغیر محیطی AGENT_ID خوانده می‌شود و اگر آن هم وجود نداشت، ۱ خواهد بود.
    parser.add_argument(
        "--agent-id",
        type=int,
        default=int(os.getenv('AGENT_ID', 1)),
        help="شناسه ایجنت برای اجرا (مثلاً ۱، ۲، ۳ یا ۴)"
    )
    args = parser.parse_args()
    
    # یک نمونه از TaskExecutor با شناسه مشخص شده ایجاد کرده و تسک‌های روزانه آن را اجرا می‌کنیم.
    executor = TaskExecutor(agent_id=args.agent_id)
    await executor.run_daily_tasks()

if __name__ == "__main__":
    # این بخش تضمین می‌کند که کد فقط زمانی اجرا شود که فایل مستقیماً فراخوانی شده باشد (و نه به عنوان ماژول).
    # asyncio.run(main()) تابع main ناهمزمان (async) ما را اجرا می‌کند.
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 برنامه توسط کاربر متوقف شد.")