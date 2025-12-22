#!/bin/bash

# 1. Read the CSV content safely
# This reads the file and escapes it for JSON
CONTENT=$(awk '{printf "%s\\n", $0}' /home/ubuntu/example/car_ins_demo.csv | sed 's/"/\\"/g')

# 2. Send as JSON
curl -v -X POST http://localhost:3111/api/process \
  -H "Content-Type: application/json" \
  -d "{
    \"fileName\": \"car_ins_demo.csv\",
    \"textContent\": \"$CONTENT\",
    \"saveToMemory\": false,
    \"approvedMapping\": [] 
  }"