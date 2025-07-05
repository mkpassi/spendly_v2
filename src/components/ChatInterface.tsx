import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, MessageCircle, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ChatMessage {
  id: string;
  message: string;
  sender: 'user' | 'ai';
  created_at: string;
  user_id: string;
}

interface ChatInterfaceProps {
  onTransactionAdded?: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  onTransactionAdded 
}) => {
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const realtimeChannelRef = useRef<any>(null);

  // Memoize user ID to prevent unnecessary re-renders
  const userId = useMemo(() => user?.id, [user?.id]);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load chat history and set up real-time subscription
  useEffect(() => {
    if (!userId) {
      setMessages([]);
      setIsInitialLoad(false);
      return;
    }

    loadChatHistory();
    setupRealtimeSubscription();

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [userId]);

  const loadChatHistory = async () => {
    if (!userId) return;
    
    setIsInitialLoad(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data.length === 0) {
        // Add welcome message if no chat history
        const welcomeMessage: ChatMessage = {
          id: 'welcome',
          message: "Hi! I'm Spendly, your AI-powered Financial Wellness Coach. 💰\n\nI'm here to help you:\n• Track expenses and income\n• Set and achieve savings goals\n• Get personalized financial insights\n• Answer your money questions\n\nTell me about a recent transaction (like 'Bought groceries for $75') or ask me anything about personal finance!\n\n✨ Track Smart, Save Easy. Powered by AI.",
          sender: 'ai',
          created_at: new Date().toISOString(),
          user_id: userId
        };
        setMessages([welcomeMessage]);
      } else {
        setMessages(data);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      setError('Failed to load chat history. Please try again.');
      
      // Show fallback welcome message
      const errorMessage: ChatMessage = {
        id: 'error-welcome',
        message: "Welcome to Spendly! I'm having trouble loading your chat history, but I'm ready to help you with your finances. How can I assist you today?",
        sender: 'ai',
        created_at: new Date().toISOString(),
        user_id: userId
      };
      setMessages([errorMessage]);
    } finally {
      setIsInitialLoad(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!userId || realtimeChannelRef.current) return;

    const channel = supabase
      .channel('chat_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          
          // Only add AI messages from realtime (user messages are added optimistically)
          if (newMessage.sender === 'ai') {
            setMessages(prev => {
              // Check if message already exists to prevent duplicates
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) return prev;
              
              return [...prev, newMessage];
            });
            setIsTyping(false);
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !userId) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);
    setError(null);
    setIsTyping(true);

    // Optimistic UI update - add user message immediately
    const optimisticUserMessage: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      message: userMessage,
      sender: 'user',
      created_at: new Date().toISOString(),
      user_id: userId
    };
    
    setMessages(prev => [...prev, optimisticUserMessage]);

    try {
      // Check if this looks like a transaction for enhanced processing
      const isTransaction = /\$|dollar|paid|bought|spent|earned|salary|income|expense/i.test(userMessage);
      
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
            })
          });

          const result = await response.json();
          
          if (result.success && result.transactions?.length > 0) {
            const transaction = result.transactions[0];
            
            // Store user message and AI response for transaction
            await storeMessages(userMessage, 
              `Perfect! 🎉 I've added your ${transaction.type === 'income' ? 'income' : 'expense'} of $${transaction.amount} for "${transaction.description}" in the ${transaction.category} category.\n\nYour transaction has been saved and will appear in your transaction history. Keep tracking - you're building great financial habits! 💪`
            );
            
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
      setError('Failed to send message. Please try again.');
      
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== optimisticUserMessage.id));
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        message: "I'm having trouble responding right now. Please check your connection and try again. 🔄",
        sender: 'ai',
        created_at: new Date().toISOString(),
        user_id: userId
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
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
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // Messages are stored by the Edge Function and will come via realtime
        return;
      } else {
        throw new Error(result.error || 'Chat response failed');
      }
    } catch (error) {
      console.error('Chat response error:', error);
      
      // Provide a helpful fallback response
      const fallbackResponse = getFallbackResponse(message);
      await storeMessages(message, fallbackResponse);
    }
  };

  const storeMessages = async (userMessage: string, aiResponse: string) => {
    if (!userId) return;
    
    try {
      // Store user message
      const { error: userError } = await supabase
        .from('chat_messages')
        .insert({
          user_id: userId,
          message: userMessage,
          sender: 'user'
        });

      if (userError) throw userError;

      // Store AI response
      const { error: aiError } = await supabase
        .from('chat_messages')
        .insert({
          user_id: userId,
          message: aiResponse,
          sender: 'ai'
        });

      if (aiError) throw aiError;
    } catch (error) {
      console.error('Error storing messages:', error);
    }
  };

  const getFallbackResponse = (message: string): string => {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
      return "Hello! 👋 I'm Spendly, your AI financial wellness coach. I'm here to help you track expenses, set savings goals, and improve your financial health. What would you like to work on today?";
    }
    
    if (lowerMessage.includes('help') || lowerMessage.includes('how')) {
      return "I'm here to help you with your finances! 💰\n\nI can assist you with:\n• Tracking transactions (just tell me about purchases)\n• Setting and monitoring savings goals\n• Analyzing your spending patterns\n• Answering personal finance questions\n• Providing budgeting tips\n\nWhat specific area would you like help with?";
    }
    
    if (lowerMessage.includes('goal') || lowerMessage.includes('save')) {
      return "Great thinking about savings goals! 🎯\n\nI can help you:\n• Set realistic savings targets\n• Track your progress\n• Find ways to save more money\n• Plan for specific purchases or life events\n\nWhat are you hoping to save for? Tell me about your goal and I'll help you create a plan!";
    }
    
    if (lowerMessage.includes('budget') || lowerMessage.includes('money') || lowerMessage.includes('finance')) {
      return "Smart financial planning starts with understanding your money flow! 📊\n\nI can help you:\n• Track where your money goes\n• Identify spending patterns\n• Create realistic budgets\n• Find opportunities to save\n\nStart by telling me about some recent purchases, and I'll help you build a clearer picture of your finances.";
    }
    
    return "Thanks for your message! I'm Spendly, your AI financial wellness coach. 😊\n\nI specialize in helping you:\n• Track expenses and income\n• Set and achieve savings goals\n• Understand your spending patterns\n• Make smarter financial decisions\n\nTry telling me about a recent purchase, or ask me any question about personal finance. I'm here to help you succeed! 💪";
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleRetry = () => {
    setError(null);
    loadChatHistory();
  };

  const formatMessage = (message: string) => {
    return message.split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        {index < message.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  // Loading state
  if (authLoading || isInitialLoad) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-slate-600">Loading your conversation...</p>
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated state
  if (!user) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-500 max-w-md">
            <MessageCircle size={48} className="mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold mb-2">Welcome to Spendly</h3>
            <p className="mb-4">Your AI-powered financial wellness coach is ready to help you track smart and save easy.</p>
            <p className="text-sm">Please sign in to start your personalized financial journey.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
            <button
              onClick={handleRetry}
              className="text-red-600 hover:text-red-800 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Messages Container */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-3xl mx-auto">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full p-6">
              <div className="text-center text-slate-500 max-w-md">
                <MessageCircle size={48} className="mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-semibold mb-2">Start Your Financial Journey</h3>
                <p className="text-sm">Ask me anything about your finances or tell me about a recent transaction to get started!</p>
              </div>
            </div>
          ) : (
            <div className="h-full p-6 overflow-y-auto scrollbar-thin">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.sender === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-md lg:max-w-lg px-4 py-3 rounded-2xl shadow-sm ${
                        msg.sender === 'user'
                          ? 'bg-blue-500 text-white rounded-br-md'
                          : 'bg-slate-100 text-slate-800 rounded-bl-md border border-slate-200'
                      }`}
                    >
                      <div className="text-sm leading-relaxed">
                        {formatMessage(msg.message)}
                      </div>
                      <div className={`text-xs mt-2 ${
                        msg.sender === 'user' ? 'text-blue-100' : 'text-slate-500'
                      }`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Typing Indicator */}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="max-w-md lg:max-w-lg px-4 py-3 rounded-2xl rounded-bl-md bg-slate-100 border border-slate-200">
                      <div className="flex items-center gap-1">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                        <span className="text-xs text-slate-500 ml-2">Spendly is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-slate-200 shadow-lg">
        <div className="max-w-3xl mx-auto p-4">
          <div className="relative">
            <textarea
              ref={inputRef}
              disabled={!user || authLoading || isLoading}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                user
                  ? 'Ask about your finances or tell me about a transaction...'
                  : 'Please sign in to chat with Spendly'
              }
              className="w-full min-h-[48px] max-h-32 p-3 pr-12 rounded-xl bg-slate-50 border-2 border-slate-200 focus:border-blue-500 focus:bg-white focus:outline-none transition-all resize-none placeholder-slate-400"
              rows={1}
              style={{
                height: 'auto',
                minHeight: '48px'
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 128) + 'px';
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading || !user}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          
          {/* Helper Text */}
          <div className="mt-2 text-xs text-slate-500 text-center">
            Try: "Bought coffee for $5" • "How can I save money?" • "Set a goal to save $1000"
          </div>
        </div>
      </div>
    </div>
  );
};