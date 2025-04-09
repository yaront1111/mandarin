#!/bin/bash
# check-cors.sh - Script to test CORS configuration
# Usage: ./check-cors.sh [--host=hostname:port]

HOST="localhost:5000"
CURL_OPTS="-s -S"
VERBOSE=false

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
        VERBOSE=true
        shift
        ;;
        --help)
        echo "Usage: ./check-cors.sh [--host=hostname:port] [--verbose]"
        echo "  --host=hostname:port  Specify the host to check (default: localhost:5000)"
        echo "  --verbose             Enable verbose curl output"
        echo "  --help                Display this help message"
        exit 0
        ;;
        *)
        # Unknown option
        echo "Unknown option: $arg"
        echo "Usage: ./check-cors.sh [--host=hostname:port] [--verbose]"
        exit 1
        ;;
    esac
done

echo "=== CORS Configuration Check ==="
echo "Checking CORS for $HOST"
echo

# Test different origins
ORIGINS=(
    "http://localhost:3000"
    "https://example.com"
    "https://mandarin.com"
    "null"  # For local file testing
)

# Test different endpoints
ENDPOINTS=(
    "/api/users/connection-test"
    "/api/auth/test-connection"
    "/api/health"
)

for endpoint in "${ENDPOINTS[@]}"
do
    echo "Testing CORS for endpoint: $endpoint"
    echo "==================================="
    
    for origin in "${ORIGINS[@]}"
    do
        echo "Testing with Origin: $origin"
        
        # Perform OPTIONS request to test preflight
        if [ "$VERBOSE" = true ]; then
            echo "Preflight OPTIONS request:"
        fi
        
        cmd="curl $CURL_OPTS -X OPTIONS -H \"Origin: $origin\" -H \"Access-Control-Request-Method: GET\" -H \"Access-Control-Request-Headers: Authorization,Content-Type\" -D - http://$HOST$endpoint -o /dev/null"
        
        output=$(eval $cmd)
        status=$?
        
        if [ $status -eq 0 ]; then
            if [ "$VERBOSE" = true ]; then
                echo "OPTIONS Response Headers:"
                echo "$output"
            fi
            
            # Check for CORS headers in response
            if echo "$output" | grep -q "Access-Control-Allow-Origin"; then
                allowed_origin=$(echo "$output" | grep "Access-Control-Allow-Origin" | sed 's/^.*: //')
                echo "✅ Access-Control-Allow-Origin: $allowed_origin"
                
                # Check if this origin is allowed
                if [[ "$allowed_origin" == "$origin" || "$allowed_origin" == "*" ]]; then
                    echo "   Origin is allowed"
                else
                    echo "❌ Origin is not allowed"
                fi
            else
                echo "❌ Missing Access-Control-Allow-Origin header"
            fi
            
            # Check for other important headers
            if echo "$output" | grep -q "Access-Control-Allow-Methods"; then
                methods=$(echo "$output" | grep "Access-Control-Allow-Methods" | sed 's/^.*: //')
                echo "✅ Access-Control-Allow-Methods: $methods"
            else
                echo "❌ Missing Access-Control-Allow-Methods header"
            fi
            
            if echo "$output" | grep -q "Access-Control-Allow-Headers"; then
                headers=$(echo "$output" | grep "Access-Control-Allow-Headers" | sed 's/^.*: //')
                echo "✅ Access-Control-Allow-Headers: $headers"
            else
                echo "❌ Missing Access-Control-Allow-Headers header"
            fi
        else
            echo "❌ Failed with status $status"
            echo "$output"
        fi
        
        echo
    done
    
    echo
done

echo "=== CORS Configuration Check Complete ==="
echo
echo "RECOMMENDATION:"
echo "  - If CORS is configured correctly, you should see Access-Control-Allow-Origin"
echo "    headers in all responses."
echo "  - If some origins are not allowed but should be, update your CORS configuration"
echo "    in the server middleware."
echo "  - For development, setting Access-Control-Allow-Origin: * is often simplest."
echo "  - For production, allow only specific origins that need access to your API."