import React, { useState } from 'react';
import { ChatInterface } from '../components/ChatInterface';

export const ChatPage: React.FC = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleTransactionAdded = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="h-[calc(100vh-200px)]">
      <div className="h-full bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
        <ChatInterface onTransactionAdded={handleTransactionAdded} />
      </div>
    </div>
  );
};