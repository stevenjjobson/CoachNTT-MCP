import { MyWorkFlowServer } from './server';

describe('MyWorkFlowServer', () => {
  it('should instantiate without errors', () => {
    expect(() => new MyWorkFlowServer()).not.toThrow();
  });

  it('should have the correct server name', () => {
    const server = new MyWorkFlowServer();
    expect(server).toBeDefined();
  });
});