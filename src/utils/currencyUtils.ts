// Currency utilities for the frontend
export interface Currency {
  code: string;
  name: string;
  symbol: string;
  flag?: string;
}

export const SUPPORTED_CURRENCIES: Currency[] = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr.', flag: '🇨🇭' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', flag: '🇰🇷' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', flag: '🇭🇰' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', flag: '🇲🇽' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', flag: '🇧🇷' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', flag: '🇿🇦' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽', flag: '🇷🇺' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', flag: '🇹🇭' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', flag: '🇻🇳' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', flag: '🇮🇩' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', flag: '🇲🇾' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', flag: '🇵🇭' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', flag: '🇹🇷' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', flag: '🇦🇪' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', flag: '🇸🇦' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', flag: '🇪🇬' },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', flag: '🇵🇰' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', flag: '🇧🇩' },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: '₨', flag: '🇱🇰' },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: '₨', flag: '🇳🇵' },
];

export const DEFAULT_CURRENCY = 'INR';

export function getCurrencyByCode(code: string): Currency | undefined {
  return SUPPORTED_CURRENCIES.find(currency => currency.code === code);
}

export function getCurrencySymbol(code: string): string {
  const currency = getCurrencyByCode(code);
  return currency?.symbol || code;
}

export function getCurrencyName(code: string): string {
  const currency = getCurrencyByCode(code);
  return currency?.name || code;
}

export function formatCurrency(amount: number, currencyCode: string = DEFAULT_CURRENCY): string {
  const currency = getCurrencyByCode(currencyCode);
  if (!currency) {
    return `${amount} ${currencyCode}`;
  }

  // Format number with appropriate decimal places
  const formattedAmount = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  // For currencies like INR, USD, EUR - put symbol before
  if (['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CNY', 'KRW', 'SGD', 'HKD', 'MXN', 'BRL', 'ZAR', 'RUB', 'THB', 'VND', 'IDR', 'MYR', 'PHP', 'TRY', 'PKR', 'BDT', 'LKR', 'NPR'].includes(currencyCode)) {
    return `${currency.symbol}${formattedAmount}`;
  }

  // For currencies like AED, SAR, EGP - put symbol after
  return `${formattedAmount} ${currency.symbol}`;
}

export function formatCurrencyCompact(amount: number, currencyCode: string = DEFAULT_CURRENCY): string {
  const currency = getCurrencyByCode(currencyCode);
  if (!currency) {
    return `${amount} ${currencyCode}`;
  }

  // Format large numbers compactly (1K, 1M, etc.)
  const absAmount = Math.abs(amount);
  let formattedAmount: string;
  
  if (absAmount >= 1000000) {
    formattedAmount = (amount / 1000000).toFixed(1) + 'M';
  } else if (absAmount >= 1000) {
    formattedAmount = (amount / 1000).toFixed(1) + 'K';
  } else {
    formattedAmount = amount.toFixed(2);
  }

  // For currencies like INR, USD, EUR - put symbol before
  if (['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CNY', 'KRW', 'SGD', 'HKD', 'MXN', 'BRL', 'ZAR', 'RUB', 'THB', 'VND', 'IDR', 'MYR', 'PHP', 'TRY', 'PKR', 'BDT', 'LKR', 'NPR'].includes(currencyCode)) {
    return `${currency.symbol}${formattedAmount}`;
  }

  // For currencies like AED, SAR, EGP - put symbol after
  return `${formattedAmount} ${currency.symbol}`;
}

export function parseCurrencyAmount(value: string): number {
  // Remove currency symbols and parse as number
  const cleaned = value.replace(/[^\d.-]/g, '');
  return parseFloat(cleaned) || 0;
}

export function validateCurrencyCode(code: string): boolean {
  return SUPPORTED_CURRENCIES.some(currency => currency.code === code);
} 