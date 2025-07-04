import React, { useState } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { TransactionList } from './components/TransactionList';
import { GoalTracker } from './components/GoalTracker';
import { MonthlySummary } from './components/MonthlySummary';
import { DataManager } from './components/DataManager';
import { Wallet, MessageCircle, Target, BarChart3, Database } from 'lucide-react';

function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState<'chat' | 'transactions' | 'goals' | 'summary' | 'data'>('chat');

  const handleTransactionAdded = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleDataChange = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const TabButton: React.FC<{
    id: 'chat' | 'transactions' | 'goals' | 'summary' | 'data';
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
  }> = ({ id, icon, label, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
        isActive
          ? 'bg-blue-500 text-white'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <Wallet className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Spendly</h1>
                <p className="text-sm text-slate-600">Track Smart, Save Easy. Powered by AI.</p>
              </div>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-2">
              <TabButton
                id="chat"
                icon={<MessageCircle className="h-4 w-4" />}
                label="Chat"
                isActive={activeTab === 'chat'}
                onClick={() => setActiveTab('chat')}
              />
              <TabButton
                id="transactions"
                icon={<Wallet className="h-4 w-4" />}
                label="Transactions"
                isActive={activeTab === 'transactions'}
                onClick={() => setActiveTab('transactions')}
              />
              <TabButton
                id="goals"
                icon={<Target className="h-4 w-4" />}
                label="Goals"
                isActive={activeTab === 'goals'}
                onClick={() => setActiveTab('goals')}
              />
              <TabButton
                id="summary"
                icon={<BarChart3 className="h-4 w-4" />}
                label="Summary"
                isActive={activeTab === 'summary'}
                onClick={() => setActiveTab('summary')}
              />
              <TabButton
                id="data"
                icon={<Database className="h-4 w-4" />}
                label="Data"
                isActive={activeTab === 'data'}
                onClick={() => setActiveTab('data')}
              />
            </nav>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden bg-white border-b border-slate-200">
        <div className="flex items-center justify-around px-2 py-2 overflow-x-auto">
          <TabButton
            id="chat"
            icon={<MessageCircle className="h-4 w-4" />}
            label="Chat"
            isActive={activeTab === 'chat'}
            onClick={() => setActiveTab('chat')}
          />
          <TabButton
            id="transactions"
            icon={<Wallet className="h-4 w-4" />}
            label="Transactions"
            isActive={activeTab === 'transactions'}
            onClick={() => setActiveTab('transactions')}
          />
          <TabButton
            id="goals"
            icon={<Target className="h-4 w-4" />}
            label="Goals"
            isActive={activeTab === 'goals'}
            onClick={() => setActiveTab('goals')}
          />
          <TabButton
            id="summary"
            icon={<BarChart3 className="h-4 w-4" />}
            label="Summary"
            isActive={activeTab === 'summary'}
            onClick={() => setActiveTab('summary')}
          />
          <TabButton
            id="data"
            icon={<Database className="h-4 w-4" />}
            label="Data"
            isActive={activeTab === 'data'}
            onClick={() => setActiveTab('data')}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Desktop Layout */}
        <div className="hidden lg:grid lg:grid-cols-3 lg:gap-6 lg:h-[calc(100vh-200px)]">
          {/* Chat Interface - Main Column */}
          <div className="lg:col-span-2">
            <div className="h-full">
              <ChatInterface onTransactionAdded={handleTransactionAdded} />
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6 overflow-y-auto">
            <TransactionList refreshTrigger={refreshTrigger} />
            <GoalTracker />
            <MonthlySummary />
            <DataManager onDataChange={handleDataChange} />
          </div>
        </div>

        {/* Mobile/Tablet Layout */}
        <div className="lg:hidden">
          <div className="h-[calc(100vh-200px)]">
            {activeTab === 'chat' && (
              <ChatInterface onTransactionAdded={handleTransactionAdded} />
            )}
            {activeTab === 'transactions' && (
              <TransactionList refreshTrigger={refreshTrigger} />
            )}
            {activeTab === 'goals' && (
              <GoalTracker />
            )}
            {activeTab === 'summary' && (
              <MonthlySummary />
            )}
            {activeTab === 'data' && (
              <DataManager onDataChange={handleDataChange} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;