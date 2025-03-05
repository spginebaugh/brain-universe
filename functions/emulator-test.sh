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

# Check if the emulators are running
check_emulators() {
  print_header "Checking Emulators"
  
  # Check if the functions emulator is running on port 5001
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:5001 > /dev/null; then
    print_success "Functions emulator is running"
  else
    print_error "Functions emulator is not running"
    print_warning "Start the emulators with: firebase emulators:start"
    exit 1
  fi
  
  # Check if the auth emulator is running on port 9099
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:9099 > /dev/null; then
    print_success "Auth emulator is running"
  else
    print_warning "Auth emulator may not be running. Some tests may fail."
  fi
}

# Get an auth token from the emulator
get_auth_token() {
  print_header "Getting Auth Token"
  
  npm run emulator-token
  
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

# Test the generateAIRoadmap function
test_roadmap_function() {
  print_header "Testing generateAIRoadmap Function"
  
  # Set the OpenAI API key if not already set
  if [ -z "$OPENAI_API_KEY" ]; then
    print_warning "OPENAI_API_KEY environment variable is not set"
    read -p "Would you like to set it now? (y/n): " set_api_key
    
    if [[ $set_api_key == "y" ]]; then
      read -p "Enter your OpenAI API key: " api_key
      export OPENAI_API_KEY="$api_key"
      print_success "OPENAI_API_KEY has been set for this session"
    else
      print_warning "Tests may fail without a valid OPENAI_API_KEY"
    fi
  else
    print_success "OPENAI_API_KEY is already set"
  fi
  
  # Run the test
  print_warning "Sending request to generateAIRoadmap function..."
  
  # Execute the test-curl.sh script
  ./test-curl.sh
  
  print_success "Test completed"
}

# Main function
main() {
  print_header "Firebase Functions Emulator Test"
  
  # Check if the emulators are running
  check_emulators
  
  # Get an auth token
  get_auth_token
  
  # Test the generateAIRoadmap function
  test_roadmap_function
  
  print_header "All Tests Completed"
}

# Run the main function
main 