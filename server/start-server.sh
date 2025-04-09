#!/bin/bash
# start-server.sh - Script to start the server with diagnostic options
# Usage: ./start-server.sh [--debug] [--bind-all]

DEBUG=false
BIND_ALL=false

# Process command line arguments
for arg in "$@"
do
    case $arg in
        --debug)
        DEBUG=true
        shift
        ;;
        --bind-all)
        BIND_ALL=true
        shift
        ;;
        *)
        # Unknown option
        echo "Unknown option: $arg"
        echo "Usage: ./start-server.sh [--debug] [--bind-all]"
        exit 1
        ;;
    esac
done

# Set environment variables based on flags
if [ "$DEBUG" = true ]; then
    export DEBUG=mandarin-api:*,socket.io:*
    export LOG_LEVEL=debug
    echo "Debug mode enabled (DEBUG=$DEBUG, LOG_LEVEL=$LOG_LEVEL)"
fi

if [ "$BIND_ALL" = true ]; then
    export HOST="0.0.0.0"
    echo "Binding to all interfaces (HOST=$HOST)"
else
    echo "Binding to default interface"
fi

# Start the server
echo "Starting server..."
node server.js