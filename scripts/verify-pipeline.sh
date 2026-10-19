#!/usr/bin/env bash

# ==============================================================================
# PulseNOC - Local Pipeline Verification Script
# Verifies checks, tests, builds, and AI reviewer compliance before pushing.
# ==============================================================================

set -eo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${CYAN}======================================================================${NC}"
echo -e "${CYAN}🛡️  PulseNOC - Pipeline & Anti-Slop Verification${NC}"
echo -e "${CYAN}======================================================================${NC}"

CURRENT_BRANCH=$(git branch --show-current)
echo -e "${BLUE}ℹ️ Current branch: ${YELLOW}${CURRENT_BRANCH}${NC}"

if [ "$CURRENT_BRANCH" == "main" ]; then
  echo -e "${RED}⚠️  WARNING: You are on the 'main' branch!${NC}"
  echo -e "${RED}Per development rules, direct work on 'main' is forbidden.${NC}"
  echo -e "${YELLOW}Please create a dedicated branch (e.g. git checkout -b feature/my-feature).${NC}"
  echo ""
fi

# Step 1: Backend checks
echo -e "\n${BLUE}--- [1/5] Backend: Prisma Generate & Lint ---${NC}"
cd "$ROOT_DIR/backend"
npx prisma generate
npm run lint || {
  echo -e "${RED}❌ Backend lint failed! Please fix lint issues.${NC}"
  exit 1
}
echo -e "${GREEN}✓ Backend lint passed.${NC}"

# Step 2: Backend tests
echo -e "\n${BLUE}--- [2/5] Backend: Unit & Integration Tests ---${NC}"
npm run test -- --passWithNoTests || {
  echo -e "${RED}❌ Backend tests failed!${NC}"
  exit 1
}
echo -e "${GREEN}✓ Backend tests passed.${NC}"

# Step 3: Backend build
echo -e "\n${BLUE}--- [3/5] Backend: Production Build ---${NC}"
npm run build || {
  echo -e "${RED}❌ Backend build failed!${NC}"
  exit 1
}
echo -e "${GREEN}✓ Backend build passed.${NC}"

# Step 4: Frontend checks & build
echo -e "\n${BLUE}--- [4/5] Frontend: Lint & Production Build ---${NC}"
cd "$ROOT_DIR/frontend"
npm run lint || {
  echo -e "${RED}❌ Frontend lint failed! Please fix lint issues.${NC}"
  exit 1
}
npm run build || {
  echo -e "${RED}❌ Frontend build failed!${NC}"
  exit 1
}
echo -e "${GREEN}✓ Frontend checks & build passed.${NC}"

# Step 5: AI Reviewer dry-run
echo -e "\n${BLUE}--- [5/5] Anti-Slop & AI Review Gatekeeper ---${NC}"
cd "$ROOT_DIR"
node scripts/ai-reviewer.mjs || {
  echo -e "${RED}❌ AI Reviewer Gatekeeper found blocking issues!${NC}"
  exit 1
}

echo -e "\n${GREEN}======================================================================${NC}"
echo -e "${GREEN}✨ ALL PIPELINE CHECKS PASSED SUCCESSFULLY! Ready to push.${NC}"
echo -e "${GREEN}======================================================================${NC}"
