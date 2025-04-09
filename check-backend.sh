#!/bin/bash
# check-backend.sh - Script to check backend connectivity
# Usage: ./check-backend.sh [--host=hostname:port]

HOST="localhost:5000"
CURL_OPTS="-s -S"

# Process command line arguments
for arg in "$@"
do
    case $arg in
        --host=*)
        HOST="${arg#*=}"
        shift
        ;;
        --verbose)
        CURL_OPTS="-v"
        shift
        ;;
        --help)
        echo "Usage: ./check-backend.sh [--host=hostname:port] [--verbose]"
        echo "  --host=hostname:port  Specify the host to check (default: localhost:5000)"
        echo "  --verbose             Enable verbose curl output"
        echo "  --help                Display this help message"
        exit 0
        ;;
        *)
        # Unknown option
        echo "Unknown option: $arg"
        echo "Usage: ./check-backend.sh [--host=hostname:port] [--verbose]"
        exit 1
        ;;
    esac
done

echo "=== Backend Connectivity Check ==="
echo "Checking connectivity to $HOST"
echo

# Function to perform a curl request and display results
check_endpoint() {
    local endpoint=$1
    local description=$2
    local method=${3:-GET}
    local headers=${4:-}
    
    echo "Testing $description ($method $endpoint)..."
    
    # Construct the curl command
    cmd="curl $CURL_OPTS -X $method"
    
    # Add headers if provided
    if [ -n "$headers" ]; then
        for header in $headers; do
            cmd="$cmd -H \"$header\""
        done
    fi
    
    # Add the URL
    cmd="$cmd http://$HOST$endpoint"
    
    # Execute the command
    output=$(eval $cmd)
    status=$?
    
    if [ $status -eq 0 ]; then
        echo "✅ Success!"
        # Print the response in a readable format if it's JSON
        if [[ "$output" == "{"* ]]; then
            echo "$output" | python -m json.tool 2>/dev/null || echo "$output"
        else
            echo "$output"
        fi
    else
        echo "❌ Failed with status $status"
        echo "$output"
    fi
    echo
}

# Check health endpoint
check_endpoint "/api/health" "Health Endpoint"

# Check user connection test endpoint
check_endpoint "/api/users/connection-test" "User Connection Test"

# Check CORS preflight
check_endpoint "/api/users/connection-test" "CORS Preflight" "OPTIONS" "Origin: http://localhost:3000 Access-Control-Request-Method: GET Access-Control-Request-Headers: Authorization,Content-Type"

echo "=== Backend Connectivity Check Complete ==="