import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Overview from './pages/Overview';
import Environment from './pages/Environment';
import Metrics from './pages/Metrics';
import Testing from './pages/Testing';
import { EnvironmentData, MetricsData } from './types';
import { fetchEnvironmentData, fetchMetricsData } from './services/api';

const AppContainer = styled.div`
  min-height: 100vh;
  background: #f8f9fa;
`;

const MainContent = styled.main`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  min-height: calc(100vh - 120px);
`;

const App: React.FC = () => {
  const [environmentData, setEnvironmentData] = useState<EnvironmentData | null>(null);
  const [metricsData, setMetricsData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([
          loadEnvironmentData(),
          loadMetricsData()
        ]);
      } catch (error) {
        console.error('Failed to load initial data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    
    // Auto-refresh data every 30 seconds
    const interval = setInterval(() => {
      loadEnvironmentData();
      loadMetricsData();
    }, 30000);

    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadEnvironmentData = async () => {
    try {
      const data = await fetchEnvironmentData();
      setEnvironmentData(data);
    } catch (error) {
      console.error('Failed to load environment data:', error);
    }
  };

  const loadMetricsData = async () => {
    try {
      const data = await fetchMetricsData();
      setMetricsData(data);
    } catch (error) {
      console.error('Failed to load metrics data:', error);
    }
  };

  const refreshMetrics = async () => {
    await loadMetricsData();
  };

  return (
    <Router>
      <AppContainer>
        <Header />
        <MainContent>
          <Routes>
            <Route 
              path="/overview" 
              element={
                <Overview 
                  environmentData={environmentData} 
                  loading={loading} 
                />
              } 
            />
            <Route 
              path="/environment" 
              element={
                <Environment 
                  environmentData={environmentData} 
                  loading={loading} 
                />
              } 
            />
            <Route 
              path="/metrics" 
              element={
                <Metrics 
                  metricsData={metricsData} 
                  loading={loading}
                  onRefresh={refreshMetrics}
                />
              } 
            />
            <Route 
              path="/testing" 
              element={<Testing />} 
            />
            <Route path="/" element={<Navigate to="/overview" replace />} />
          </Routes>
        </MainContent>
      </AppContainer>
    </Router>
  );
};

export default App;