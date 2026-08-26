#!/bin/bash

aws lambda invoke --function-name aiteam-prmj-tracker-bootstrap \
--payload '{"action": "register_agent", "agent_id": "clarvo-rag-agent", "threshold_minutes": 2 }' \
--output table \
 --region us-east-1 response.json \
 --debug
