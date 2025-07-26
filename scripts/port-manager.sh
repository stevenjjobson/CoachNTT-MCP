#!/bin/bash

# Port Manager Script for CoachNTT-MCP
# Helps manage port conflicts and check port availability

set -e

# Default ports
WEBSOCKET_PORT="${MCP_WEBSOCKET_PORT:-8180}"
HEALTH_PORT="${MCP_HEALTH_PORT:-8181}"
UI_PORT="${MCP_UI_PORT:-5273}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a port is in use
check_port() {
    local port=$1
    local service=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${RED}✗${NC} Port $port ($service) is in use by:"
        lsof -Pi :$port -sTCP:LISTEN
        return 1
    else
        echo -e "${GREEN}✓${NC} Port $port ($service) is available"
        return 0
    fi
}

# Function to free a port
free_port() {
    local port=$1
    local service=$2
    
    echo "Checking port $port ($service)..."
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${YELLOW}Port $port is in use by:${NC}"
        lsof -Pi :$port -sTCP:LISTEN
        
        echo ""
        read -p "Do you want to kill the process using port $port? (y/N): " -n 1 -r
        echo ""
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Get PIDs using the port
            PIDS=$(lsof -Pi :$port -sTCP:LISTEN -t)
            
            # Kill the processes
            for PID in $PIDS; do
                echo "Killing process $PID..."
                kill -9 $PID 2>/dev/null || true
            done
            
            echo -e "${GREEN}✓${NC} Port $port has been freed"
        else
            echo "Skipping port $port"
        fi
    else
        echo -e "${GREEN}✓${NC} Port $port is already free"
    fi
}

# Function to show current status
show_status() {
    echo "=== CoachNTT-MCP Port Status ==="
    echo ""
    echo "Current Configuration:"
    echo "  WebSocket Port: $WEBSOCKET_PORT"
    echo "  Health Port: $HEALTH_PORT"
    echo "  UI Port: $UI_PORT"
    echo ""
    echo "Port Availability:"
    
    local all_available=true
    
    check_port $WEBSOCKET_PORT "WebSocket" || all_available=false
    check_port $HEALTH_PORT "Health Check" || all_available=false
    check_port $UI_PORT "UI Dashboard" || all_available=false
    
    echo ""
    
    if [ "$all_available" = true ]; then
        echo -e "${GREEN}All ports are available!${NC}"
    else
        echo -e "${RED}Some ports are in use. Run '$0 free' to free them.${NC}"
    fi
}

# Main script logic
case "${1:-status}" in
    check)
        echo "Checking port availability..."
        echo ""
        check_port ${2:-$WEBSOCKET_PORT} "${3:-Custom}"
        ;;
    
    free)
        if [ -n "$2" ]; then
            # Free specific port
            free_port $2 "Custom"
        else
            # Free all configured ports
            echo "Freeing CoachNTT-MCP ports..."
            echo ""
            free_port $WEBSOCKET_PORT "WebSocket"
            free_port $HEALTH_PORT "Health Check"
            free_port $UI_PORT "UI Dashboard"
        fi
        ;;
    
    status)
        show_status
        ;;
    
    help|--help|-h)
        echo "CoachNTT-MCP Port Manager"
        echo ""
        echo "Usage: $0 [command] [port]"
        echo ""
        echo "Commands:"
        echo "  status    Show current port configuration and availability (default)"
        echo "  check     Check if a specific port is available"
        echo "  free      Free port(s) by killing processes using them"
        echo "  help      Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0                  # Show status"
        echo "  $0 check 8080       # Check if port 8080 is available"
        echo "  $0 free             # Free all configured ports"
        echo "  $0 free 8080        # Free specific port"
        echo ""
        echo "Environment Variables:"
        echo "  MCP_WEBSOCKET_PORT  WebSocket server port (default: 8180)"
        echo "  MCP_HEALTH_PORT     Health check port (default: 8181)"
        echo "  MCP_UI_PORT         UI dashboard port (default: 5273)"
        ;;
    
    *)
        echo "Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac