import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { TransactionList } from '../components/TransactionList';

export const TransactionsPage: React.FC = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <Layout 
      title="Transaction Management" 
      description="View, edit, and organize all your financial transactions"
    >
      <div className="max-w-4xl mx-auto">
        <TransactionList refreshTrigger={refreshTrigger} />
      </div>
    </Layout>
  );
};