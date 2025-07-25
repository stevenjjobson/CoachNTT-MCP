/**
 * Log filtering utilities to reduce console spam
 */

// Get log level from localStorage or default to 'normal'
export const getLogLevel = (): 'verbose' | 'normal' | 'quiet' => {
  const stored = localStorage.getItem('coachntt-log-level');
  return (stored as any) || 'normal';
};

export const setLogLevel = (level: 'verbose' | 'normal' | 'quiet') => {
  localStorage.setItem('coachntt-log-level', level);
  console.log(`[LogFilter] Log level set to: ${level}`);
};

// Topics to filter based on log level
const QUIET_MODE_TOPICS = new Set([
  'session.status',
  'context.status',
  'project.status'
]);

const NORMAL_MODE_TOPICS = new Set([
  'session.status'
]);

export const shouldLog = (topic?: string, messageType?: string): boolean => {
  const level = getLogLevel();
  
  // Always log errors
  if (messageType === 'error') return true;
  
  // Always log tool executions
  if (topic === 'tool:execution') return true;
  
  // In verbose mode, log everything
  if (level === 'verbose') return true;
  
  // In quiet mode, filter out most topics
  if (level === 'quiet' && topic && QUIET_MODE_TOPICS.has(topic)) {
    return false;
  }
  
  // In normal mode, only filter session status
  if (level === 'normal' && topic && NORMAL_MODE_TOPICS.has(topic)) {
    return false;
  }
  
  return true;
};

// Wrapper for console.log that respects log level
export const filteredLog = (prefix: string, message: any, topic?: string) => {
  if (shouldLog(topic)) {
    console.log(prefix, message);
  }
};

// Initialize log level on load
if (typeof window !== 'undefined' && !localStorage.getItem('coachntt-log-level')) {
  setLogLevel('normal');
}