export function formatBs(amount: number): string {
  if (isNaN(amount)) return "0,00";
  return new Intl.NumberFormat('es-VE', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).format(amount);
}

export function formatUsd(amount: number): string {
  if (isNaN(amount)) return "0.00";
  return new Intl.NumberFormat('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).format(amount);
}
