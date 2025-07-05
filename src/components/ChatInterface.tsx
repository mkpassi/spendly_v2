import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ChatMessage {
  id: string;
  message: string;
  sender: 'user' | 'ai';
  created_at: string;
}

interface ChatInterfaceProps {
  onTransactionAdded?: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  onTransactionAdded 
}) => {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasStartedChat = messages.some(m => m.sender === 'user');

  // Load chat history on mount
  useEffect(() => {
    if (userId) {
      loadChatHistory();
    }
  }, [userId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatHistory = async () => {
    if (!userId) return;
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
      const errorMessage = {
        id: 'error',
        message: "Welcome to Spendly! Please log in to see your chat history and start a conversation.",
        sender: 'ai' as const,
        created_at: new Date().toISOString()
      };
      setMessages([errorMessage]);
    } finally {
      setIsInitialLoad(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !userId) return;

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
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error("User not authenticated");

          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-transactions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: userMessage,
              // userId is implicitly handled by Supabase function with user's JWT
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
    if (!userId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("User not authenticated");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-response`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          // userId is implicitly handled by Supabase function with user's JWT
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
    <div className="flex flex-col h-full">
      {/* Messages Container */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 max-w-3xl mx-auto w-full">
          {authLoading || isInitialLoad ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : !user ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-slate-500">
                <MessageCircle size={48} className="mx-auto mb-4" />
                <p className="text-lg font-semibold">Please log in</p>
                <p>Sign in to chat with your Spendly Coach.</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-end h-full p-6">
              <div className="w-full">
                <div className="flex justify-start">
                  <div className="max-w-md lg:max-w-lg px-4 py-2 rounded-lg bg-white text-slate-800 border border-slate-200">
                    {formatMessage("Hi! I'm your Financial Wellness Coach from Spendly. Track Smart, Save Easy. 💰\n\nTell me about a recent transaction (like 'Bought groceries for $75') or upload a bank statement to get started!\n\n💡 Tip: Try the 'Data' tab to add sample transactions for testing!")}
                  </div>
                </div>
              </div>
            </div>
          ) : messages.length === 1 && messages[0].id === 'welcome' ? (
            <div className="flex items-end h-full p-6">
              <div className="w-full">
                <div className="flex justify-start">
                  <div className="max-w-md lg:max-w-lg px-4 py-2 rounded-lg bg-white text-slate-800 border border-slate-200">
                    {formatMessage(messages[0].message)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full p-6 overflow-y-auto">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.sender === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-md lg:max-w-lg px-4 py-2 rounded-lg ${
                        msg.sender === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-slate-800 border border-slate-200'
                      }`}
                    >
                      {formatMessage(msg.message)}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-slate-200">
        <div className="max-w-3xl mx-auto p-4">
          <div className="relative">
            <textarea
              disabled={!user || authLoading}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                user
                  ? 'Ask about your finances or add a transaction...'
                  : 'Please log in to chat'
              }
              className="w-full h-12 p-3 pr-20 rounded-lg bg-slate-100 border-2 border-transparent focus:border-blue-500 focus:bg-white focus:outline-none transition resize-none overflow-hidden"
              rows={1}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading || !user}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};