# CoachNTT-MCP: The Essential MCP Server for Claude Code

A purpose-built Model Context Protocol (MCP) server designed specifically for Claude Code that transforms AI-assisted development through intelligent context management, automated checkpointing, and proven productivity patterns that deliver 50%+ efficiency gains.

## 🎯 Why CoachNTT-MCP for Claude Code?

When using Claude Code for development, context is everything. CoachNTT-MCP provides:

- **🧠 Intelligent Context Management**: Monitor and optimize token usage in real-time, preventing context overflow
- **💾 Smart Checkpointing**: Never lose progress with automated session saves and handoffs
- **✅ Reality Checking**: Ensure Claude's understanding matches actual code state
- **📊 Progress Tracking**: Visualize development velocity and identify bottlenecks
- **🚀 Proven Patterns**: Implement battle-tested workflows that maximize Claude Code efficiency
- **📝 Living Documentation**: Keep docs in sync with code automatically

## 📚 Documentation

### Getting Started
- **[Claude Code Guide](CLAUDE_CODE_GUIDE.md)** - Complete guide for Claude Code users
- [Deployment Guide](DEPLOYMENT.md) - Installation and configuration
- [Usage Examples](USAGE_EXAMPLES.md) - Real-world examples and workflows

### Technical References
- [AI Quick Reference](docs/reference/AI_QUICK_REFERENCE.md) - Complete technical reference
- [Implementation Guide](docs/guides/implementation-guide.md) - Step-by-step implementation

### Planning & Design
- [Product Requirements](docs/planning/PRD.md) - Detailed product specifications
- [UI Contract](docs/contracts/ui-contract.md) - Dashboard component specifications

### Integration Guides
- [UI Integration Guide](docs/guides/ui-integration-guide.md) - Backend-frontend integration patterns
- [Productivity Guide](docs/guides/productivity-guide.md) - Best practices and success patterns

## 🚀 Quick Start with Docker

### 1. Clone and Setup

```bash
# Clone repository
git clone https://github.com/yourusername/CoachNTT-MCP.git
cd CoachNTT-MCP

# Build and start with Docker
docker-compose up -d
```

### 2. Configure Claude Code

Add to your Claude Code settings:

```json
{
  "mcpServers": {
    "coachntt": {
      "command": "node",
      "args": ["/path/to/CoachNTT-MCP/dist/mcp-websocket-client.js"],
      "env": {
        "MCP_WEBSOCKET_URL": "ws://localhost:8180",
        "MCP_AUTH_TOKEN": "your-auth-token"
      }
    }
  }
}
```

### 3. Start Your First Session (Enhanced with Sub-Agents)

In Claude Code, simply ask:

```
Start a new development session for my React project. I need to build a user authentication system with an estimated 500 lines of code.
```

CoachNTT-MCP will automatically:
- Initialize a tracked session
- Monitor context usage with Context Guardian
- Suggest consistent naming with Symbol Contractor
- Create checkpoints at optimal moments
- Generate handoff documentation when needed

## 💡 Claude Code Benefits

### Context Efficiency
- **Track Every Token**: Know exactly how much context you're using
- **Smart Optimization**: Automatically compress context when approaching limits
- **Predictive Planning**: Estimate context needs before starting tasks

### Development Velocity
- **50% Faster Development**: Proven patterns that maximize Claude's capabilities
- **Reduced Rework**: Reality checks prevent drift between Claude's understanding and actual code
- **Optimal Checkpointing**: Never lose progress or context

### Session Continuity
- **Seamless Handoffs**: Continue exactly where you left off
- **Context Preservation**: Essential information carried between sessions
- **Progress Tracking**: Visualize what's been accomplished

### Code Quality
- **Automated Testing**: Ensure code works as Claude expects
- **Documentation Sync**: Keep docs aligned with implementation
- **Best Practices**: Built-in patterns for optimal code structure

## 🤖 Intelligent Sub-Agents (Coming Soon)

CoachNTT-MCP is expanding with specialized AI sub-agents that enhance Claude Code's capabilities:

