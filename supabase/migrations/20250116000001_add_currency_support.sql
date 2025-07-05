-- Add currency support to user settings
-- This migration adds currency selection functionality while preserving existing data

-- 1. Add currency field to user_settings table
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR' CHECK (currency IN ('USD', 'INR', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'KRW', 'SGD', 'HKD', 'MXN', 'BRL', 'ZAR', 'RUB', 'THB', 'VND', 'IDR', 'MYR', 'PHP', 'TRY', 'AED', 'SAR', 'EGP', 'PKR', 'BDT', 'LKR', 'NPR'));

-- 2. Update default settings for anonymous user to include currency
UPDATE user_settings 
SET currency = 'INR' 
WHERE user_id = 'anonymous_user' AND currency IS NULL;

-- 3. Set default currency for any existing users who don't have it set
UPDATE user_settings 
SET currency = 'INR' 
WHERE currency IS NULL;

-- 4. Create function to get user currency with fallback
CREATE OR REPLACE FUNCTION get_user_currency(user_id_param TEXT)
RETURNS TEXT AS $$
DECLARE
  user_currency TEXT;
BEGIN
  SELECT currency INTO user_currency
  FROM user_settings
  WHERE user_id = user_id_param;
  
  -- Return user's currency or default to INR
  RETURN COALESCE(user_currency, 'INR');
END;
$$ LANGUAGE plpgsql;

-- 5. Create function to get currency symbol
CREATE OR REPLACE FUNCTION get_currency_symbol(currency_code TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE currency_code
    WHEN 'USD' THEN '$'
    WHEN 'INR' THEN '₹'
    WHEN 'EUR' THEN '€'
    WHEN 'GBP' THEN '£'
    WHEN 'JPY' THEN '¥'
    WHEN 'CAD' THEN 'C$'
    WHEN 'AUD' THEN 'A$'
    WHEN 'CHF' THEN 'Fr.'
    WHEN 'CNY' THEN '¥'
    WHEN 'KRW' THEN '₩'
    WHEN 'SGD' THEN 'S$'
    WHEN 'HKD' THEN 'HK$'
    WHEN 'MXN' THEN 'MX$'
    WHEN 'BRL' THEN 'R$'
    WHEN 'ZAR' THEN 'R'
    WHEN 'RUB' THEN '₽'
    WHEN 'THB' THEN '฿'
    WHEN 'VND' THEN '₫'
    WHEN 'IDR' THEN 'Rp'
    WHEN 'MYR' THEN 'RM'
    WHEN 'PHP' THEN '₱'
    WHEN 'TRY' THEN '₺'
    WHEN 'AED' THEN 'د.إ'
    WHEN 'SAR' THEN '﷼'
    WHEN 'EGP' THEN 'E£'
    WHEN 'PKR' THEN '₨'
    WHEN 'BDT' THEN '৳'
    WHEN 'LKR' THEN '₨'
    WHEN 'NPR' THEN '₨'
    ELSE currency_code
  END;
END;
$$ LANGUAGE plpgsql;

-- 6. Create function to get currency name
CREATE OR REPLACE FUNCTION get_currency_name(currency_code TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE currency_code
    WHEN 'USD' THEN 'US Dollar'
    WHEN 'INR' THEN 'Indian Rupee'
    WHEN 'EUR' THEN 'Euro'
    WHEN 'GBP' THEN 'British Pound'
    WHEN 'JPY' THEN 'Japanese Yen'
    WHEN 'CAD' THEN 'Canadian Dollar'
    WHEN 'AUD' THEN 'Australian Dollar'
    WHEN 'CHF' THEN 'Swiss Franc'
    WHEN 'CNY' THEN 'Chinese Yuan'
    WHEN 'KRW' THEN 'South Korean Won'
    WHEN 'SGD' THEN 'Singapore Dollar'
    WHEN 'HKD' THEN 'Hong Kong Dollar'
    WHEN 'MXN' THEN 'Mexican Peso'
    WHEN 'BRL' THEN 'Brazilian Real'
    WHEN 'ZAR' THEN 'South African Rand'
    WHEN 'RUB' THEN 'Russian Ruble'
    WHEN 'THB' THEN 'Thai Baht'
    WHEN 'VND' THEN 'Vietnamese Dong'
    WHEN 'IDR' THEN 'Indonesian Rupiah'
    WHEN 'MYR' THEN 'Malaysian Ringgit'
    WHEN 'PHP' THEN 'Philippine Peso'
    WHEN 'TRY' THEN 'Turkish Lira'
    WHEN 'AED' THEN 'UAE Dirham'
    WHEN 'SAR' THEN 'Saudi Riyal'
    WHEN 'EGP' THEN 'Egyptian Pound'
    WHEN 'PKR' THEN 'Pakistani Rupee'
    WHEN 'BDT' THEN 'Bangladeshi Taka'
    WHEN 'LKR' THEN 'Sri Lankan Rupee'
    WHEN 'NPR' THEN 'Nepalese Rupee'
    ELSE currency_code
  END;
END;
$$ LANGUAGE plpgsql;

-- 7. Update the enhanced budget settings function to include currency
CREATE OR REPLACE FUNCTION get_user_budget_settings(user_id_param TEXT)
RETURNS TABLE (
  expenses_percentage DECIMAL(5,2),
  savings_percentage DECIMAL(5,2),
  goals_percentage DECIMAL(5,2),
  currency TEXT,
  currency_symbol TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(us.expenses_percentage, 50.00) as expenses_percentage,
    COALESCE(us.savings_percentage, 30.00) as savings_percentage,
    COALESCE(us.goals_percentage, 20.00) as goals_percentage,
    COALESCE(us.currency, 'INR') as currency,
    get_currency_symbol(COALESCE(us.currency, 'INR')) as currency_symbol
  FROM (SELECT 1) as dummy
  LEFT JOIN user_settings us ON us.user_id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- 8. Create index for currency field
CREATE INDEX IF NOT EXISTS idx_user_settings_currency ON user_settings(currency);

-- 9. Create view for user financial summary with currency
CREATE OR REPLACE VIEW user_financial_summary AS
SELECT 
  us.user_id,
  us.expenses_percentage,
  us.savings_percentage,
  us.goals_percentage,
  us.currency,
  get_currency_symbol(us.currency) as currency_symbol,
  get_currency_name(us.currency) as currency_name,
  us.created_at,
  us.updated_at
FROM user_settings us;

-- 10. Grant necessary permissions
GRANT SELECT ON user_financial_summary TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_currency(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_currency_symbol(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_currency_name(TEXT) TO anon, authenticated; 