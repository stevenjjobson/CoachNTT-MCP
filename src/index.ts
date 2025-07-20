import { MyWorkFlowServer } from './core/server';

async function main() {
  const server = new MyWorkFlowServer();
  await server.start();
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});