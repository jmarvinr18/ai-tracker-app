#!/bin/bash

aws lambda invoke --function-name aiteam-prmj-tracker-bootstrap \
--cli-binary-format raw-in-base64-out \
--payload '{"action": "register_agent", "agent_id": "clarvo-rag-v1", "threshold_minutes": 2 }' \
--output table \
 --region ap-southeast-1 response.json \
 --debug