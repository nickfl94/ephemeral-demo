import React from 'react';
import styled from 'styled-components';
import { MetricsData } from '../types';
import {
  PageTitle,
  MetricsGrid,
  Card,
  CardHeader,
  CardTitle,
  CardSubtitle,
  CardBody,
  Button,
  HealthGrid,
  HealthItem,
  HealthStatus,
  HealthLabel,
  LoadingContainer
} from '../components/UI';
import { formatUptime, getMetricColor } from '../utils/formatters';

const PageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
`;

const MetricCard = styled.div`
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const MetricHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;

  i {
    color: #2563eb;
    font-size: 1.25rem;
  }

  h3 {
    color: #1f2937;
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
  }
`;

const MetricValue = styled.div<{ color?: string }>`
  font-size: 2rem;
  font-weight: 700;
  color: ${props => props.color || '#1f2937'};
`;

const MetricUnit = styled.span`
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 400;
  margin-left: 0.25rem;
`;

interface MetricsProps {
  metricsData: MetricsData | null;
  loading: boolean;
  onRefresh: () => void;
}

const Metrics: React.FC<MetricsProps> = ({ metricsData, loading, onRefresh }) => {
  const getCpuUsage = () => {
    if (!metricsData?.loadAverage) return 0;
    return Math.min(Math.round(metricsData.loadAverage[0] * 100), 100);
  };

  const getMemoryUsage = () => {
    if (!metricsData?.memory) return { percent: 0, mb: 0 };
    const percent = Math.round((metricsData.memory.heapUsed / metricsData.memory.heapTotal) * 100);
    const mb = Math.round(metricsData.memory.heapUsed / 1024 / 1024);
    return { percent, mb };
  };

  const getSystemLoad = (): string => {
    if (!metricsData?.loadAverage) return '0.00';
    return metricsData.loadAverage[0].toFixed(2);
  };

  const getHealthStatus = (type: string) => {
    if (!metricsData) return 'error';
    
    switch (type) {
      case 'memory':
        return getMemoryUsage().percent < 90 ? 'healthy' : 'warning';
      case 'cpu':
        return getCpuUsage() < 80 ? 'healthy' : 'warning';
      case 'uptime':
        return metricsData.uptime > 60 ? 'healthy' : 'warning';
      default:
        return 'healthy';
    }
  };

  const cpuUsage = getCpuUsage();
  const memoryUsage = getMemoryUsage();
  const systemLoad = getSystemLoad();

  return (
    <>
      <PageHeader>
        <PageTitle style={{ marginBottom: 0 }}>
          <i className="fas fa-chart-line"></i>
          System Metrics
        </PageTitle>
        <Button onClick={onRefresh}>
          <i className="fas fa-sync-alt"></i>
          Refresh
        </Button>
      </PageHeader>

      {/* Metrics Grid */}
      <MetricsGrid>
        <MetricCard>
          <MetricHeader>
            <i className="fas fa-microchip"></i>
            <h3>CPU Usage</h3>
          </MetricHeader>
          <MetricValue color={getMetricColor(cpuUsage)}>
            {loading ? <LoadingContainer>Loading...</LoadingContainer> : `${cpuUsage}%`}
          </MetricValue>
        </MetricCard>

        <MetricCard>
          <MetricHeader>
            <i className="fas fa-memory"></i>
            <h3>Memory Usage</h3>
          </MetricHeader>
          <MetricValue color={getMetricColor(memoryUsage.percent)}>
            {loading ? (
              <LoadingContainer>Loading...</LoadingContainer>
            ) : (
              <>
                {memoryUsage.percent}%
                <MetricUnit>({memoryUsage.mb} MB)</MetricUnit>
              </>
            )}
          </MetricValue>
        </MetricCard>

        <MetricCard>
          <MetricHeader>
            <i className="fas fa-hdd"></i>
            <h3>System Load</h3>
          </MetricHeader>
          <MetricValue color={getMetricColor(Math.min(parseFloat(systemLoad) * 100, 100))}>
            {loading ? <LoadingContainer>Loading...</LoadingContainer> : systemLoad}
          </MetricValue>
        </MetricCard>

        <MetricCard>
          <MetricHeader>
            <i className="fas fa-clock"></i>
            <h3>Uptime</h3>
          </MetricHeader>
          <MetricValue color="#10b981">
            {loading ? (
              <LoadingContainer>Loading...</LoadingContainer>
            ) : (
              formatUptime(metricsData?.uptime || 0)
            )}
          </MetricValue>
        </MetricCard>
      </MetricsGrid>

      {/* Health Status */}
      <Card>
        <CardHeader>
          <CardTitle>
            <i className="fas fa-heartbeat"></i>
            Health Status
          </CardTitle>
          <CardSubtitle>Real-time system health monitoring</CardSubtitle>
        </CardHeader>
        <CardBody>
          {loading ? (
            <LoadingContainer>Loading health status...</LoadingContainer>
          ) : (
            <HealthGrid>
              <HealthItem>
                <HealthStatus status="healthy" />
                <HealthLabel>Server</HealthLabel>
              </HealthItem>
              <HealthItem>
                <HealthStatus status={getHealthStatus('memory')} />
                <HealthLabel>Memory</HealthLabel>
              </HealthItem>
              <HealthItem>
                <HealthStatus status={getHealthStatus('cpu')} />
                <HealthLabel>CPU Load</HealthLabel>
              </HealthItem>
              <HealthItem>
                <HealthStatus status={getHealthStatus('uptime')} />
                <HealthLabel>Uptime</HealthLabel>
              </HealthItem>
            </HealthGrid>
          )}
        </CardBody>
      </Card>
    </>
  );
};

export default Metrics;