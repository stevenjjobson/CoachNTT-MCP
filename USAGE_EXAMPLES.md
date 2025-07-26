# CoachNTT-MCP Usage Examples for Claude Code

This guide shows how to use CoachNTT-MCP to enhance your Claude Code development sessions with intelligent context management and productivity optimization.

## Quick Start with Claude Code

### 1. Starting a Development Session

In Claude Code, simply ask:

```
I need to implement a user authentication system for my React app. 
Can you start a new development session? I estimate it will be about 500 lines of code.
```

Claude will use CoachNTT-MCP to:
- Start a tracked session
- Set up context monitoring
- Plan optimal checkpoints

Behind the scenes, this executes:
```javascript
{
  "tool": "session_start",
  "params": {
    "project_name": "my-awesome-app",
    "session_type": "feature",
    "estimated_scope": {
      "lines_of_code": 500,
      "test_coverage": 200,
      "documentation": 100
    },
    "context_budget": 50000
  }
}
```

### 2. Monitoring Context Usage

Ask Claude at any time:

```
How much context have we used so far in this session?
```

Claude will respond with:
```
You've used 12,500 tokens out of 50,000 (25%). Here's the breakdown:
- Planning: 3,000 tokens
- Implementation: 8,000 tokens  
- Testing: 1,500 tokens

Usage trend is stable. At this rate, you have enough context for the full implementation.
```

### 3. Creating Checkpoints

When you reach a natural stopping point, tell Claude:

```
Let's create a checkpoint here. We've completed the user authentication module 
and database schema setup.
```

CoachNTT-MCP will:
- Save session state
- Create a git commit
- Document progress
- Prepare for potential handoff

You'll see:
```
✓ Checkpoint created successfully
- Components completed: User authentication, Database schema
- Lines written: 250
- Tests passing: 15
- Context used: 25%
- Commit: "feat: Add user authentication and database schema"
```

## Common Claude Code Workflows

### Feature Development Workflow

Here's a typical conversation flow with Claude Code using CoachNTT-MCP:

```
You: I need to build a shopping cart feature for my e-commerce platform. 
     Can we start a new session? I think it'll be around 1000 lines.

Claude: I'll start a new development session for your e-commerce platform shopping cart feature.
        
        ✓ Session started
        - Project: e-commerce-platform
        - Type: feature
        - Estimated: 1,000 lines of code
        - Context budget: 100,000 tokens
        - Estimated checkpoints: 4

        What specific functionality do you need for the shopping cart?

You: I need add/remove items, quantity updates, price calculations, and 
     discount code support.

[... Claude implements features ...]

You: How's our context usage looking?

Claude: Current context status:
        - Used: 35,000 / 100,000 tokens (35%)
        - Phase breakdown:
          • Planning: 5,000 tokens
          • Implementation: 25,000 tokens
          • Discussion: 5,000 tokens
        - Trend: Stable
        
        You have plenty of context remaining for tests and documentation.

You: Great! Let's checkpoint here before moving to the discount system.

Claude: Creating checkpoint...
        
        ✓ Checkpoint saved
        - Completed: Cart CRUD operations, quantity management, price calculations
        - Lines written: 400
        - Tests passing: 20
        - Git commit: "feat: Add shopping cart with price calculations"
        
        Ready to continue with the discount code system!
```

### Bug Fix Workflow

Quick, focused sessions for bug fixes:

```
You: I need to fix a race condition in our payment processing. 
     Let's start a bugfix session.

Claude: Starting bugfix session...
        
        ✓ Bugfix session started
        - Context budget: 20,000 tokens (optimized for focused work)
        - Estimated scope: ~100 lines
        
        I'll also track this as a blocker. Can you describe the race condition?

You: Multiple payment requests can process simultaneously for the same order.

Claude: I see the issue. Let me implement a fix with proper locking...
        
        [... implements mutex solution ...]
        
        ✓ Fix implemented
        - Added mutex lock to payment processor
        - Added test for concurrent requests
        - Lines changed: 75
        - All tests passing
        
        The race condition is now prevented. Should I create a checkpoint?

You: Yes, and mark the blocker as resolved.

Claude: ✓ Checkpoint created
        ✓ Blocker resolved: "Added mutex lock to prevent race condition"
        ✓ Git commit: "fix: Prevent race condition in payment processing"
```

### Documentation Sync Workflow

```javascript
// 1. Check documentation status
const status = await tools.doc_status({
  file_paths: [
    "./README.md",
    "./docs/API.md",
    "./docs/ARCHITECTURE.md"
  ]
});

// 2. Update outdated docs
for (const doc of status) {
  if (doc.sync_status === "outdated") {
    await tools.doc_update({
      file_path: doc.path,
      update_type: "sync",
      context: {
        recent_changes: doc.recent_changes,
        last_update: doc.last_update
      }
    });
  }
}
```

## Advanced Features

### Context Optimization

