import asyncio
import random
from core.browser_manager import BrowserManager

class TaskExecutor:
    def __init__(self, agent_id):
        self.agent_id = agent_id

    async def run_daily_tasks(self):
        print(f"Agent {self.agent_id}: Reading links from data/links.txt")
        try:
            with open('data/links.txt') as f:
                links = [l.strip() for l in f if l.strip()]
        except FileNotFoundError:
            print(f"❌ Agent {self.agent_id}: Error - data/links.txt not found.")
            return

        if not links:
            print(f"⚠️ Agent {self.agent_id}: data/links.txt is empty. No tasks to run.")
            return

        start = (self.agent_id - 1) * 50
        end = start + 50
        agent_links = links[start:end]

        if not agent_links:
            print(f"ℹ️ Agent {self.agent_id}: No links assigned for this agent ID. (Links count: {len(links)})")
            return

        print(f"ℹ️ Agent {self.agent_id}: Assigned {len(agent_links)} links.")

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