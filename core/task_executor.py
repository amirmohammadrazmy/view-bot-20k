import asyncio
import random
from core.browser_manager import BrowserManager

class TaskExecutor:
    def __init__(self, agent_id):
        self.agent_id = agent_id

    async def run_daily_tasks(self):
        with open('data/links.txt') as f:
            links = [l.strip() for l in f if l.strip()]

        start = (self.agent_id - 1) * 50
        end = start + 50
        agent_links = links[start:end]

        for url in agent_links:
            print(f"🔍 Agent {self.agent_id} processing: {url}")
            try:
                bm = BrowserManager(self.agent_id)
                browser, page, context = await bm.start()
                
                await bm.navigate(page, url)
                await asyncio.sleep(2)
                
                await bm.click(page, '#invisibleCaptchaShortlink')
                await asyncio.sleep(11)
                
                await bm.click(page, '.get-link')
                
                print(f"✅ Agent {self.agent_id} completed: {url}")
                await bm.close(browser)
                
            except Exception as e:
                print(f"❌ Agent {self.agent_id} error: {e}")
            
            await asyncio.sleep(random.uniform(2, 4))