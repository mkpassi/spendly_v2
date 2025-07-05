#!/bin/bash

# ===========================================
# GOAL STRATEGY TEST RUNNER
# ===========================================

echo "🧪 Starting Goal Strategy Test Suite..."
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run SQL test
run_sql_test() {
    echo -e "${BLUE}📊 Running SQL Test Data Setup...${NC}"
    
    # Check if supabase CLI is available
    if ! command -v supabase &> /dev/null; then
        echo -e "${RED}❌ Supabase CLI not found. Please install it first.${NC}"
        exit 1
    fi
    
    # Run the SQL test file
    if supabase db reset --db-url "$DATABASE_URL" --with-seed; then
        echo -e "${GREEN}✅ Database reset successful${NC}"
    else
        echo -e "${RED}❌ Database reset failed${NC}"
        exit 1
    fi
    
    # Execute test data
    if psql "$DATABASE_URL" -f test_goal_strategy.sql; then
        echo -e "${GREEN}✅ Test data setup successful${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ Test data setup failed${NC}"
        ((TESTS_FAILED++))
    fi
}

# Function to test API endpoints
test_api_endpoints() {
    echo -e "${BLUE}🔧 Testing API Endpoints...${NC}"
    
    # Test chat-response endpoint
    echo "Testing chat-response endpoint..."
    RESPONSE=$(curl -s -X POST "$SUPABASE_URL/functions/v1/chat-response" \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
        -H "Content-Type: application/json" \
        -d '{"message": "I want to save $1000 for vacation", "user_id": "test_user"}')
    
    if echo "$RESPONSE" | grep -q "Goal created\|vacation"; then
        echo -e "${GREEN}✅ Chat response endpoint working${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ Chat response endpoint failed${NC}"
        echo "Response: $RESPONSE"
        ((TESTS_FAILED++))
    fi
    
    # Test parse-transactions endpoint
    echo "Testing parse-transactions endpoint..."
    RESPONSE=$(curl -s -X POST "$SUPABASE_URL/functions/v1/parse-transactions" \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
        -H "Content-Type: application/json" \
        -d '{"text": "I earned $2000 from freelancing", "user_id": "test_user"}')
    
    if echo "$RESPONSE" | grep -q "success\|income"; then
        echo -e "${GREEN}✅ Parse transactions endpoint working${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ Parse transactions endpoint failed${NC}"
        echo "Response: $RESPONSE"
        ((TESTS_FAILED++))
    fi
}

# Function to validate database state
validate_database() {
    echo -e "${BLUE}📊 Validating Database State...${NC}"
    
    # Check user settings
    SETTINGS_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM user_settings WHERE user_id = 'test_user';")
    if [ "$SETTINGS_COUNT" -eq 1 ]; then
        echo -e "${GREEN}✅ User settings exist${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ User settings missing${NC}"
        ((TESTS_FAILED++))
    fi
    
    # Check goals
    GOALS_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM goals WHERE user_id = 'test_user';")
    if [ "$GOALS_COUNT" -ge 3 ]; then
        echo -e "${GREEN}✅ Goals created ($GOALS_COUNT goals)${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ Goals missing (expected 3+, got $GOALS_COUNT)${NC}"
        ((TESTS_FAILED++))
    fi
    
    # Check transactions
    TRANSACTIONS_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM transactions WHERE user_id = 'test_user';")
    if [ "$TRANSACTIONS_COUNT" -ge 5 ]; then
        echo -e "${GREEN}✅ Transactions created ($TRANSACTIONS_COUNT transactions)${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ Transactions missing (expected 5+, got $TRANSACTIONS_COUNT)${NC}"
        ((TESTS_FAILED++))
    fi
    
    # Check goal allocations
    ALLOCATIONS_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM goal_allocations WHERE user_id = 'test_user';")
    if [ "$ALLOCATIONS_COUNT" -ge 3 ]; then
        echo -e "${GREEN}✅ Goal allocations created ($ALLOCATIONS_COUNT allocations)${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ Goal allocations missing (expected 3+, got $ALLOCATIONS_COUNT)${NC}"
        ((TESTS_FAILED++))
    fi
}

