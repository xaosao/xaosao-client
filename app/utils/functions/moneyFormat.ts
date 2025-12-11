export function formatMoney(amount: number, currency: string = "Kip"): string {
  return amount.toLocaleString("en-US") + " " + currency;
}
