import React from 'react';
import { Layout } from '../components/Layout';
import { GoalTracker } from '../components/GoalTracker';

export const GoalsPage: React.FC = () => {
  return (
    <Layout 
      title="Savings Goals" 
      description="Set, track, and achieve your financial goals with AI-powered insights"
    >
      <div className="max-w-4xl mx-auto">
        <GoalTracker />
      </div>
    </Layout>
  );
};