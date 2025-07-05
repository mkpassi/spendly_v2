import React, { useState, useEffect } from 'react';
import { History, MessageCircle, Calendar, Trash2, Eye, Archive, Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message: string;
  messages: any[];
}

interface ChatHistoryDashboardProps {
  onLoadSession?: (messages: any[]) => void;
}

export const ChatHistoryDashboard: React.FC<ChatHistoryDashboardProps> = ({ onLoadSession }) => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [showSessionDetails, setShowSessionDetails] = useState(false);
  const [sortBy, setSortBy] = useState<'created_at' | 'message_count' | 'title'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const userId = user?.id || `anonymous_${localStorage.getItem('anonymousId') || 'user'}`;

  useEffect(() => {
    if (userId) {
      loadChatSessions();
    }
  }, [userId, sortBy, sortOrder]);

  const loadChatSessions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', userId)
        .order(sortBy, { ascending: sortOrder === 'asc' });

      if (error) throw error;

      setSessions(data || []);
    } catch (error) {
      console.error('Error loading chat sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!window.confirm('Are you sure you want to delete this chat session? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', userId);

      if (error) throw error;

      setSessions(sessions.filter(s => s.id !== sessionId));
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null);
        setShowSessionDetails(false);
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const viewSessionDetails = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      setSelectedSession(data);
      setShowSessionDetails(true);
    } catch (error) {
      console.error('Error loading session details:', error);
    }
  };

  const loadSessionIntoChat = (session: ChatSession) => {
    if (onLoadSession && session.messages) {
      onLoadSession(session.messages);
    }
  };

  const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.last_message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSessionStats = () => {
    const totalSessions = sessions.length;
    const totalMessages = sessions.reduce((sum, session) => sum + session.message_count, 0);
    const avgMessagesPerSession = totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0;
    
    return { totalSessions, totalMessages, avgMessagesPerSession };
  };

  const stats = getSessionStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-slate-500">Loading chat history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
      {/* Header */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
              <History className="h-5 w-5" />
              Chat History
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Manage your conversation history with the AI financial coach
            </p>
          </div>
          
          {/* Stats */}
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <div className="font-semibold text-slate-800">{stats.totalSessions}</div>
              <div className="text-slate-500">Sessions</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-slate-800">{stats.totalMessages}</div>
              <div className="text-slate-500">Messages</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-slate-800">{stats.avgMessagesPerSession}</div>
              <div className="text-slate-500">Avg/Session</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field as 'created_at' | 'message_count' | 'title');
                setSortOrder(order as 'asc' | 'desc');
              }}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="created_at-desc">Newest First</option>
              <option value="created_at-asc">Oldest First</option>
              <option value="message_count-desc">Most Messages</option>
              <option value="message_count-asc">Least Messages</option>
              <option value="title-asc">Title A-Z</option>
              <option value="title-desc">Title Z-A</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sessions List */}
      <div className="divide-y divide-slate-200">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            {searchTerm ? (
              <>
                <Search className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p>No sessions found matching "{searchTerm}"</p>
              </>
            ) : (
              <>
                <MessageCircle className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p>No chat sessions yet</p>
                <p className="text-sm">Start a conversation to create your first session</p>
              </>
            )}
          </div>
        ) : (
          filteredSessions.map((session) => (
            <div key={session.id} className="p-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <MessageCircle className="h-5 w-5 text-blue-600" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-800 truncate">{session.title}</h3>
                      <p className="text-sm text-slate-600 mt-1 line-clamp-2">{session.last_message}</p>
                      
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(session.created_at)}
                        </span>
                        <span>{session.message_count} messages</span>
                        {session.updated_at !== session.created_at && (
                          <span>Updated {formatDate(session.updated_at)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => viewSessionDetails(session.id)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="View Details"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  
                  {onLoadSession && (
                    <button
                      onClick={() => loadSessionIntoChat(session)}
                      className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Load into Chat"
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                  )}
                  
                  <button
                    onClick={() => deleteSession(session.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Session"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Session Details Modal */}
      {showSessionDetails && selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">{selectedSession.title}</h3>
                <p className="text-sm text-slate-500">
                  {formatDate(selectedSession.created_at)} • {selectedSession.message_count} messages
                </p>
              </div>
              <button
                onClick={() => setShowSessionDetails(false)}
                className="text-slate-500 hover:text-slate-700 text-xl"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {selectedSession.messages && selectedSession.messages.length > 0 ? (
                <div className="space-y-4">
                  {selectedSession.messages.map((message: any, index: number) => (
                    <div key={index} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-md px-4 py-2 rounded-lg ${
                        message.sender === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-100 text-slate-800'
                      }`}>
                        <p className="text-sm">{message.message}</p>
                        <p className="text-xs mt-1 opacity-75">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-500">No messages in this session</p>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              {onLoadSession && (
                <button
                  onClick={() => {
                    loadSessionIntoChat(selectedSession);
                    setShowSessionDetails(false);
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Load into Chat
                </button>
              )}
              <button
                onClick={() => setShowSessionDetails(false)}
                className="px-4 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 