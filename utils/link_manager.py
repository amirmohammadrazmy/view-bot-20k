class LinkManager:
    @staticmethod
    def get_agent_links(agent_id):
        with open('data/links.txt') as f:
            links = [l.strip() for l in f if l.strip()]
        start = (agent_id - 1) * 50
        return links[start:start+50]