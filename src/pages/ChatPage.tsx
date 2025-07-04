import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { ChatInterface } from '../components/ChatInterface';

export const ChatPage: React.FC = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleTransactionAdded = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <Layout 
      title="AI Financial Coach" 
      description="Chat with your personal AI assistant to track expenses and get financial insights"
    >
      <div className="h-[calc(100vh-280px)]">
        <ChatInterface onTransactionAdded={handleTransactionAdded} />
      </div>
    </Layout>
  );
};