#!/bin/bash

# Test script for Deep Research function
# This script calls the deep research cloud function with proper authentication

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

# Check if jq is installed
if ! command -v jq &> /dev/null; then
  print_error "jq is not installed. Please install it first."
  echo "On Ubuntu/Debian: sudo apt install jq"
  echo "On MacOS: brew install jq"
  exit 1
fi

# Check for authentication token
check_auth_token() {
  if [ -z "$AUTH_TOKEN" ]; then
    print_warning "AUTH_TOKEN environment variable is not set"
    print_warning "To get a token, run: npm run emulator-token"
    
    # Check if .env file exists and try to load it
    if [ -f "./.env" ]; then
      print_warning "Attempting to load AUTH_TOKEN from .env file..."
      export $(grep -v '^#' .env | grep AUTH_TOKEN)
      
      if [ -z "$AUTH_TOKEN" ]; then
        print_error "AUTH_TOKEN not found in .env file"
        read -p "Would you like to set it now? (y/n): " set_token
        
        if [[ $set_token == "y" ]]; then
          read -p "Paste the token here: " token
          export AUTH_TOKEN="$token"
          print_success "AUTH_TOKEN has been set for this session"
        else
          print_error "Cannot proceed without AUTH_TOKEN"
          exit 1
        fi
      else
        print_success "AUTH_TOKEN loaded from .env file"
      fi
    else
      print_error "No .env file found and no AUTH_TOKEN set"
      exit 1
    fi
  else
    print_success "AUTH_TOKEN is set"
  fi
}

print_header "Testing Deep Research Function"

# Check for auth token
check_auth_token

# Use the payload from deep-research-payload.json
PAYLOAD=$(cat ./deep-research-payload.json)

# Echo the request being made
print_header "Request Payload"
echo "$PAYLOAD" | jq .

# Set the correct URL based on local or production mode
if [ "$1" == "--local" ] || [ "$1" == "-l" ]; then
  # For local emulator testing
  print_header "Using Local Firebase Emulator"
  FUNCTION_URL="http://127.0.0.1:5001/brainuniverse/us-central1/runDeepResearch"
else
  # For production environment
  print_header "Using Production Firebase Function"
  FUNCTION_URL="https://us-central1-brain-universe.cloudfunctions.net/runDeepResearch"
fi

print_warning "Sending request to $FUNCTION_URL..."

# Make the request to the cloud function
RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "$PAYLOAD" \
  "$FUNCTION_URL")

# Print raw response
print_header "Raw Response"
echo "$RESPONSE"

# Check if response can be parsed as JSON
if echo "$RESPONSE" | jq . &> /dev/null; then
  print_header "Formatted Response"
  echo "$RESPONSE" | jq .
  
  # Try different JSON paths for success field based on Firebase function response structure
  # First check for the emulator format with .result property
  if echo "$RESPONSE" | jq -e '.result.success' &> /dev/null; then
    SUCCESS=$(echo "$RESPONSE" | jq -r '.result.success')
    SESSION_ID=$(echo "$RESPONSE" | jq -r '.result.sessionId')
    ERROR=$(echo "$RESPONSE" | jq -r '.result.error // "Unknown error"')
    print_warning "Using emulator response format (.result.success)"
  # Then check for direct success property (production format)
  elif echo "$RESPONSE" | jq -e '.success' &> /dev/null; then
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
    SESSION_ID=$(echo "$RESPONSE" | jq -r '.sessionId')
    ERROR=$(echo "$RESPONSE" | jq -r '.error // "Unknown error"')
    print_warning "Using production response format (.success)"
  # Finally check for data property (alternative format)
  elif echo "$RESPONSE" | jq -e '.data.success' &> /dev/null; then
    SUCCESS=$(echo "$RESPONSE" | jq -r '.data.success')
    SESSION_ID=$(echo "$RESPONSE" | jq -r '.data.sessionId')
    ERROR=$(echo "$RESPONSE" | jq -r '.data.error // "Unknown error"')
    print_warning "Using alternative response format (.data.success)"
  else
    SUCCESS="false"
    ERROR="Could not parse success status from response"
    print_warning "No known success field found in response"
  fi

  if [ "$SUCCESS" == "true" ]; then
    print_header "Result"
    print_success "Research process initiated successfully!"
    print_success "Session ID: $SESSION_ID"
    print_warning "Use the watch-logs.sh script to monitor the progress of this research session:"
    echo "$ ./watch-logs.sh"
  else
    print_header "Error"
    print_error "Research process failed: $ERROR"
    exit 1
  fi
else
  print_header "Error"
  print_error "Response is not valid JSON"
  print_warning "This could indicate an error with the Firebase emulator or authentication issues"
  print_warning "Make sure the emulator is running: firebase emulators:start"
  print_warning "And that you have a valid authentication token: npm run emulator-token"
  exit 1
fi