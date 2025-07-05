import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { ChatPage } from './pages/ChatPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { GoalsPage } from './pages/GoalsPage';
import { SummaryPage } from './pages/SummaryPage';
import { DataPage } from './pages/DataPage';
import { ProfilePage } from './pages/ProfilePage';
import { ChatHistoryPage } from './pages/ChatHistoryPage';
import SettingsPage from './pages/SettingsPage';
import { AuthProvider } from './contexts/AuthContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { Header } from './components/Header';
import { AuthGuard } from './components/AuthGuard';
import { Layout } from './components/Layout';

function App() {
  return (
    <Router>
      <AuthProvider>
        <CurrencyProvider>
          <div className="min-h-screen bg-slate-100 flex flex-col">
          <Header />
          <main className="flex-1 flex flex-col">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/chat" element={
                <Layout title="AI Financial Coach" description="Chat with your personal AI assistant to track expenses and get financial insights">
                  <AuthGuard>
                    <ChatPage />
                  </AuthGuard>
                </Layout>
              } />
              <Route path="/transactions" element={
                <Layout title="Transactions" description="View and manage your financial transactions">
                  <AuthGuard>
                    <TransactionsPage />
                  </AuthGuard>
                </Layout>
              } />
              <Route path="/goals" element={
                <Layout title="Financial Goals" description="Set and track your savings goals">
                  <AuthGuard>
                    <GoalsPage />
                  </AuthGuard>
                </Layout>
              } />
              <Route path="/summary" element={
                <Layout title="Monthly Summary" description="View your financial insights and spending analysis">
                  <AuthGuard>
                    <SummaryPage />
                  </AuthGuard>
                </Layout>
              } />
              <Route path="/data" element={
                <Layout title="Data Manager" description="Manage your financial data and import transactions">
                  <AuthGuard>
                    <DataPage />
                  </AuthGuard>
                </Layout>
              } />
              <Route path="/profile" element={
                <Layout title="User Profile" description="Manage your account settings and preferences">
                  <AuthGuard>
                    <ProfilePage />
                  </AuthGuard>
                </Layout>
              } />
              <Route path="/chat-history" element={
                <Layout title="Chat History" description="View and manage your conversation history">
                  <AuthGuard>
                    <ChatHistoryPage />
                  </AuthGuard>
                </Layout>
              } />
              <Route path="/settings" element={
                <AuthGuard>
                  <SettingsPage />
                </AuthGuard>
              } />
            </Routes>
          </main>
          </div>
        </CurrencyProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;