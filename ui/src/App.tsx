import React from 'react';
import { DashboardProvider } from './store/dashboard-context';
import Dashboard from './components/Dashboard';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

function App() {
  return (
    <ErrorBoundary>
      <DashboardProvider>
        <Dashboard />
      </DashboardProvider>
    </ErrorBoundary>
  );
}

export default App;