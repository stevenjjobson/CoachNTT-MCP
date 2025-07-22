/**
 * Enhanced error classes with context and suggestions
 */

export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Session '${sessionId}' not found`);
    this.name = 'SessionNotFoundError';
  }
  
  get suggestion(): string {
    return 'Please check that the session ID is correct and the session has been started. You can list active sessions using the session_status tool.';
  }
}

export class ProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`Project '${projectId}' not found`);
    this.name = 'ProjectNotFoundError';
  }
  
  get suggestion(): string {
    return 'Please check that the project ID is correct. You can list all projects using the project_track tool.';
  }
}

export class ContextExhaustedError extends Error {
  constructor(used: number, total: number) {
    super(`Context budget exhausted: ${used}/${total} tokens used (${Math.round(used/total * 100)}%)`);
    this.name = 'ContextExhaustedError';
  }
  
  get suggestion(): string {
    return 'Create a checkpoint to save progress and start a new session, or use context_optimize to reduce token usage.';
  }
}

export class InvalidParametersError extends Error {
  constructor(message: string, missingParams?: string[]) {
    super(message);
    this.name = 'InvalidParametersError';
    this.missingParams = missingParams;
  }
  
  missingParams?: string[];
  
  get suggestion(): string {
    if (this.missingParams && this.missingParams.length > 0) {
      return `Missing required parameters: ${this.missingParams.join(', ')}. Please provide all required parameters.`;
    }
    return 'Please check the parameter format and ensure all required fields are provided.';
  }
}

export class DatabaseError extends Error {
  constructor(operation: string, originalError: Error) {
    super(`Database operation '${operation}' failed: ${originalError.message}`);
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
  
  originalError: Error;
  
  get suggestion(): string {
    if (this.originalError.message.includes('locked')) {
      return 'The database is locked. Try again in a moment or restart the MCP server.';
    }
    if (this.originalError.message.includes('no such table')) {
      return 'Database schema is missing. The database may need to be initialized.';
    }
    return 'Check database connectivity and permissions.';
  }
}

export class ToolExecutionError extends Error {
  constructor(toolName: string, originalError: Error) {
    super(`Tool '${toolName}' execution failed: ${originalError.message}`);
    this.name = 'ToolExecutionError';
    this.toolName = toolName;
    this.originalError = originalError;
  }
  
  toolName: string;
  originalError: Error;
  
  get suggestion(): string {
    return `Check the parameters for the '${this.toolName}' tool and ensure they match the expected format.`;
  }
}

/**
 * Format error for user display with context and suggestions
 */
export function formatError(error: Error): string {
  if (error instanceof SessionNotFoundError ||
      error instanceof ProjectNotFoundError ||
      error instanceof ContextExhaustedError ||
      error instanceof InvalidParametersError ||
      error instanceof DatabaseError ||
      error instanceof ToolExecutionError) {
    return `${error.message}\n\nSuggestion: ${error.suggestion}`;
  }
  
  // Generic error formatting
  return `Error: ${error.message}`;
}

/**
 * Wrap errors with context
 */
export function wrapError(error: Error, context: string): Error {
  const wrappedError = new Error(`${context}: ${error.message}`);
  wrappedError.stack = error.stack;
  return wrappedError;
}