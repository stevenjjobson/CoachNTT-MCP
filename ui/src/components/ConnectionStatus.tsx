import React from 'react';
import { useDashboard } from '../store/dashboard-context';
import { Wifi, WifiOff, Shield, ShieldOff } from 'lucide-react';
import clsx from 'clsx';

export default function ConnectionStatus() {
  const { state } = useDashboard();

  return (
    <div className="flex items-center space-x-2">
      <div
        className={clsx(
          'flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium',
          state.connected
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        )}
      >
        {state.connected ? (
          <Wifi className="h-3 w-3" />
        ) : (
          <WifiOff className="h-3 w-3" />
        )}
        <span>{state.connected ? 'Connected' : 'Disconnected'}</span>
      </div>

      {state.connected && (
        <div
          className={clsx(
            'flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium',
            state.authenticated
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
          )}
        >
          {state.authenticated ? (
            <Shield className="h-3 w-3" />
          ) : (
            <ShieldOff className="h-3 w-3" />
          )}
          <span>{state.authenticated ? 'Authenticated' : 'Not Authenticated'}</span>
        </div>
      )}
    </div>
  );
}