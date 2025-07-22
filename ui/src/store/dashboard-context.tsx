import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { DashboardState, WSMessage } from '../types';
import { WebSocketService } from '../services/websocket';
import { MCPToolsService } from '../services/mcp-tools';

interface DashboardContextValue {
  state: DashboardState;
  ws: WebSocketService;
  tools: MCPToolsService;
  dispatch: React.Dispatch<DashboardAction>;
}

type DashboardAction =
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_AUTHENTICATED'; payload: boolean }
  | { type: 'SET_SESSION'; payload: any }
  | { type: 'UPDATE_CONTEXT'; payload: any }
  | { type: 'ADD_CHECKPOINT'; payload: any }
  | { type: 'SET_DISCREPANCIES'; payload: any[] }
  | { type: 'SET_PROJECT'; payload: any }
  | { type: 'SET_VELOCITY'; payload: any }
  | { type: 'SET_ACTIONS'; payload: any[] }
  | { type: 'UPDATE_UI_STATE'; payload: Partial<DashboardState['uiState']> };

const initialState: DashboardState = {
  connected: false,
  authenticated: false,
  recentCheckpoints: [],
  activeDiscrepancies: [],
  suggestedActions: [],
  uiState: {
    expanded: true,
    refreshInterval: 5000,
    layout: 'card',
  },
};

function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'SET_CONNECTED':
      return { ...state, connected: action.payload };
    
    case 'SET_AUTHENTICATED':
      return { ...state, authenticated: action.payload };
    
    case 'SET_SESSION':
      return { ...state, currentSession: action.payload };
    
    case 'UPDATE_CONTEXT':
      return { ...state, contextStatus: action.payload };
    
    case 'ADD_CHECKPOINT':
      return {
        ...state,
        recentCheckpoints: [action.payload, ...state.recentCheckpoints].slice(0, 10),
      };
    
    case 'SET_DISCREPANCIES':
      return { ...state, activeDiscrepancies: action.payload };
    
    case 'SET_PROJECT':
      return { ...state, project: action.payload };
    
    case 'SET_VELOCITY':
      return { ...state, velocityMetrics: action.payload };
    
    case 'SET_ACTIONS':
      return { ...state, suggestedActions: action.payload };
    
    case 'UPDATE_UI_STATE':
      return {
        ...state,
        uiState: { ...state.uiState, ...action.payload },
      };
    
    default:
      return state;
  }
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);
  const ws = React.useMemo(() => new WebSocketService(), []);
  const tools = React.useMemo(() => new MCPToolsService(ws), [ws]);

  useEffect(() => {
    // Set up WebSocket connection handlers
    const unsubscribeConnection = ws.onConnectionChange((connected) => {
      dispatch({ type: 'SET_CONNECTED', payload: connected });
    });

    const unsubscribeMessage = ws.onMessage((message: WSMessage) => {
      handleWebSocketMessage(message, dispatch);
    });

    // Connect to WebSocket
    ws.connect();

    return () => {
      unsubscribeConnection();
      unsubscribeMessage();
      ws.disconnect();
    };
  }, [ws]);

  const value = {
    state,
    ws,
    tools,
    dispatch,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

function handleWebSocketMessage(message: WSMessage, dispatch: React.Dispatch<DashboardAction>) {
  console.log('WebSocket message received:', message);
  
  if (message.type === 'auth' && message.data?.authenticated) {
    dispatch({ type: 'SET_AUTHENTICATED', payload: true });
    return;
  }

  if (message.type === 'event' && message.topic) {
    switch (message.topic) {
      case 'session.status':
        console.log('Session status update:', message.data.session);
        dispatch({ type: 'SET_SESSION', payload: message.data.session });
        break;
      
      case 'context.status':
        dispatch({ type: 'UPDATE_CONTEXT', payload: message.data.status });
        break;
      
      case 'reality.checks':
        dispatch({ type: 'SET_DISCREPANCIES', payload: message.data.discrepancies });
        break;
      
      case 'project.status':
        dispatch({ type: 'SET_PROJECT', payload: message.data.project });
        break;
      
      case 'suggestions.actions':
        dispatch({ type: 'SET_ACTIONS', payload: message.data.actions });
        break;
    }
  }
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within DashboardProvider');
  }
  return context;
}