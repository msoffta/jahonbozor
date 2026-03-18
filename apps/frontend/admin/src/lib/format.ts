export function formatCurrency(value: number, currencyLabel: string): string {
    return `${value.toLocaleString()} ${currencyLabel}`;
}
