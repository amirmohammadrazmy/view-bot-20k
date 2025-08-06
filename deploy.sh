#!/bin/bash
railway login
railway init --name "agent-$AGENT_ID" --yes
railway variables set AGENT_ID=$AGENT_ID
railway up --detach