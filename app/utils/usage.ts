export function formatUsd(value: number): string {
  const fractionDigits = value > 0 && value < 0.01 ? 6 : 2
  return new Intl.NumberFormat(undefined, { currency: "USD", maximumFractionDigits: fractionDigits, minimumFractionDigits: fractionDigits, style: "currency" }).format(value)
}
