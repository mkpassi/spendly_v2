import React from 'react';
import { Layout } from '../components/Layout';
import { MonthlySummary } from '../components/MonthlySummary';

export const SummaryPage: React.FC = () => {
  return (
    <Layout 
      title="Monthly Financial Summary" 
      description="Get AI-powered insights and analysis of your spending patterns"
    >
      <div className="max-w-4xl mx-auto">
        <MonthlySummary />
      </div>
    </Layout>
  );
};