import asyncio
from playwright.async_api import async_playwright
from fake_useragent import UserAgent

class BrowserManager:
    def __init__(self, agent_id, proxy=None):
        self.agent_id = agent_id
        self.proxy = proxy
        self.ua = UserAgent()

    async def start(self):
        self.p = await async_playwright().start()
        browser = await self.p.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        context = await browser.new_context(
            user_agent=self.ua.random,
            viewport={'width': 1280, 'height': 720}
        )
        page = await context.new_page()
        return browser, page, context

    async def navigate(self, page, url):
        await page.goto(url, wait_until='domcontentloaded', timeout=30000)

    async def click(self, page, selector):
        await page.wait_for_selector(selector, timeout=10000)
        await page.click(selector)

    async def close(self, browser):
        await browser.close()