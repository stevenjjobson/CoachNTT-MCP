# Welcome to CoachNTT-MCP! 🚀

Your AI-powered development workflow assistant is ready to help you code more efficiently.

## 🖥️ Quick Start - View the UI Dashboard

To access the CoachNTT UI dashboard in your browser:

### For Windows Users (WSL):
1. **Open a WSL terminal** (Ubuntu/Debian)
2. **Navigate to the project:**
   ```bash
   cd /mnt/c/Users/Steve/OneDrive/Documents/Development/CoachNTT-MCP
   ```
3. **Start the UI services:**
   ```bash
   ./scripts/start-ui.sh
   ```
4. **Open your browser and go to:**
   ```
   http://localhost:5173
   ```

### For Mac/Linux Users:
1. **Open a terminal**
2. **Navigate to the project directory**
3. **Run:** `./scripts/start-ui.sh`
4. **Open:** `http://localhost:5173`

## 🎯 What You'll See

The UI dashboard provides:
- **Session Overview**: Current coding session status and metrics
- **Context Monitor**: Real-time token usage tracking
- **Agent Suggestions**: AI-powered recommendations (NEW in Session 17!)
- **Reality Checks**: Code state verification
- **Project Tracker**: Development velocity and progress

## ✨ New in Session 17

- **Real-time Agent Suggestions**: Get AI-powered coding recommendations
- **Accept/Reject Actions**: Execute suggested tools with one click
- **Priority-based Display**: Critical suggestions appear first
- **Three Intelligent Agents**:
  - Symbol Contractor: Naming consistency
  - Session Orchestrator: Checkpoint recommendations
  - Context Guardian: Usage optimization

## 🛠️ MCP Tools Available

Use these tools in Claude Code:
- `session_start`: Begin a new coding session
- `checkpoint_create`: Save progress checkpoints
- `context_status`: Check token usage
- `reality_check`: Verify code state
- `agent_run`: Get AI suggestions
- `quick_action`: Execute common tasks

## 🚨 Troubleshooting

**Port already in use?**
- The UI will automatically use port 5174 if 5173 is busy
- Check the console output for the actual URL

**Services won't start?**
```bash
# Kill existing processes
pkill -f node

# Try again
./scripts/start-ui.sh
```

**Database issues?**
- For fresh installs, the database is already configured
- For existing installs, you may need to reset: `rm data/myworkflow.db*`

## 📚 Documentation

- Session Planning: `/docs/planning/`
- UI Integration Guide: `/docs/guides/ui-integration-guide.md`
- Latest Updates: `/docs/planning/SESSION_17_HANDOFF.md`

## 💡 Pro Tips

1. **Monitor Context Usage**: Keep an eye on the context monitor to avoid exhaustion
2. **Use Checkpoints**: Create checkpoints at natural breaking points
3. **Follow Agent Suggestions**: The AI agents provide valuable optimization tips
4. **Reality Checks**: Run reality checks before major refactors

---

**Need Help?** Check the troubleshooting guide at `/TROUBLESHOOTING.md`

**Happy Coding!** 🎉