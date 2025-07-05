import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChatInterface } from '../components/ChatInterface';

export const ChatPage: React.FC = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const location = useLocation();
  
  // Get loaded messages from navigation state
  const loadedMessages = location.state?.loadedMessages;

  const handleTransactionAdded = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div>
      <div className="h-full bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
        <ChatInterface 
          onTransactionAdded={handleTransactionAdded}
          initialMessages={loadedMessages}
        />
      </div>
    </div>
  );
};