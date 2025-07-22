import React from 'react';
import { DashboardProvider } from './store/dashboard-context';
import Dashboard from './components/Dashboard';
import './index.css';

function App() {
  return (
    <DashboardProvider>
      <Dashboard />
    </DashboardProvider>
  );
}

export default App;