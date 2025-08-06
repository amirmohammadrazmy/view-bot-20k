import aiohttp
import asyncio
import random

class ProxyManager:
    def __init__(self):
        self.proxies = [
            "104.248.90.211:3128",
            "103.151.246.38:8080",
            "185.132.133.65:80"
        ]

    async def get_proxy(self):
        return {"server": f"http://{random.choice(self.proxies)}"}