/**
 * Playwright-based UI debugging test
 * Uses the Playwright MCP server to systematically test and debug tool execution
 */

// Test configuration
const UI_URL = 'http://localhost:5174';
const WAIT_TIMEOUT = 5000;
const TEST_SESSION_NAME = 'Playwright Debug Session';

interface ConsoleMessage {
  timestamp: number;
  type: string;
  text: string;
}

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
}

// Store captured data
const capturedLogs: ConsoleMessage[] = [];
const wsMessages: WebSocketMessage[] = [];

/**
 * Main test execution
 */
async function runUIDebugTest() {
  console.log('🎭 Starting Playwright UI Debug Test...\n');
  
  try {
    // Step 1: Navigate to UI
    console.log('📍 Step 1: Navigating to UI...');
    await navigateToUI();
    
    // Step 2: Set up monitoring
    console.log('\n📊 Step 2: Setting up console and network monitoring...');
    await setupMonitoring();
    
    // Step 3: Take initial snapshot
    console.log('\n📸 Step 3: Taking initial UI snapshot...');
    const initialSnapshot = await takeSnapshot('initial');
    
    // Step 4: Check if session exists
    console.log('\n🔍 Step 4: Checking for active session...');
    const hasActiveSession = await checkActiveSession(initialSnapshot);
    
    // Step 5: Create session if needed
    if (!hasActiveSession) {
      console.log('\n➕ Step 5: Creating new session...');
      await createNewSession();
    }
    
    // Step 6: Test tool buttons
    console.log('\n🔧 Step 6: Testing tool execution buttons...');
    await testToolButtons();
    
    // Step 7: Analyze results
    console.log('\n📋 Step 7: Analyzing captured data...');
    await analyzeResults();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

/**
 * Navigate to the UI
 */
async function navigateToUI() {
  // Use Playwright MCP to navigate
  const result = await callPlaywright('browser_navigate', {
    url: UI_URL
  });
  
  if (!result.success) {
    throw new Error(`Failed to navigate: ${result.error}`);
  }
  
  // Wait for page to load
  await callPlaywright('browser_wait_for', {
    timeout: WAIT_TIMEOUT
  });
  
  console.log('✅ Successfully navigated to UI');
}

/**
 * Set up console and network monitoring
 */
async function setupMonitoring() {
  // Get console messages
  const consoleResult = await callPlaywright('browser_console_messages', {});
  if (consoleResult.success && consoleResult.data) {
    capturedLogs.push(...consoleResult.data);
  }
  
  // Get network requests (WebSocket messages)
  const networkResult = await callPlaywright('browser_network_requests', {});
  if (networkResult.success && networkResult.data) {
    const wsRequests = networkResult.data.filter((req: any) => 
      req.url.includes('ws://') || req.url.includes('wss://')
    );
    console.log(`📡 Found ${wsRequests.length} WebSocket connections`);
  }
  
  console.log('✅ Monitoring set up');
}

/**
 * Take a snapshot of the current page state
 */
async function takeSnapshot(name: string) {
  const result = await callPlaywright('browser_snapshot', {});
  
  if (!result.success) {
    throw new Error(`Failed to take snapshot: ${result.error}`);
  }
  
  console.log(`✅ Snapshot '${name}' captured`);
  
  // Also take a screenshot for visual debugging
  await callPlaywright('browser_take_screenshot', {
    path: `./tests/screenshots/ui-debug-${name}.png`
  });
  
  return result.data;
}

/**
 * Check if there's an active session
 */
async function checkActiveSession(snapshot: any): Promise<boolean> {
  // Look for session-related elements in the snapshot
  const sessionElements = findElementsInSnapshot(snapshot, 'session');
  const hasSession = sessionElements.some(el => 
    el.text?.includes('Active Session') || 
    el.text?.includes('Session ID')
  );
  
  console.log(hasSession ? '✅ Active session found' : '❌ No active session');
  return hasSession;
}

/**
 * Create a new session using the UI
 */
async function createNewSession() {
  // Find and click the start session button
  const snapshot = await callPlaywright('browser_snapshot', {});
  const startButton = findElementInSnapshot(snapshot, 'button', 'Start Session');
  
  if (!startButton) {
    console.log('⚠️ Start Session button not found, looking for alternatives...');
    // Try to find the floating action button
    const fabButton = findElementInSnapshot(snapshot, 'button', 'Play');
    if (fabButton) {
      await clickElement('Floating action button', fabButton.ref);
    }
    return;
  }
  
  await clickElement('Start Session button', startButton.ref);
  
  // Wait for session to be created
  await callPlaywright('browser_wait_for', {
    timeout: 3000
  });
  
  console.log('✅ Session creation triggered');
}

/**
 * Test all tool execution buttons
 */
async function testToolButtons() {
  const buttons = [
    { name: 'Checkpoint', expectedTool: 'createCheckpoint' },
    { name: 'Run Check', expectedTool: 'performRealityCheck' },
    { name: 'Optimize', expectedTool: 'optimizeContext' }
  ];
  
  for (const button of buttons) {
    console.log(`\n🔘 Testing ${button.name} button...`);
    
    // Clear previous logs
    const prevLogCount = capturedLogs.length;
    const prevWsCount = wsMessages.length;
    
    // Take snapshot and find button
    const snapshot = await callPlaywright('browser_snapshot', {});
    const buttonElement = findElementInSnapshot(snapshot, 'button', button.name);
    
    if (!buttonElement) {
      console.log(`⚠️ ${button.name} button not found in snapshot`);
      continue;
    }
    
    // Click the button
    await clickElement(`${button.name} button`, buttonElement.ref);
    
    // Wait for potential tool execution
    await callPlaywright('browser_wait_for', {
      timeout: 2000
    });
    
    // Capture new console messages
    const newConsoleResult = await callPlaywright('browser_console_messages', {});
    if (newConsoleResult.success) {
      const newLogs = newConsoleResult.data.slice(prevLogCount);
      capturedLogs.push(...newLogs);
      
      // Check for tool execution logs
      const toolLogs = newLogs.filter((log: any) => 
        log.text.includes(button.expectedTool) ||
        log.text.includes('Tool execution') ||
        log.text.includes('[WebSocket] Sending tool')
      );
      
      if (toolLogs.length > 0) {
        console.log(`✅ Found ${toolLogs.length} tool execution logs`);
        toolLogs.forEach((log: any) => {
          console.log(`   📝 ${log.text.substring(0, 100)}...`);
        });
      } else {
        console.log('❌ No tool execution logs found');
      }
    }
    
    // Check MCP Interaction Log for updates
    const mcpLogUpdated = await checkMCPLogUpdate(snapshot);
    console.log(mcpLogUpdated ? '✅ MCP log updated' : '❌ MCP log not updated');
  }
}

/**
 * Check if MCP Interaction Log shows new entries
 */
async function checkMCPLogUpdate(snapshot: any): Promise<boolean> {
  const mcpLogElements = findElementsInSnapshot(snapshot, 'MCP.*Log|Interaction.*Log');
  
  // Look for tool execution entries
  const hasToolEntries = mcpLogElements.some(el => 
    el.text?.includes('Tool:') || 
    el.text?.includes('checkpoint') ||
    el.text?.includes('reality_check') ||
    el.text?.includes('optimize')
  );
  
  return hasToolEntries;
}

/**
 * Analyze all captured data
 */
async function analyzeResults() {
  console.log('\n=== Analysis Results ===\n');
  
  // Analyze console logs
  console.log(`📊 Total console messages: ${capturedLogs.length}`);
  
  const toolExecutionLogs = capturedLogs.filter(log => 
    log.text.includes('executeTool') || 
    log.text.includes('Tool execution') ||
    log.text.includes('[MCPTools]')
  );
  
  console.log(`🔧 Tool execution logs: ${toolExecutionLogs.length}`);
  
  if (toolExecutionLogs.length === 0) {
    console.log('\n❌ ISSUE: No tool execution logs found!');
    console.log('Possible causes:');
    console.log('- Click handlers not firing');
    console.log('- MCPTools service not being called');
    console.log('- WebSocket not sending execute messages');
  }
  
  // Check for WebSocket messages
  const wsExecuteMessages = capturedLogs.filter(log =>
    log.text.includes('type: \'execute\'') ||
    log.text.includes('Sending tool execution')
  );
  
  console.log(`\n📡 WebSocket execute messages: ${wsExecuteMessages.length}`);
  
  if (wsExecuteMessages.length === 0) {
    console.log('❌ ISSUE: No WebSocket execute messages sent!');
    console.log('The problem is likely in the frontend before WebSocket');
  }
  
  // Check for server responses
  const serverResponses = capturedLogs.filter(log =>
    log.text.includes('type: \'result\'') ||
    log.text.includes('Tool execution result')
  );
  
  console.log(`\n📨 Server responses: ${serverResponses.length}`);
  
  // Final diagnosis
  console.log('\n=== Diagnosis ===');
  if (toolExecutionLogs.length === 0) {
    console.log('🔴 Frontend issue: Buttons not triggering tool calls');
  } else if (wsExecuteMessages.length === 0) {
    console.log('🔴 WebSocket issue: Execute messages not being sent');
  } else if (serverResponses.length === 0) {
    console.log('🔴 Server issue: Not responding to tool executions');
  } else {
    console.log('🔴 Broadcasting issue: Tool results not updating UI');
  }
}

/**
 * Helper function to call Playwright MCP tools
 */
async function callPlaywright(tool: string, params: any): Promise<any> {
  // This would normally call the Playwright MCP server
  // For now, we'll log the intended action
  console.log(`🎭 Playwright: ${tool}`, params);
  
  // Simulate successful response
  return {
    success: true,
    data: {}
  };
}

/**
 * Helper to find elements in snapshot
 */
function findElementsInSnapshot(snapshot: any, pattern: string): any[] {
  // This would search through the accessibility tree
  // Looking for elements matching the pattern
  return [];
}

/**
 * Helper to find a specific element
 */
function findElementInSnapshot(snapshot: any, type: string, text: string): any {
  // This would search for a specific element by type and text
  return null;
}

/**
 * Click an element
 */
async function clickElement(description: string, ref: string) {
  console.log(`🖱️ Clicking ${description}`);
  await callPlaywright('browser_click', {
    element: description,
    ref: ref
  });
}

// Export for use in other tests
export {
  runUIDebugTest,
  navigateToUI,
  testToolButtons,
  analyzeResults
};

// Run the test if executed directly
if (require.main === module) {
  runUIDebugTest();
}