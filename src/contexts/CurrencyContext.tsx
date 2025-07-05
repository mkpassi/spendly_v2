import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { DEFAULT_CURRENCY, getCurrencySymbol, getCurrencyByCode, type Currency } from '../utils/currencyUtils';

interface CurrencyContextType {
  currency: string;
  currencySymbol: string;
  currencyData: Currency | undefined;
  setCurrency: (currency: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [currency, setCurrencyState] = useState<string>(DEFAULT_CURRENCY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user's currency preference on mount and when user changes
  useEffect(() => {
    if (user) {
      loadUserCurrency();
    } else {
      // For anonymous users, use default currency
      setCurrencyState(DEFAULT_CURRENCY);
      setLoading(false);
    }
  }, [user]);

  const loadUserCurrency = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('user_settings')
        .select('currency')
        .eq('user_id', user?.id || 'anonymous_user')
        .single();

      if (fetchError) {
        // If no settings found, create default settings
        if (fetchError.code === 'PGRST116') {
          console.log('🔄 CurrencyContext: No user settings found, creating defaults...');
          await createDefaultSettings();
        } else {
          throw fetchError;
        }
      } else {
        const userCurrency = data?.currency || DEFAULT_CURRENCY;
        console.log('✅ CurrencyContext: Loaded user currency:', userCurrency);
        setCurrencyState(userCurrency);
      }
    } catch (err) {
      console.error('❌ CurrencyContext: Error loading currency:', err);
      setError('Failed to load currency preference');
      setCurrencyState(DEFAULT_CURRENCY); // Fallback to default
    } finally {
      setLoading(false);
    }
  };

  const createDefaultSettings = async () => {
    try {
      const { error: insertError } = await supabase
        .from('user_settings')
        .insert({
          user_id: user?.id || 'anonymous_user',
          expenses_percentage: 50,
          savings_percentage: 30,
          goals_percentage: 20,
          currency: DEFAULT_CURRENCY
        });

      if (insertError) throw insertError;

      console.log('✅ CurrencyContext: Created default settings with currency:', DEFAULT_CURRENCY);
      setCurrencyState(DEFAULT_CURRENCY);
    } catch (err) {
      console.error('❌ CurrencyContext: Error creating default settings:', err);
      setCurrencyState(DEFAULT_CURRENCY);
    }
  };

  const setCurrency = async (newCurrency: string) => {
    try {
      setError(null);
      
      // Optimistically update the UI
      setCurrencyState(newCurrency);

      // Update in database
      const { error: updateError } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user?.id || 'anonymous_user',
          currency: newCurrency
        }, {
          onConflict: 'user_id'
        });

      if (updateError) {
        // Revert on error
        setCurrencyState(currency);
        throw updateError;
      }

      console.log('✅ CurrencyContext: Updated currency to:', newCurrency);
    } catch (err) {
      console.error('❌ CurrencyContext: Error updating currency:', err);
      setError('Failed to update currency preference');
      throw err;
    }
  };

  const currencySymbol = getCurrencySymbol(currency);
  const currencyData = getCurrencyByCode(currency);

  const value: CurrencyContextType = {
    currency,
    currencySymbol,
    currencyData,
    setCurrency,
    loading,
    error
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
} 