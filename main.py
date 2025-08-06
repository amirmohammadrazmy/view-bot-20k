import asyncio
import argparse
import os
from core.task_executor import TaskExecutor

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--agent-id", type=int, default=int(os.getenv('AGENT_ID', 1)))
    args = parser.parse_args()
    
    print(f"🚀 Starting Agent {args.agent_id}")
    executor = TaskExecutor(args.agent_id)
    await executor.run_daily_tasks()

if __name__ == "__main__":
    asyncio.run(main())