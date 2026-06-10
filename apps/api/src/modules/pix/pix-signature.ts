import * as crypto from 'crypto';

/**
 * Verifica a assinatura HMAC-SHA256 de um callback recebido do microserviço Pix.
 *
 * A mensagem assinada é: `<timestamp>.<json_body>`
 * O timestamp deve estar dentro da janela de tolerância (padrão: 300 s).
 *
 * @param rawBody - Buffer bruto do corpo da requisição.
 * @param signatureHeader - Valor do header `X-CredBridge-Pix-Signature`.
 * @param timestampHeader - Valor do header `X-CredBridge-Pix-Timestamp`.
 * @param secret - Segredo compartilhado `PIX_WEBHOOK_SECRET`.
 * @param maxSkewSeconds - Tolerância de tempo em segundos (padrão: 300).
 * @returns true se a assinatura for válida e o timestamp estiver dentro da janela.
 */
export function verifyPixCallbackSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  timestampHeader: string | undefined,
  secret: string,
  maxSkewSeconds = 300,
): boolean {
  if (!signatureHeader || !timestampHeader) {
    return false;
  }

  const timestampSeconds = parseInt(timestampHeader, 10);
  if (isNaN(timestampSeconds)) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > maxSkewSeconds) {
    return false;
  }

  const bodyString = rawBody.toString('utf-8');
  const message = `${timestampHeader}.${bodyString}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  const expectedHeader = `sha256=${expectedSignature}`;

  // Usa comparação de tempo constante para prevenir timing attacks
  if (signatureHeader.length !== expectedHeader.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expectedHeader),
  );
}
