import React, { useState } from 'react';
import { TransactionList } from '../components/TransactionList';

const TransactionsPageComponent: React.FC = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div>
      <TransactionList refreshTrigger={refreshTrigger} />
    </div>
  );
};

export const TransactionsPage = React.memo(TransactionsPageComponent);