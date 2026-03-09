#!/bin/bash
# ============================================================
# Mock Extraction Test — 端到端测试 LLM 提取流程
#
# 用法:
#   bash scripts/mock-extraction-test.sh <building_id> <supplier_id>
#
# 前提: 已执行 mock-signed-supplier.sql 创建测试数据
# ============================================================

set -euo pipefail

BUILDING_ID="${1:?Usage: $0 <building_id> <supplier_id>}"
SUPPLIER_ID="${2:?Usage: $0 <building_id> <supplier_id>}"

# 从 Vercel 环境或手动设置
BASE_URL="${BASE_URL:-https://on.pylospay.com}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?Set SUPABASE_SERVICE_ROLE_KEY env var}"

echo "=============================="
echo "Extraction Flow Test"
echo "=============================="
echo "Base URL:    $BASE_URL"
echo "Building ID: $BUILDING_ID"
echo "Supplier ID: $SUPPLIER_ID"
echo ""

# ── Step 1: Trigger extraction ──
echo "── Step 1: Triggering extraction..."
TRIGGER_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/api/extraction/trigger" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d "{
    \"buildingId\": \"$BUILDING_ID\",
    \"supplierId\": \"$SUPPLIER_ID\",
    \"contractPdfUrl\": \"https://example.com/mock-contract.pdf\",
    \"websiteUrl\": \"https://www.unitestudents.com/london/tower-bridge\"
  }")

HTTP_CODE=$(echo "$TRIGGER_RESPONSE" | tail -1)
BODY=$(echo "$TRIGGER_RESPONSE" | sed '$d')

echo "HTTP $HTTP_CODE"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"

if [ "$HTTP_CODE" != "200" ]; then
  echo "Trigger failed!"
  exit 1
fi

echo ""
echo "Extraction jobs created"

# Extract job IDs from response
CONTRACT_JOB_ID=$(echo "$BODY" | python3 -c "import sys,json; jobs=json.load(sys.stdin)['jobs']; print(next(j['id'] for j in jobs if j['source']=='contract_pdf'))" 2>/dev/null || echo "")
WEBSITE_JOB_ID=$(echo "$BODY" | python3 -c "import sys,json; jobs=json.load(sys.stdin)['jobs']; print(next(j['id'] for j in jobs if j['source']=='website_crawl'))" 2>/dev/null || echo "")

echo "  contract_pdf job: $CONTRACT_JOB_ID"
echo "  website_crawl job: $WEBSITE_JOB_ID"
echo ""

# ── Step 2: Simulate contract_pdf callback ──
echo "── Step 2: Simulating contract_pdf extraction callback..."
sleep 1

CALLBACK_1=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/api/extraction/callback" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d "{
    \"buildingId\": \"$BUILDING_ID\",
    \"source\": \"contract_pdf\",
    \"jobId\": \"$CONTRACT_JOB_ID\",
    \"status\": \"success\",
    \"extractedFields\": {
      \"building_name\": { \"value\": \"Unite Students Tower Bridge\", \"confidence\": \"high\" },
      \"building_address\": { \"value\": \"100 Tower Bridge Road, London SE1 4TW\", \"confidence\": \"high\" },
      \"city\": { \"value\": \"London\", \"confidence\": \"high\" },
      \"country\": { \"value\": \"United Kingdom\", \"confidence\": \"high\" },
      \"postal_code\": { \"value\": \"SE1 4TW\", \"confidence\": \"high\" },
      \"commission_structure\": { \"value\": \"15% of first month rent for each confirmed booking\", \"confidence\": \"high\" },
      \"primary_contact_name\": { \"value\": \"James Wilson\", \"confidence\": \"high\" },
      \"primary_contact_email\": { \"value\": \"james.wilson@unitestudents.com\", \"confidence\": \"high\" },
      \"primary_contact_phone\": { \"value\": \"+44 20 7234 5678\", \"confidence\": \"medium\" },
      \"currency\": { \"value\": \"GBP\", \"confidence\": \"high\" },
      \"rent_period\": { \"value\": \"Weekly\", \"confidence\": \"high\" }
    }
  }")

HTTP_CODE=$(echo "$CALLBACK_1" | tail -1)
BODY=$(echo "$CALLBACK_1" | sed '$d')
echo "HTTP $HTTP_CODE"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo ""

# ── Step 3: Simulate website_crawl callback ──
if [ -n "$WEBSITE_JOB_ID" ]; then
  echo "── Step 3: Simulating website_crawl extraction callback..."
  sleep 1

  CALLBACK_2=$(curl -s -w "\n%{http_code}" \
    -X POST "$BASE_URL/api/extraction/callback" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -d "{
      \"buildingId\": \"$BUILDING_ID\",
      \"source\": \"website_crawl\",
      \"jobId\": \"$WEBSITE_JOB_ID\",
      \"status\": \"success\",
      \"extractedFields\": {
        \"description\": { \"value\": \"Located in the heart of London, Unite Students Tower Bridge offers premium student accommodation just minutes from major universities. Modern en-suite rooms and studios with stunning city views.\", \"confidence\": \"high\" },
        \"total_units\": { \"value\": 450, \"confidence\": \"medium\" },
        \"number_of_floors\": { \"value\": 18, \"confidence\": \"medium\" },
        \"elevator_available\": { \"value\": true, \"confidence\": \"high\" },
        \"key_amenities\": { \"value\": [\"Gym\", \"Laundry\", \"Study Room\", \"WiFi\", \"Security\", \"Bike Storage\"], \"confidence\": \"medium\" },
        \"price_min\": { \"value\": 225, \"confidence\": \"medium\" },
        \"price_max\": { \"value\": 395, \"confidence\": \"medium\" },
        \"cover_image\": { \"value\": \"https://www.unitestudents.com/images/tower-bridge-hero.jpg\", \"confidence\": \"high\" },
        \"unit_types_summary\": { \"value\": \"En-suite rooms (single/twin), Studios, Premium Studios with city view\", \"confidence\": \"medium\" },
        \"images\": { \"value\": [\"https://www.unitestudents.com/images/tb-1.jpg\", \"https://www.unitestudents.com/images/tb-2.jpg\", \"https://www.unitestudents.com/images/tb-3.jpg\"], \"confidence\": \"medium\" }
      }
    }")

  HTTP_CODE=$(echo "$CALLBACK_2" | tail -1)
  BODY=$(echo "$CALLBACK_2" | sed '$d')
  echo "HTTP $HTTP_CODE"
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
fi

echo ""
echo "=============================="
echo "✅ Extraction test complete!"
echo ""
echo "Next: Check the building in admin UI:"
echo "  $BASE_URL/admin/suppliers"
echo ""
echo "Or query directly:"
echo "  SELECT score, onboarding_status FROM buildings WHERE id = '$BUILDING_ID';"
echo "  SELECT field_values FROM building_onboarding_data WHERE building_id = '$BUILDING_ID';"
echo "=============================="
