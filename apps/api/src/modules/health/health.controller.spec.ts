import { HealthController } from './health.controller';

describe('HealthController', () => {
  const controller = new HealthController();

  it('reports a healthy status with a message', () => {
    const result = controller.ping();

    expect(result).toMatchObject({ status: 'ok', message: 'API is alive' });
  });

  it('returns a valid ISO timestamp', () => {
    const { timestamp } = controller.ping();

    expect(typeof timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(timestamp))).toBe(false);
  });
});
