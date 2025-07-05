import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, Loader2, Trash2, Bot, BarChart3, Mic, MicOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';

// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

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
  const { currencySymbol } = useCurrency();
  const userId = user?.id;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const hasStartedChat = messages.some(m => m.sender === 'user');

  // Check for speech recognition support
  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      setSpeechSupported(true);
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      if (recognitionRef.current) {
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = event.results[0][0].transcript;
          setInputMessage(transcript);
          setIsListening(false);
        };

        recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Load chat history on mount
  useEffect(() => {
    if (userId) {
      loadChatHistory();
    }
  }, [userId]);

  // Save conversation when user leaves the page
  useEffect(() => {
    const saveConversationOnUnload = async () => {
      if (!userId) return;
      
      const actualMessages = messages.filter(m => m.id !== 'welcome' && m.id !== 'error');
      
      if (actualMessages.length > 0) {
        const sessionTitle = `Chat - ${new Date().toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        })}`;

        const sessionMessages = actualMessages.map(msg => ({
          message: msg.message,
          sender: msg.sender,
          timestamp: msg.created_at
        }));

        const lastMessage = actualMessages[actualMessages.length - 1]?.message || '';

        // Use sendBeacon for reliable data sending on page unload
        const sessionData = {
          user_id: userId,
          title: sessionTitle,
          messages: sessionMessages,
          message_count: sessionMessages.length,
          last_message: lastMessage,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        try {
          // Try to save using supabase first
          await supabase.from('chat_sessions').insert([sessionData]);
          console.log('✅ Chat session saved on page unload');
        } catch (error) {
          console.error('Error saving chat session on unload:', error);
        }
      }
    };

    const handleBeforeUnload = () => {
      saveConversationOnUnload();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [userId, messages]);

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
      // Load from chat_messages table for current conversation
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
          message: `Hi! I'm your Financial Wellness Coach from Spendly. Track Smart, Save Easy. 💰\n\nTell me about a recent transaction (like 'Bought groceries for ${currencySymbol}75') or upload a bank statement to get started!\n\n💡 Tip: Try the 'Data' tab to add sample transactions for testing!`,
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
      // Get session for API call
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("User not authenticated");

      // Use only chat-response function - let LLM handle all decisions
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-response`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
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
        
        // Refresh data if it might have been a transaction or goal
        onTransactionAdded?.();
      } else {
        throw new Error(result.error || 'Chat response failed');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Provide a helpful fallback response
      const fallbackResponse = getFallbackResponse(userMessage);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        message: fallbackResponse,
        sender: 'ai',
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const getFallbackResponse = (message: string): string => {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('help') || lowerMessage.includes('how')) {
      return `I'm here to help you track your finances! 💰\n\nYou can:\n• Tell me about transactions (e.g., 'Bought coffee for ${currencySymbol}5')\n• Ask about your spending patterns\n• Set savings goals\n• Get monthly summaries\n\n💡 Try the 'Data' tab to add sample data for testing!`;
    }
    
    if (lowerMessage.includes('goal') || lowerMessage.includes('save')) {
      return `Great thinking about savings goals! 🎯\n\nYou can set goals by telling me things like:\n• 'I want to save ${currencySymbol}500 for a new phone'\n• 'Help me save ${currencySymbol}1000 by June'\n\nCheck out the 'Goals' tab to see your progress!`;
    }
    
    if (lowerMessage.includes('spending') || lowerMessage.includes('expense')) {
      return `I'd love to help you analyze your spending! 📊\n\nTry the 'Summary' tab for insights, or tell me about specific expenses like:\n• 'Spent ${currencySymbol}50 on groceries'\n• 'Paid ${currencySymbol}25 for gas'\n\nI'll help you track everything!`;
    }
    
    return "I'm having trouble right now, but I'm still here to help! 😊\n\nI can help you track expenses, set savings goals, and analyze your spending patterns.\n\n💡 Note: Full AI features require OpenAI API configuration. Try the 'Data' tab to add sample transactions for testing!";
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

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
             date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  const clearChat = async () => {
    if (!userId) return;
    
    try {
      // First, save current conversation to chat_sessions if there are actual messages
      const actualMessages = messages.filter(m => m.id !== 'welcome' && m.id !== 'error');
      
      if (actualMessages.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const sessionTitle = `Chat - ${new Date().toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        })}`;

        // Convert messages to session format
        const sessionMessages = actualMessages.map(msg => ({
          message: msg.message,
          sender: msg.sender,
          timestamp: msg.created_at
        }));

        const lastMessage = actualMessages[actualMessages.length - 1]?.message || '';

        // Save to chat_sessions
        const { error: sessionError } = await supabase
          .from('chat_sessions')
          .insert([{
            user_id: userId,
            title: sessionTitle,
            messages: sessionMessages,
            message_count: sessionMessages.length,
            last_message: lastMessage,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);

        if (sessionError) {
          console.error('Error saving chat session:', sessionError);
        } else {
          console.log('✅ Chat session saved successfully');
        }
      }
      
      // Clear current conversation from chat_messages
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('user_id', userId);
      
      if (error) throw error;
      
      // Clear from UI and show welcome message
      const welcomeMessage = {
        id: 'welcome',
        message: `Hi! I'm your Financial Wellness Coach from Spendly. Track Smart, Save Easy. 💰\n\nTell me about a recent transaction (like 'Bought groceries for ${currencySymbol}75') or upload a bank statement to get started!\n\n💡 Tip: Try the 'Data' tab to add sample transactions for testing!`,
        sender: 'ai' as const,
        created_at: new Date().toISOString()
      };
      setMessages([welcomeMessage]);
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  };

  const handleVoiceInput = () => {
    if (!speechSupported || !recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        setIsListening(false);
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">AI Financial Coach</h2>
              <p className="text-sm text-slate-600">Chat with your personal AI assistant to track expenses and get financial insights</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user && hasStartedChat && (
              <>
                <div className="relative group">
                  <div className="flex items-center gap-2 px-3 py-2 bg-white/80 rounded-lg border border-slate-200 shadow-sm">
                    <BarChart3 className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-slate-700">{messages.filter(m => m.sender === 'user').length}</span>
                  </div>
                  <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                    User Messages
                  </div>
                </div>
                <div className="relative group">
                  <button
                    onClick={clearChat}
                    className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 border border-slate-200 hover:border-red-200 shadow-sm bg-white/80"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                    Clear Chat
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Messages Container */}
      <div className="flex-1 flex flex-col relative bg-slate-50">
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
            <div className="flex items-center justify-center h-full p-6">
              <div className="text-center max-w-md">
                <div className="p-4 bg-blue-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <MessageCircle className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Welcome to Your AI Financial Coach</h3>
                <p className="text-slate-600 mb-4">
                  Start a conversation to track expenses, set savings goals, and get personalized financial insights.
                </p>
                <div className="bg-blue-50 rounded-lg p-4 text-sm text-slate-700">
                  <p className="font-medium mb-2">💡 Try asking:</p>
                  <ul className="text-left space-y-1">
                    <li>• "I spent {currencySymbol}50 on groceries"</li>
                    <li>• "I want to save {currencySymbol}1000 for vacation"</li>
                    <li>• "Show me my spending summary"</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : messages.length === 1 && messages[0].id === 'welcome' ? (
            <div className="flex items-center justify-center h-full p-6">
              <div className="text-center max-w-lg">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center justify-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-sm">
                        <Bot className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="text-lg font-bold text-slate-800">AI Financial Coach</div>
                        <div className="text-sm text-slate-500">Spendly Assistant</div>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 text-left">
                    {formatMessage(messages[0].message)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full p-6 overflow-y-auto">
              <div className="space-y-6 max-w-5xl mx-auto">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.sender === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-md lg:max-w-lg ${
                        msg.sender === 'user'
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white px-5 py-4 rounded-2xl rounded-br-md shadow-lg'
                          : 'bg-white text-slate-800 border border-slate-200 shadow-lg rounded-2xl rounded-bl-md overflow-hidden'
                      }`}
                    >
                      {msg.sender === 'ai' && (
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-5 py-3 border-b border-slate-100">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-sm">
                                <Bot className="h-4 w-4 text-white" />
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-slate-800">AI Financial Coach</div>
                                <div className="text-xs text-slate-500">Spendly Assistant</div>
                              </div>
                            </div>
                            <div className="text-xs text-slate-400">
                              {formatTimestamp(msg.created_at)}
                            </div>
                          </div>
                        </div>
                      )}
                      <div className={`leading-relaxed ${msg.sender === 'ai' ? 'px-5 py-5' : 'py-1'}`}>
                        {msg.sender === 'user' && (
                          <div className="flex items-center justify-between mb-3 opacity-90">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                              <div className="text-xs font-medium">You</div>
                            </div>
                            <div className="text-xs text-blue-200">
                              {formatTimestamp(msg.created_at)}
                            </div>
                          </div>
                        )}
                        <div className={msg.sender === 'user' ? 'font-medium px-5 pb-4' : ''}>
                          {formatMessage(msg.message)}
                        </div>
                      </div>
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
      <div className="bg-white border-t border-slate-200 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <textarea
              disabled={!user || authLoading}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                user
                  ? isListening 
                    ? 'Listening... Speak now!'
                    : 'Ask about your finances or add a transaction...'
                  : 'Please log in to chat'
              }
              className={`w-full h-12 p-3 pr-24 rounded-lg border border-slate-200 focus:border-blue-500 focus:outline-none transition-all duration-200 resize-none overflow-hidden placeholder:text-slate-400 ${
                isListening 
                  ? 'bg-red-50 border-red-200 focus:bg-red-50' 
                  : 'bg-slate-50 focus:bg-white'
              }`}
              rows={1}
            />
            {/* Voice Input Button */}
            {speechSupported && user && (
              <button
                onClick={handleVoiceInput}
                disabled={isLoading || !user}
                className={`absolute right-12 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg transition-all duration-200 flex items-center justify-center ${
                  isListening
                    ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                } disabled:bg-slate-300 disabled:cursor-not-allowed`}
                title={isListening ? 'Stop recording' : 'Start voice input'}
              >
                {isListening ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>
            )}
            {/* Send Button */}
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
          {/* Voice Input Status */}
          {speechSupported && user && isListening && (
            <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              Recording... Click the microphone again to stop
            </div>
          )}
          {/* Browser Support Message */}
          {!speechSupported && user && (
            <div className="mt-2 text-xs text-slate-500">
              💡 Voice input is not supported in your browser. Try Chrome, Safari, or Edge for voice features.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};