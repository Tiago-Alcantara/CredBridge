import { EtherfuseClient } from '../etherfuse';
import type { Anchor } from '../types';

const TESOURO_ISSUER = 'GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4';

describe('EtherfuseClient', () => {
  let client: Anchor;

  beforeEach(() => {
    client = new EtherfuseClient({ apiKey: 'test-key', baseUrl: 'https://api.etherfuse.com' });
  });

  it('exposes name "etherfuse"', () => {
    expect(client.name).toBe('etherfuse');
  });

  it('supports BRL currency', () => {
    expect(client.supportedCurrencies).toContain('BRL');
  });

  it('supports pix rail', () => {
    expect(client.supportedRails).toContain('pix');
  });

  it('has TESOURO token with correct issuer', () => {
    const tesouro = client.supportedTokens.find((t) => t.symbol === 'TESOURO');
    expect(tesouro).toBeDefined();
    expect(tesouro!.issuer).toBe(TESOURO_ISSUER);
  });

  it('satisfies the Anchor interface (required methods present)', () => {
    expect(typeof client.createCustomer).toBe('function');
    expect(typeof client.getCustomer).toBe('function');
    expect(typeof client.getQuote).toBe('function');
    expect(typeof client.createOnRamp).toBe('function');
    expect(typeof client.createOffRamp).toBe('function');
    expect(typeof client.getKycStatus).toBe('function');
    expect(typeof client.getFiatAccounts).toBe('function');
  });
});
