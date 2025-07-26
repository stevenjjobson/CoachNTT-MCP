# CoachNTT-MCP Claude Code Guide

## Overview

CoachNTT-MCP is designed specifically to enhance your Claude Code experience by solving the most common challenges in AI-assisted development:

- **Context Overflow**: Never lose work due to hitting token limits
- **Session Continuity**: Seamlessly continue where you left off
- **Code Drift**: Ensure Claude's understanding matches your actual code
- **Progress Tracking**: Know exactly what's been accomplished

## Installation & Setup

### 1. Start CoachNTT-MCP with Docker

```bash
git clone https://github.com/yourusername/CoachNTT-MCP.git
cd CoachNTT-MCP
docker-compose up -d
```

### 2. Configure Claude Code

Find your Claude Code settings file:
- macOS/Linux: `~/.config/claude/settings.json`
- Windows: `%APPDATA%\claude\settings.json`

Add the MCP server configuration:

```json
{
  "mcpServers": {
    "coachntt": {
      "command": "node",
      "args": ["/absolute/path/to/CoachNTT-MCP/dist/mcp-websocket-client.js"],
      "env": {
        "MCP_WEBSOCKET_URL": "ws://localhost:8080",
        "MCP_AUTH_TOKEN": "your-auth-token"
      }
    }
  }
}
```

**Note**: The MCP server now runs inside Docker and communicates via WebSocket, allowing remote connections and better integration with the dashboard.

### 3. Verify Connection

Start a new Claude Code conversation and ask:

```
Can you check if the CoachNTT MCP server is connected?
```

## Core Commands

### Session Management

```
# Start a new session
"Let's start a new development session for [project name]"
"I need to build [feature] which will be about [X] lines of code"

# Check session status
"What's our current session status?"
"Show me the session overview"

# Create checkpoint
"Let's create a checkpoint here"
"Save our progress before moving to [next task]"

# End session with handoff
"I need to stop here, can you create a handoff?"
"Create a handoff document for tomorrow"
```

### Context Management

```
# Check usage
"How much context have we used?"
"What's our token usage breakdown?"

# Predict needs
"Will we have enough context to complete [task]?"
"How much context will [feature] require?"

# Optimize context
"We're running low on context, can you optimize?"
"Compress our context to free up space"
```

### Reality Checking

```
# Quick check
"Do a quick reality check"
"Verify our current state"

# Comprehensive check
"Run a comprehensive reality check"
"Check if everything is in sync"

# Fix discrepancies
"Fix any issues found in the reality check"
"Apply automatic fixes"
```

### Documentation

```
# Generate docs
"Generate API documentation"
"Create a README for this project"

# Update docs
"Update the documentation to match our changes"
"Sync the docs with current implementation"

# Check status
"Are the docs up to date?"
"Check documentation sync status"
```

## Best Practices

### 1. Start Every Session

Always begin with a session start to enable tracking:

```
You: I'm working on a React component library today.

Claude: I'll start a development session for your React component library. 
        How many components are you planning to build?
```

### 2. Regular Checkpoints

Create checkpoints at natural boundaries:

```
You: We've finished the Button and Card components. Let's checkpoint.

Claude: Creating checkpoint...
        ✓ Components completed: Button, Card
        ✓ Tests: 24/24 passing
        ✓ Git commit created
```

### 3. Monitor Context Usage

Check context regularly to avoid surprises:

```
You: How are we doing on context?

Claude: Context status:
        - Used: 45,000 / 100,000 (45%)
        - Current rate: ~1,000 tokens per component
        - Remaining capacity: ~10 more components
```

### 4. Reality Checks Before Major Changes

Ensure alignment before big refactors:

```
You: Before we refactor the state management, let's do a reality check.

Claude: Running comprehensive reality check...
        ✓ All files verified
        ✓ Tests passing
        ✓ No discrepancies found
        Safe to proceed with refactoring!
```

## Advanced Workflows

### Multi-Session Projects

For large projects spanning multiple sessions:

