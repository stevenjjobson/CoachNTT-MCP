# Playwright MCP Server Context for Claude Code

## Overview

The Playwright MCP (Model Context Protocol) server enables Claude Code to control web browsers programmatically through Microsoft's Playwright automation framework. This server provides 24 browser automation tools that allow for comprehensive web interaction, testing, and scraping capabilities.

## Installation

The server has already been added to Claude Code using:
```bash
claude mcp add playwright npx @playwright/mcp@latest
```

This command modified the `~/.claude.json` configuration file to include the Playwright MCP server.

## Key Characteristics

- **Author**: Microsoft
- **License**: Apache License 2.0
- **Repository**: [github.com/microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)
- **Docker Image**: `mcp/playwright` (recommended for safer execution)
- **Protocol**: stdio-based MCP server

## Core Concepts

### What is an MCP Server?

MCP servers extend Claude's capabilities by providing access to external tools and systems. The Playwright server specifically enables browser automation, allowing Claude to:
- Navigate websites
- Interact with page elements
- Extract information
- Perform automated testing
- Take screenshots and snapshots

### Browser Automation Workflow

1. **Initialize**: Install browser if needed (`browser_install`)
2. **Navigate**: Go to target URL (`browser_navigate`)
3. **Interact**: Click, type, select elements using various tools
4. **Extract**: Take snapshots or screenshots for analysis
5. **Clean up**: Close tabs/browser when done

## Available Tools Categories

### Navigation & Control
- `browser_navigate` - Navigate to URLs
- `browser_navigate_back/forward` - Browser history navigation
- `browser_close` - Close the browser
- `browser_resize` - Adjust browser window size

### Tab Management
- `browser_tab_new` - Open new tabs
- `browser_tab_list` - List all open tabs
- `browser_tab_select` - Switch between tabs
- `browser_tab_close` - Close specific tabs

### Element Interaction
- `browser_click` - Click elements (single/double click)
- `browser_type` - Type text into fields
- `browser_select_option` - Select dropdown options
- `browser_hover` - Hover over elements
- `browser_drag` - Drag and drop operations
- `browser_press_key` - Keyboard input

### Information Extraction
- `browser_snapshot` - Capture accessibility tree (preferred for automation)
- `browser_take_screenshot` - Visual screenshots
- `browser_console_messages` - Get console output
- `browser_network_requests` - Monitor network activity

### Advanced Operations
- `browser_evaluate` - Execute JavaScript
- `browser_file_upload` - Upload files
- `browser_handle_dialog` - Handle alerts/prompts
- `browser_wait_for` - Wait for conditions

## Important Usage Notes

### Element References
Most interaction tools require two parameters:
- `element`: Human-readable description for permission
- `ref`: Exact element reference from page snapshot

### Tool Permissions
Tools are categorized by their impact:
- **Read-only**: Snapshot, hover, resize
- **Destructive**: Click, type, navigate (may modify page state)
- **External interaction**: All browser tools interact with external websites

### Best Practices
1. Always use `browser_snapshot` before interacting with elements to get current page state
2. Use element references (`ref`) from snapshots for accurate targeting
3. Handle potential dialogs/popups with `browser_handle_dialog`
4. Monitor console/network for debugging with respective tools

## Example Workflow

```markdown
1. Navigate to target site
2. Take snapshot to analyze page structure
3. Identify elements to interact with
4. Perform actions (click, type, etc.)
5. Extract data or verify results
6. Close browser/tabs when complete
```

## Docker Alternative (Recommended)

For enhanced security, run the MCP server in Docker:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "mcp/playwright"
      ]
    }
  }
}
```

This isolates the browser automation from your system, providing better security when interacting with external websites.

## Common Use Cases

- **Web Scraping**: Extract data from websites
- **Automated Testing**: Test web applications
- **Form Submission**: Fill and submit web forms
- **Screenshot Capture**: Document web pages
- **Monitoring**: Check website changes or availability

The Playwright MCP server essentially gives Claude Code the ability to browse and interact with the web as a human would, but programmatically and at scale.