import { stellarAssetId, fiatAssetId, parseAssetId } from '../sep/sep38';

const ISSUER = 'GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4';

describe('SEP-38 asset ID helpers', () => {
  it('stellarAssetId formats correctly for custom asset', () => {
    const id = stellarAssetId('TESOURO', ISSUER);
    expect(id).toBe(`stellar:TESOURO:${ISSUER}`);
  });

  it('fiatAssetId formats correctly', () => {
    const id = fiatAssetId('BRL');
    expect(id).toBe('iso4217:BRL');
  });

  it('parseAssetId returns type and code for stellar asset', () => {
    const result = parseAssetId(`stellar:TESOURO:${ISSUER}`);
    expect(result.type).toBe('stellar');
    expect(result.code).toBe('TESOURO');
    expect(result.issuer).toBe(ISSUER);
  });

  it('parseAssetId handles fiat', () => {
    const result = parseAssetId('iso4217:BRL');
    expect(result.type).toBe('fiat');
    expect(result.code).toBe('BRL');
    expect(result.issuer).toBeUndefined();
  });
});
