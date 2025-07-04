import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ChatMessage {
  id: string;
  message: string;
  sender: 'user' | 'ai';
  created_at: string;
}

interface ChatInterfaceProps {
  userId?: string;
  onTransactionAdded?: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  userId = 'anonymous_user', 
  onTransactionAdded 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history on mount
  useEffect(() => {
    loadChatHistory();
  }, [userId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChatHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data.length === 0) {
        // Add welcome message if no chat history
        const welcomeMessage = {
          id: 'welcome',
          message: "Hi! I'm your Financial Wellness Coach from Spendly. Track Smart, Save Easy. 💰\n\nTell me about a recent transaction (like 'Bought groceries for $75') or upload a bank statement to get started!\n\n💡 Tip: Try the 'Data' tab to add sample transactions for testing!",
          sender: 'ai' as const,
          created_at: new Date().toISOString()
        };
        setMessages([welcomeMessage]);
      } else {
        setMessages(data);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      setMessages([{
        id: 'error',
        message: "Welcome to Spendly! I'm here to help you track your finances. Tell me about a recent transaction!\n\n💡 Tip: Try the 'Data' tab to add sample transactions for testing!",
        sender: 'ai',
        created_at: new Date().toISOString()
      }]);
    } finally {
      setIsInitialLoad(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    // Add user message to UI immediately
    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      message: userMessage,
      sender: 'user',
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      // Check if this looks like a transaction
      const isTransaction = /\$|dollar|paid|bought|spent|earned|salary|income|expense/.test(userMessage.toLowerCase());
      
      if (isTransaction) {
        // Try to parse as transaction first
        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-transactions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: userMessage,
              userId
            })
          });

          const result = await response.json();
          
          if (result.success && result.transactions.length > 0) {
            const transaction = result.transactions[0];
            const aiResponse = `Got it! Added ${transaction.type === 'income' ? 'income' : 'expense'} of $${transaction.amount} for ${transaction.description} in ${transaction.category}. 📊\n\nKeep tracking your finances - you're doing great!`;
            
            const aiMessage: ChatMessage = {
              id: `ai-${Date.now()}`,
              message: aiResponse,
              sender: 'ai',
              created_at: new Date().toISOString()
            };
            
            setMessages(prev => [...prev, aiMessage]);
            onTransactionAdded?.();
            return;
          }
        } catch (parseError) {
          console.log('Transaction parsing failed, falling back to chat:', parseError);
        }
      }

      // Fall back to regular chat response
      await handleChatResponse(userMessage);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        message: "I'm having trouble right now. Please try again! 💡 Note: AI features require OpenAI API key configuration in Supabase.",
        sender: 'ai',
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChatResponse = async (message: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-response`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          userId
        })
      });

      const result = await response.json();
      
      if (result.success) {
        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          message: result.response,
          sender: 'ai',
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error(result.error || 'Chat response failed');
      }
    } catch (error) {
      console.error('Chat response error:', error);
      // Provide a helpful fallback response
      const fallbackResponse = getFallbackResponse(message);
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        message: fallbackResponse,
        sender: 'ai',
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMessage]);
    }
  };

  const getFallbackResponse = (message: string): string => {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('help') || lowerMessage.includes('how')) {
      return "I'm here to help you track your finances! 💰\n\nYou can:\n• Tell me about transactions (e.g., 'Bought coffee for $5')\n• Ask about your spending patterns\n• Set savings goals\n• Get monthly summaries\n\n💡 Try the 'Data' tab to add sample data for testing!";
    }
    
    if (lowerMessage.includes('goal') || lowerMessage.includes('save')) {
      return "Great thinking about savings goals! 🎯\n\nYou can set goals by telling me things like:\n• 'I want to save $500 for a new phone'\n• 'Help me save $1000 by June'\n\nCheck out the 'Goals' tab to see your progress!";
    }
    
    if (lowerMessage.includes('spending') || lowerMessage.includes('expense')) {
      return "I'd love to help you analyze your spending! 📊\n\nTry the 'Summary' tab for insights, or tell me about specific expenses like:\n• 'Spent $50 on groceries'\n• 'Paid $25 for gas'\n\nI'll help you track everything!";
    }
    
    return "Thanks for your message! I'm your financial wellness coach. 😊\n\nI can help you track expenses, set savings goals, and analyze your spending patterns.\n\n💡 Note: Full AI features require OpenAI API configuration. Try the 'Data' tab to add sample transactions for testing!";
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessage = (message: string) => {
    return message.split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        {index < message.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-6 w-6 text-blue-500" />
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Spendly Coach</h1>
            <p className="text-sm text-slate-600">Your AI Financial Wellness Assistant</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isInitialLoad ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  msg.sender === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-slate-800 border border-slate-200'
                }`}
              >
                <p className="text-sm">{formatMessage(msg.message)}</p>
                <p className={`text-xs mt-1 ${
                  msg.sender === 'user' ? 'text-blue-100' : 'text-slate-500'
                }`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white text-slate-800 border border-slate-200 rounded-lg px-4 py-2 max-w-xs">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-slate-200 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message... (e.g., 'Bought coffee for $5')"
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputMessage.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};