```javascript
// When approaching context limit
const prediction = await tools.context_predict({
  session_id: session.id,
  planned_tasks: [
    "Implement search functionality",
    "Add caching layer",
    "Write integration tests"
  ]
});

if (prediction.remaining_capacity < prediction.estimated_need) {
  // Optimize context
  const optimization = await tools.context_optimize({
    session_id: session.id,
    target_reduction: 0.3,  // Free up 30% 
    preserve_functionality: true
  });
  
  console.log(`Freed up ${optimization.tokens_saved} tokens`);
}
```

### Project Analytics

```javascript
// Get velocity metrics
const velocity = await tools.velocity_analyze({
  project_id: "proj_456",
  time_window: 7 * 24 * 60 * 60 * 1000  // Last 7 days
});

// Generate progress report
const report = await tools.progress_report({
  project_id: "proj_456",
  time_range: {
    start: Date.now() - 30 * 24 * 60 * 60 * 1000,
    end: Date.now()
  },
  include_predictions: true
});
```

### Custom Actions

```javascript
// Define a custom action sequence
await tools.custom_action({
  name: "full_test_suite",
  description: "Run all tests and generate coverage report",
  tool_sequence: [
    {
      tool: "reality_check",
      params: { check_type: "quick", focus_areas: ["tests"] }
    },
    {
      tool: "doc_generate",
      params: { doc_type: "architecture" },
      condition: "if tests pass"
    },
    {
      tool: "session_checkpoint",
      params: { commit_message: "test: Full test suite pass" }
    }
  ]
});

// Execute custom action
await tools.quick_action({
  action_id: "full_test_suite",
  params: { session_id: session.id }
});
```

## WebSocket Integration

### Connecting to WebSocket Server

```javascript
const ws = new WebSocket('ws://localhost:8180');

// Authenticate
ws.send(JSON.stringify({
  type: 'authenticate',
  auth: 'myworkflow-secret'
}));

// Subscribe to updates
ws.send(JSON.stringify({
  type: 'subscribe',
  topic: 'session.status',
  params: { session_id: 'session_123' }
}));

// Handle events
ws.on('message', (data) => {
  const event = JSON.parse(data);
  if (event.type === 'event') {
    console.log(`${event.topic}:`, event.data);
  }
});
```

### Available WebSocket Topics

- `session.status` - Real-time session updates
- `context.status` - Context usage monitoring
- `reality.checks` - Discrepancy notifications
- `project.status` - Project-level changes
- `project.velocity` - Velocity metric updates
- `documentation.status` - Documentation sync status

## Error Handling

```javascript
try {
  const result = await tools.session_start({
    project_name: "my-project",
    session_type: "feature",
    estimated_scope: {
      lines_of_code: 1000,
      test_coverage: 500,
      documentation: 200
    }
  });
} catch (error) {
  if (error.message.includes('Active session exists')) {
    // Handle existing session
    const handoff = await tools.session_handoff({
      session_id: existingSessionId
    });
  } else {
    console.error('Failed to start session:', error);
  }
}
```

## Best Practices

1. **Always create checkpoints** before major changes
2. **Monitor context usage** to avoid hitting limits
3. **Use reality checks** to validate state consistency
4. **Generate documentation** as you code, not after
5. **Report blockers** immediately for better analytics
6. **Create handoffs** even for short breaks

## CLI Usage

```bash
# Start MCP server
npm start

# Run in development mode
npm run dev

# Run tests
npm test

# Check types
npm run typecheck

# Lint code
npm run lint
```

## Claude Code Integration

### Configuration

Add CoachNTT-MCP to your Claude Code settings:

```json
{
  "mcpServers": {
    "coachntt": {
      "command": "node",
      "args": ["/path/to/CoachNTT-MCP/dist/index.js"],
      "env": {
        "NODE_ENV": "production",
        "AUTO_CHECKPOINT": "true"
      }
    }
  }
}
```

### Example Conversations

#### Starting a Project

```
You: I'm starting a new Next.js project for a blog platform. Can you help me 
     set up the initial structure with TypeScript and Tailwind?

Claude: I'll help you set up a Next.js blog platform. Let me start a development session 
        to track our progress.
        
        ✓ Session started: next-blog-platform
        - Type: feature
        - Estimated: 800 lines for initial setup
        - Context budget: 100,000 tokens
        
        I'll create:
        1. Next.js project with TypeScript
        2. Tailwind CSS configuration
        3. Basic blog structure (posts, pages, layouts)
        4. Type definitions
        
        Let's begin...
```

#### Mid-Session Reality Check

```
You: Before we continue, can you do a reality check? I want to make sure 
     everything is properly set up.

Claude: Running reality check...
        
        ✓ Reality Check Complete
        - Files verified: 23
        - Tests status: 12/12 passing
        - Type checking: No errors
        - Documentation: In sync
        - Confidence score: 95%
        
        Minor finding:
        - The README needs updating with the new API endpoints
        
        Everything else looks good! Shall I update the README now?
```

### With Custom AI Client

```python
import mcp

client = mcp.Client("localhost:8180")

# Use any tool
result = await client.call_tool(
    "session_start",
    {
        "project_name": "python-analytics",
        "session_type": "feature",
        "estimated_scope": {
            "lines_of_code": 800,
            "test_coverage": 400,
            "documentation": 150
        }
    }
)
```