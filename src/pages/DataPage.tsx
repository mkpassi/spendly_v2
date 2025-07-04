import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { DataManager } from '../components/DataManager';

export const DataPage: React.FC = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleDataChange = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <Layout 
      title="Data Manager" 
      description="Manage your financial data and test the app with sample transactions"
    >
      <div className="max-w-4xl mx-auto">
        <DataManager onDataChange={handleDataChange} />
      </div>
    </Layout>
  );
};