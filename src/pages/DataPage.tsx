import React, { useState } from 'react';
import { DataManager } from '../components/DataManager';

export const DataPage: React.FC = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleDataChange = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div>
      <DataManager onDataChange={handleDataChange} />
    </div>
  );
};