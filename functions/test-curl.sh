#!/bin/bash

# The URL of your emulated function - using the emulator endpoint
FUNCTION_URL="http://127.0.0.1:5001/brainuniverse/us-central1/generateAIRoadmap"

# Check if AUTH_TOKEN was provided as an environment variable
if [ -z "$AUTH_TOKEN" ]; then
    echo "No AUTH_TOKEN environment variable found."
    echo "To get a token, run: npm run emulator-token"
    echo "Then set the environment variable: export AUTH_TOKEN=\"your-token-here\""
    echo ""
    echo "Attempting to proceed without authentication (this will likely fail)..."
    echo ""
    
    # Proceed without auth token for demo/teaching purposes
    curl -X POST "${FUNCTION_URL}" \
      -H "Content-Type: application/json" \
      -d @test-payload.json
else
    # Send the request with authentication
    echo "Sending authenticated request to emulator endpoint..."
    curl -X POST "${FUNCTION_URL}" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${AUTH_TOKEN}" \
      -d @test-payload.json
fi 