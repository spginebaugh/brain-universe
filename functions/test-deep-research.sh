#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Function to print colored section headers
print_header() {
  echo -e "\n${BLUE}========== $1 ==========${NC}\n"
}

# Function to print colored success messages
print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

# Function to print colored error messages
print_error() {
  echo -e "${RED}✗ $1${NC}"
}

# Function to print colored warning messages
print_warning() {
  echo -e "${YELLOW}! $1${NC}"
}

# The URL of your emulated function - using the emulator endpoint
FUNCTION_URL="http://127.0.0.1:5001/brainuniverse/us-central1/runDeepResearch"

# Check if the required API keys are set
check_api_keys() {
  print_header "Checking Required API Keys"
  
  local missing_keys=0
  
  # Check OpenAI API Key
  if [ -z "$OPENAI_API_KEY" ]; then
    print_warning "OPENAI_API_KEY is not set"
    read -p "Enter your OpenAI API key: " api_key
    export OPENAI_API_KEY="$api_key"
    missing_keys=$((missing_keys+1))
  else
    print_success "OPENAI_API_KEY is set"
  fi
  
  # Check Tavily API Key
  if [ -z "$TAVILY_API_KEY" ]; then
    print_warning "TAVILY_API_KEY is not set"
    read -p "Enter your Tavily API key: " api_key
    export TAVILY_API_KEY="$api_key"
    missing_keys=$((missing_keys+1))
  else
    print_success "TAVILY_API_KEY is set"
  fi
  
  # Check LangSmith API Key
  if [ -z "$LANGSMITH_API_KEY" ]; then
    print_warning "LANGSMITH_API_KEY is not set"
    read -p "Enter your LangSmith API key: " api_key
    export LANGSMITH_API_KEY="$api_key"
    missing_keys=$((missing_keys+1))
  else
    print_success "LANGSMITH_API_KEY is set"
  fi
  
  if [ $missing_keys -gt 0 ]; then
    print_warning "Set $missing_keys missing API keys"
  else
    print_success "All required API keys are set"
  fi
}

# Get an auth token from the emulator
get_auth_token() {
  print_header "Getting Auth Token"
  
  # Check if the auth-emulator-setup script exists
  if [ -f "scripts/auth-emulator-setup.ts" ]; then
    # Run the emulator token script
    echo "Running auth emulator setup script..."
    npx ts-node scripts/auth-emulator-setup.ts
  else
    echo "Running emulator token command..."
    npm run emulator-token
  fi
  
  print_warning "Copy the token from above and set it as an environment variable with:"
  echo -e "${YELLOW}export AUTH_TOKEN=\"your-token-here\"${NC}"
  
  # Check if AUTH_TOKEN is set
  if [ -z "$AUTH_TOKEN" ]; then
    print_warning "AUTH_TOKEN environment variable is not set"
    read -p "Would you like to set it now? (y/n): " set_token
    
    if [[ $set_token == "y" ]]; then
      read -p "Paste the token here: " token
      export AUTH_TOKEN="$token"
      print_success "AUTH_TOKEN has been set for this session"
    else
      print_warning "Proceeding without AUTH_TOKEN"
    fi
  else
    print_success "AUTH_TOKEN is already set"
  fi
}

# Create a test payload file for the deep research function
create_test_payload() {
  print_header "Creating Test Payload"
  
  cat > deep-research-payload.json << EOF
{
  "data": {
    "query": "The history and evolution of artificial intelligence",
    "numberOfChapters": 3
  }
}
EOF
  
  print_success "Created deep-research-payload.json"
}

# Test the runDeepResearch function
test_deep_research_function() {
  print_header "Testing runDeepResearch Function"
  
  # Check API keys
  check_api_keys
  
  # Create test payload
  create_test_payload
  
  # Run the test
  print_warning "Sending request to runDeepResearch function..."
  
  # Check if AUTH_TOKEN is set
  if [ -z "$AUTH_TOKEN" ]; then
    echo "No AUTH_TOKEN environment variable found."
    echo "Attempting to proceed without authentication (this will likely fail)..."
    
    # Proceed without auth token for demo purposes
    curl -v -X POST "${FUNCTION_URL}" \
      -H "Content-Type: application/json" \
      -d @deep-research-payload.json
  else
    # Send the request with authentication
    echo "Sending authenticated request to emulator endpoint..."
    curl -v -X POST "${FUNCTION_URL}" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${AUTH_TOKEN}" \
      -d @deep-research-payload.json
  fi
  
  echo ""
  print_success "Test request sent"
  print_warning "Check the Firebase Emulator UI for function logs"
}

# Main function
main() {
  print_header "Deep Research Function Emulator Test"
  
  # Get an auth token
  get_auth_token
  
  # Test the runDeepResearch function
  test_deep_research_function
  
  print_header "Test Completed"
  print_warning "Note: The research process runs in the background"
  print_warning "Check the Firebase Emulator UI logs to monitor progress"
}

# Run the main function
main 