#!/bin/bash

# Script to test file upload via API (JSON Mode)

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

TEST_FILE="data/data.txt"
API_URL="http://localhost:3000/api/process"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Testing File Upload (JSON Mode)${NC}"
echo -e "${BLUE}========================================${NC}"

# Check if file exists
if [ ! -f "$TEST_FILE" ]; then
    echo -e "${RED} Test file not found: $TEST_FILE${NC}" 
    # Create a dummy file if missing
    echo "case_id,activity\nA1,Start" > data/data.txt
fi

# 1. Read file content into a variable safely
# We use jq to escape the content for JSON safety
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required for this test script.${NC}"
    echo "Please install it: sudo apt-get install jq"
    exit 1
fi

CONTENT=$(cat "$TEST_FILE")
JSON_PAYLOAD=$(jq -n \
                  --arg fn "$TEST_FILE" \
                  --arg content "$CONTENT" \
                  '{fileName: $fn, textContent: $content, saveToMemory: false}')

echo -e "${BLUE}Sending JSON payload...${NC}"

# 2. Call API
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD" \
  "$API_URL")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo -e "${BLUE}HTTP Status: $HTTP_CODE${NC}"

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN} Success!${NC}" 
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
    echo -e "${RED} Failed!${NC}" 
    echo "$BODY"
fi