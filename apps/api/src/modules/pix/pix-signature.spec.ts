import * as crypto from 'crypto';
import { verifyPixCallbackSignature } from './pix-signature';

const SECRET = 'pix-webhook-secret';

function signedHeader(body: Buffer, timestamp: string, secret = SECRET): string {
  const message = `${timestamp}.${body.toString('utf-8')}`;
  const digest = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
  return `sha256=${digest}`;
}

function nowSeconds(): string {
  return Math.floor(Date.now() / 1000).toString();
}

describe('verifyPixCallbackSignature', () => {
  const body = Buffer.from(JSON.stringify({ orderId: 'ord-1', status: 'paid' }));

  it('accepts a valid signature within the time window', () => {
    const timestamp = nowSeconds();
    const signature = signedHeader(body, timestamp);

    expect(
      verifyPixCallbackSignature(body, signature, timestamp, SECRET),
    ).toBe(true);
  });

  it('rejects when the signature header is missing', () => {
    const timestamp = nowSeconds();

    expect(
      verifyPixCallbackSignature(body, undefined, timestamp, SECRET),
    ).toBe(false);
  });

  it('rejects when the timestamp header is missing', () => {
    const timestamp = nowSeconds();
    const signature = signedHeader(body, timestamp);

    expect(
      verifyPixCallbackSignature(body, signature, undefined, SECRET),
    ).toBe(false);
  });

  it('rejects a non-numeric timestamp', () => {
    const signature = signedHeader(body, 'not-a-number');

    expect(
      verifyPixCallbackSignature(body, signature, 'not-a-number', SECRET),
    ).toBe(false);
  });

  it('rejects a timestamp outside the skew window', () => {
    const stale = (Math.floor(Date.now() / 1000) - 400).toString();
    const signature = signedHeader(body, stale);

    expect(
      verifyPixCallbackSignature(body, signature, stale, SECRET),
    ).toBe(false);
  });

  it('accepts a stale timestamp when the skew window is widened', () => {
    const stale = (Math.floor(Date.now() / 1000) - 400).toString();
    const signature = signedHeader(body, stale);

    expect(
      verifyPixCallbackSignature(body, signature, stale, SECRET, 600),
    ).toBe(true);
  });

  it('rejects a signature produced with a different secret', () => {
    const timestamp = nowSeconds();
    const signature = signedHeader(body, timestamp, 'wrong-secret');

    expect(
      verifyPixCallbackSignature(body, signature, timestamp, SECRET),
    ).toBe(false);
  });

  it('rejects when the body was tampered with after signing', () => {
    const timestamp = nowSeconds();
    const signature = signedHeader(body, timestamp);
    const tampered = Buffer.from(
      JSON.stringify({ orderId: 'ord-1', status: 'failed' }),
    );

    expect(
      verifyPixCallbackSignature(tampered, signature, timestamp, SECRET),
    ).toBe(false);
  });

  it('rejects a signature of a different length without throwing', () => {
    const timestamp = nowSeconds();

    expect(
      verifyPixCallbackSignature(body, 'sha256=short', timestamp, SECRET),
    ).toBe(false);
  });
});
