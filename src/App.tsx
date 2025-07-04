import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { ChatPage } from './pages/ChatPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { GoalsPage } from './pages/GoalsPage';
import { SummaryPage } from './pages/SummaryPage';
import { DataPage } from './pages/DataPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/summary" element={<SummaryPage />} />
          <Route path="/data" element={<DataPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;