import logging
import os
from datetime import datetime

def setup_logger(name):
    os.makedirs(f'agents/{name}/logs', exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(f'agents/{name}/logs/{datetime.now().strftime("%Y-%m-%d")}.log')
        ]
    )
    return logging.getLogger(name)