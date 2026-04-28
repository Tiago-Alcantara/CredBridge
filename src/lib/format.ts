/**
 * Formats a number as BRL currency.
 * compact=true uses k/M/B suffixes for large values.
 */
export function fmtBRL(value: number, options: { compact?: boolean } = {}): string {
  if (options.compact) {
    if (value >= 1e9) return `R$ ${(value / 1e9).toFixed(1).replace(".", ",")}B`;
    if (value >= 1e6) return `R$ ${(value / 1e6).toFixed(1).replace(".", ",")}M`;
    if (value >= 1e3) return `R$ ${(value / 1e3).toFixed(0)}k`;
  }
  return `R$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Formats a 14-digit string as CNPJ: 00.000.000/0000-00
 */
export function fmtCNPJ(digits: string): string {
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

/**
 * Formats an 11-digit string as CPF: 000.000.000-00
 */
export function fmtCPF(digits: string): string {
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

/**
 * Truncates a hash or account ID showing prefix and suffix.
 * e.g. GDCH7Q4X…FQT9M4
 */
export function fmtTxHash(hash: string, prefixLength = 8): string {
  if (hash.length <= prefixLength + 4) return hash;
  return `${hash.slice(0, prefixLength)}…${hash.slice(-4)}`;
}