### Symbol Contractor Agent
- **Consistent Naming**: Maintains naming conventions across your entire codebase
- **Smart Suggestions**: Context-aware naming based on your project's patterns
- **Refactoring Support**: Tracks symbol evolution and predicts impact

### Session Orchestrator Agent
- **Proactive Management**: Monitors context usage and suggests optimal checkpoints
- **Emergency Intervention**: Prevents context exhaustion before it happens
- **Session Planning**: Optimizes work distribution across sessions

### Context Guardian Agent
- **Smart Loading**: Pre-analyzes files to minimize token usage
- **Optimization Tips**: Suggests ways to reduce context consumption
- **Pattern Learning**: Remembers which operations are context-heavy

### Additional Agents
- **Documentation Curator**: Keeps docs in perfect sync with code
- **Test Coverage Sentinel**: Ensures comprehensive test coverage
- **Security Scanner**: Proactive vulnerability detection
- **Performance Profiler**: Identifies and resolves bottlenecks

These agents work seamlessly with Claude Code, providing specialized intelligence while preserving your context budget for actual development work.

## 🖥️ Interactive Dashboard

CoachNTT-MCP includes a modern web dashboard for real-time monitoring and control:

### Dashboard Features
- **Real-time Session Monitoring**: Track active sessions, checkpoints, and progress
- **Context Visualization**: Monitor token usage with interactive charts
- **Reality Check Panel**: View and fix code discrepancies with one click
- **Project Analytics**: Analyze development velocity and identify patterns
- **Quick Actions**: Execute common tasks through an intuitive UI

### Accessing the Dashboard

Once Docker is running, access the dashboard at:
- **Dashboard UI**: `http://localhost:5173`
- **WebSocket API**: `ws://localhost:8080`
- **Health Check**: `http://localhost:8081/health`

## 🏗️ Project Structure

```
CoachNTT-MCP/
├── docs/                    # Documentation
│   ├── reference/          # Technical references
│   ├── guides/            # Implementation guides
│   ├── contracts/         # API/UI contracts
│   └── planning/          # Project planning docs
├── src/                    # Source code
│   ├── core/              # Core MCP server
│   ├── tools/             # MCP tool implementations
│   ├── managers/          # Business logic managers
│   ├── websocket/         # WebSocket server
│   ├── interfaces/        # TypeScript interfaces
│   └── utils/             # Utilities
├── ui/                     # React dashboard
│   ├── src/               # UI source code
│   │   ├── components/    # React components
│   │   ├── services/      # API services
│   │   └── store/         # State management
│   └── public/            # Static assets
├── tests/                  # Test suite
├── scripts/               # Utility scripts
└── templates/             # Document templates
```

## 🔧 Core Features

### Session Management
- Intelligent session planning with context budgeting
- Automated checkpoint creation at natural boundaries
- Comprehensive handoff documentation
- Multi-session project tracking

### Context Monitoring
- Real-time token usage tracking
- Predictive exhaustion warnings
- Optimization suggestions
- Visual progress indicators

### Reality Checking
- Documentation validation against implementation
- Automated discrepancy detection
- One-click fixes for common issues
- Accuracy scoring and tracking

### Developer Dashboard
- Live session overview
- Context usage visualization
- Quick action panel
- Project timeline view

## 📊 Implementation Timeline

| Phase | Duration | Components |
|-------|----------|------------|
| Phase 1 | 2 days | Foundation & Setup |
| Phase 2 | 2 days | Session Management |
| Phase 3 | 2 days | Context Monitoring |
| Phase 4 | 2 days | Reality Checker |
| Phase 5 | 2 days | UI Integration |
| Phase 6-7 | 4 days | Testing Suite |
| Phase 8 | 2 days | Documentation & Deployment |

## 🎯 Success Metrics

- **Context Efficiency**: 40% reduction in exhaustion
- **Documentation Accuracy**: >90% reality alignment
- **Session Completion**: >85% success rate
- **Developer Velocity**: 50% improvement

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.

## 🔗 Links

- [Documentation Index](docs/README.md)
- [API Reference](docs/reference/AI_QUICK_REFERENCE.md)
- [Issue Tracker](https://github.com/yourusername/myworkflow-mcp/issues)