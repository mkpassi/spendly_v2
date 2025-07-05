import React from 'react';
import { ChatHistoryDashboard } from '../components/ChatHistoryDashboard';
import { useNavigate } from 'react-router-dom';

export const ChatHistoryPage: React.FC = () => {
  const navigate = useNavigate();

  const handleLoadSession = (messages: any[]) => {
    // Navigate to chat page and pass the messages
    navigate('/chat', { state: { loadedMessages: messages } });
  };

  return (
    <div className="py-6">
      <ChatHistoryDashboard onLoadSession={handleLoadSession} />
    </div>
  );
}; 