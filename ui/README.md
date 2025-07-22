# CoachNTT-MCP Dashboard UI

A modern, interactive web dashboard for CoachNTT-MCP that provides real-time visualization and control over your development sessions.

## Features

- **Real-time Session Monitoring**: Track active sessions, checkpoints, and handoffs
- **Context Usage Visualization**: Monitor token usage with circular and bar charts
- **Reality Check Dashboard**: View and fix code discrepancies with one click
- **Project Velocity Tracking**: Analyze development speed and identify blockers
- **Quick Actions**: Execute common tasks with floating action buttons
- **WebSocket Integration**: Real-time updates from the MCP server

## Prerequisites

- Node.js 18+ and npm
- CoachNTT-MCP server running on port 8080
- Modern web browser (Chrome, Firefox, Safari, Edge)

## Installation

1. Navigate to the UI directory:
```bash
cd ui
```

2. Install dependencies:
```bash
npm install
```

## Running the Dashboard

1. Start the CoachNTT-MCP server (from the project root):
```bash
npm start
```

2. In a new terminal, start the UI development server:
```bash
cd ui
npm run dev
```

3. Open your browser and navigate to:
```
http://localhost:5173
```

## Configuration

The UI connects to the WebSocket server at `ws://localhost:8080` by default. To change this:

1. Update the WebSocket URL in `src/App.tsx`:
```typescript
const ws = new WebSocketService('ws://your-server:port');
```

2. Ensure your MCP server's WebSocket is accessible at the configured address

## Components

### Session Overview
- Displays current session status and progress
- Quick checkpoint and handoff buttons
- Session duration and lines written tracking

### Context Monitor
- Real-time context usage visualization
- Phase breakdown showing token distribution
- Automatic warnings when approaching limits
- One-click optimization

### Reality Check
- Confidence score visualization
- List of active discrepancies
- Auto-fix capabilities for supported issues
- Severity-based color coding

### Project Tracker
- Session timeline view
- Velocity trend analysis
- Common blocker identification
- Progress report generation

### Quick Actions
- Floating action button for rapid access
- Context-sensitive action suggestions
- Expandable menu with tool descriptions

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory. Serve these files with any static web server.

## Development

### Project Structure
```
ui/
├── src/
│   ├── components/      # React components
│   ├── services/        # WebSocket and MCP tool services
│   ├── store/          # State management (Context API)
│   ├── types/          # TypeScript type definitions
│   └── styles/         # CSS and Tailwind styles
├── public/             # Static assets
└── package.json        # Dependencies and scripts
```

### Key Technologies
- **React 18**: UI framework
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **Vite**: Build tool
- **Recharts**: Data visualization
- **Lucide React**: Icons
- **RxJS**: Reactive programming for WebSocket streams

### Adding New MCP Tools

1. Update the WebSocket handler in `/src/websocket/handlers.ts`
2. Add the tool method to `/ui/src/services/mcp-tools.ts`
3. Create UI components that use the new tool
4. Update types in `/ui/src/types/index.ts` if needed

## Troubleshooting

### Connection Issues
- Verify the MCP server is running on port 8080
- Check browser console for WebSocket errors
- Ensure authentication token matches server configuration

### Missing Data
- Start a session in Claude Code first
- Check that all MCP tools are properly registered
- Verify WebSocket subscriptions in browser DevTools

### Performance
- The dashboard updates in real-time; high-frequency updates may impact performance
- Adjust the refresh interval in UI settings if needed
- Consider using production build for better performance

## License

Same as CoachNTT-MCP project