# Function to test budget calculations
test_budget_calculations() {
    echo -e "${BLUE}💰 Testing Budget Calculations...${NC}"
    
    # Test budget percentages
    BUDGET_QUERY="
    WITH budget_analysis AS (
        SELECT 
            SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
            SUM(CASE WHEN type = 'expense' AND budget_category = 'expenses' THEN amount ELSE 0 END) as actual_expenses,
            SUM(CASE WHEN type = 'expense' AND budget_category = 'savings' THEN amount ELSE 0 END) as actual_savings,
            SUM(CASE WHEN type = 'expense' AND budget_category = 'goals' THEN amount ELSE 0 END) as actual_goals
        FROM transactions WHERE user_id = 'test_user'
    )
    SELECT 
        CASE WHEN total_income > 0 THEN 'PASS' ELSE 'FAIL' END as income_check,
        CASE WHEN actual_goals > 0 THEN 'PASS' ELSE 'FAIL' END as goals_check,
        CASE WHEN actual_savings > 0 THEN 'PASS' ELSE 'FAIL' END as savings_check
    FROM budget_analysis;"
    
    BUDGET_RESULT=$(psql "$DATABASE_URL" -t -c "$BUDGET_QUERY")
    
    if echo "$BUDGET_RESULT" | grep -q "PASS.*PASS.*PASS"; then
        echo -e "${GREEN}✅ Budget calculations working${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ Budget calculations failed${NC}"
        echo "Result: $BUDGET_RESULT"
        ((TESTS_FAILED++))
    fi
}

# Function to test goal progress
test_goal_progress() {
    echo -e "${BLUE}🎯 Testing Goal Progress...${NC}"
    
    # Check if goals have allocated amounts
    PROGRESS_QUERY="
    SELECT COUNT(*) 
    FROM goals 
    WHERE user_id = 'test_user' 
    AND allocated_amount > 0;"
    
    PROGRESS_COUNT=$(psql "$DATABASE_URL" -t -c "$PROGRESS_QUERY")
    
    if [ "$PROGRESS_COUNT" -ge 1 ]; then
        echo -e "${GREEN}✅ Goal progress tracking working ($PROGRESS_COUNT goals with progress)${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ Goal progress tracking failed${NC}"
        ((TESTS_FAILED++))
    fi
}

# Function to generate test report
generate_report() {
    echo ""
    echo "========================================"
    echo -e "${BLUE}📋 TEST SUMMARY${NC}"
    echo "========================================"
    echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
    echo -e "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
        echo "Your goal strategy implementation is working correctly!"
    else
        echo -e "${RED}❌ Some tests failed.${NC}"
        echo "Please check the implementation and try again."
        exit 1
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  --sql-only     Run only SQL tests"
    echo "  --api-only     Run only API tests"
    echo "  --skip-setup   Skip database setup"
    echo ""
    echo "Environment Variables Required:"
    echo "  DATABASE_URL        - PostgreSQL connection string"
    echo "  SUPABASE_URL        - Supabase project URL"
    echo "  SUPABASE_ANON_KEY   - Supabase anonymous key"
    echo ""
    echo "Example:"
    echo "  export DATABASE_URL='postgresql://user:pass@localhost:5432/db'"
    echo "  export SUPABASE_URL='https://your-project.supabase.co'"
    echo "  export SUPABASE_ANON_KEY='your-anon-key'"
    echo "  ./run_tests.sh"
}

# Main execution
main() {
    # Parse command line arguments
    SQL_ONLY=false
    API_ONLY=false
    SKIP_SETUP=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            --sql-only)
                SQL_ONLY=true
                shift
                ;;
            --api-only)
                API_ONLY=true
                shift
                ;;
            --skip-setup)
                SKIP_SETUP=true
                shift
                ;;
            *)
                echo "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Check required environment variables
    if [ -z "$DATABASE_URL" ] || [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
        echo -e "${RED}❌ Missing required environment variables${NC}"
        show_usage
        exit 1
    fi
    
    # Run tests based on options
    if [ "$SKIP_SETUP" = false ]; then
        run_sql_test
    fi
    
    if [ "$API_ONLY" = false ]; then
        validate_database
        test_budget_calculations
        test_goal_progress
    fi
    
    if [ "$SQL_ONLY" = false ]; then
        test_api_endpoints
    fi
    
    generate_report
}

# Run main function with all arguments
main "$@" 