```
# Session 1: Foundation
You: Start a new project for an e-commerce admin dashboard.
     First session will be the basic structure.

# Session 2: Continue from handoff
You: I have a handoff from yesterday's session on the admin dashboard.
     Let's continue with the product management features.

# Session 3: Feature addition
You: Continuing the admin dashboard, today we'll add analytics.
```

### Skeleton-First Development

Maximize context efficiency:

```
You: Let's use skeleton-first development for this API.
     Start with minimal implementations.

Claude: I'll create lightweight skeletons first:
        - Route definitions only
        - Interface types  
        - Empty function bodies
        - TODO comments
        
        This approach uses ~20% of normal context.
```

### Test-Driven with Context Awareness

```
You: Let's do TDD but watch our context usage.

Claude: I'll write test specifications first (low context),
        then implement incrementally. I'll checkpoint after
        each test suite passes.
```

## Troubleshooting

### Connection Issues

If Claude can't connect to CoachNTT:

1. Ensure Docker is running: `docker-compose ps`
2. Check the WebSocket URL in settings.json
3. Verify the server is healthy: `curl http://localhost:8081/health`
4. Check Docker logs: `docker-compose logs -f`
5. Ensure the auth token matches your Docker configuration

### Session Recovery

If a session ends unexpectedly:

```
You: I lost my session, can we recover?

Claude: I'll check for recent sessions...
        Found session from 2 hours ago:
        - Project: react-components
        - Progress: 60% complete
        - Last checkpoint: "Completed Button component"
        
        Would you like to resume from the checkpoint?
```

### Context Optimization

When approaching limits:

```
You: We're at 90% context usage but still have work to do.

Claude: Running context optimization...
        - Removed redundant explanations
        - Compressed code examples
        - Archived completed sections
        
        ✓ Freed up 25,000 tokens (25%)
        You now have space to continue!
```

## Tips for Maximum Productivity

1. **Be Specific About Scope**: Tell Claude how big the task is upfront
2. **Use Natural Checkpoints**: Component boundaries, feature completions
3. **Trust Reality Checks**: They prevent costly misunderstandings
4. **Leverage Handoffs**: Even for short breaks - context is preserved
5. **Watch Token Velocity**: If usage spikes, ask Claude to be more concise

## Integration with VS Code

While using Claude Code with VS Code:

1. Keep VS Code open to see real-time file changes
2. Use VS Code's git interface to review Claude's commits  
3. Run tests in VS Code terminal while Claude writes code
4. Use VS Code's diff view to verify Claude's changes

## Example: Full Feature Development

Here's a complete example of building a feature with CoachNTT-MCP:

```
You: I need to add user notifications to my app. Email and in-app.
     Probably 300-400 lines. Let's start a session.

Claude: Starting notification feature session...
        ✓ Session initialized
        ✓ Estimated checkpoints: 3
        ✓ Context budget allocated
        
        I'll implement:
        1. Notification models and types
        2. Email service integration
        3. In-app notification system
        4. Tests and documentation
        
        Let's start with the data models...

[... after implementing models ...]

You: How's our progress?

Claude: Progress update:
        - Completed: Data models, email service
        - Context used: 35% (on track)
        - Tests: 8/8 passing
        - Next: In-app notifications
        
        Good time for a checkpoint?

You: Yes, checkpoint and then continue.

Claude: ✓ Checkpoint saved
        ✓ Commit: "feat: Add notification models and email service"
        
        Continuing with in-app notifications...

[... after completing feature ...]

You: Great! Let's finish up with a final reality check.

Claude: Final reality check:
        ✓ All files verified
        ✓ Tests: 18/18 passing  
        ✓ Documentation updated
        ✓ Type checking passes
        
        Feature complete! Creating final checkpoint...
        
        Summary:
        - Lines written: 387
        - Test coverage: 92%
        - Context used: 78%
        - Total time: 1 session
        
        The notification system is ready to deploy!
```

## Getting Help

- **In Claude Code**: "How do I use CoachNTT to [task]?"
- **GitHub Issues**: Report bugs or request features
- **Documentation**: Check `/docs` folder for detailed guides

Remember: CoachNTT-MCP is your development productivity copilot. Use it to maintain momentum, prevent context loss, and ensure quality throughout your Claude Code sessions.