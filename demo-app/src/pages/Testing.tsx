import React, { useState } from 'react';
import {
  PageTitle,
  Card,
  CardHeader,
  CardTitle,
  CardSubtitle,
  CardBody,
  ContentGrid,
  TestControls,
  TestResults,
  FormGroup,
  FormLabel,
  FormSelect,
  Button,
  StatIcon,
  InfraComponent
} from '../components/UI';
import { startLoadTest } from '../services/api';
import { LoadTestRequest } from '../types';

const Testing: React.FC = () => {
  const [duration, setDuration] = useState<number>(5000);
  const [intensity, setIntensity] = useState<'light' | 'medium' | 'heavy'>('medium');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);

  const handleStartTest = async () => {
    if (isRunning) return;

    setIsRunning(true);
    setShowResults(true);
    setResults({
      status: 'running',
      duration: duration / 1000,
      intensity,
      startTime: new Date().toLocaleString()
    });

    try {
      const request: LoadTestRequest = { duration, intensity };
      const response = await startLoadTest(request);
      
      // Simulate test completion after duration
      setTimeout(() => {
        setResults({
          status: 'completed',
          duration: duration / 1000,
          intensity,
          startTime: response.startTime,
          endTime: new Date().toLocaleString(),
          message: 'Load test completed successfully!'
        });
        setIsRunning(false);
      }, duration);

    } catch (error) {
      setResults({
        status: 'error',
        message: 'Failed to start load test',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      setIsRunning(false);
    }
  };

  return (
    <>
      <PageTitle>
        <i className="fas fa-vial"></i>
        Load Testing
      </PageTitle>

      {/* Load Test Panel */}
      <Card>
        <CardHeader>
          <CardTitle>
            <i className="fas fa-play-circle"></i>
            Run Load Test
          </CardTitle>
          <CardSubtitle>Simulate different load scenarios to test environment performance</CardSubtitle>
        </CardHeader>
        <CardBody>
          <TestControls>
            <FormGroup>
              <FormLabel htmlFor="test-duration">Duration:</FormLabel>
              <FormSelect
                id="test-duration"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                disabled={isRunning}
              >
                <option value={5000}>5 seconds</option>
                <option value={10000}>10 seconds</option>
                <option value={30000}>30 seconds</option>
                <option value={60000}>1 minute</option>
              </FormSelect>
            </FormGroup>
            
            <FormGroup>
              <FormLabel htmlFor="test-intensity">Intensity:</FormLabel>
              <FormSelect
                id="test-intensity"
                value={intensity}
                onChange={(e) => setIntensity(e.target.value as 'light' | 'medium' | 'heavy')}
                disabled={isRunning}
              >
                <option value="light">Light</option>
                <option value="medium">Medium</option>
                <option value="heavy">Heavy</option>
              </FormSelect>
            </FormGroup>
            
            <Button onClick={handleStartTest} disabled={isRunning}>
              <i className={isRunning ? "fas fa-spinner fa-spin" : "fas fa-rocket"}></i>
              {isRunning ? 'Running Test...' : 'Start Test'}
            </Button>
          </TestControls>

          {showResults && (
            <TestResults>
              <h3>
                <i className="fas fa-chart-bar"></i>
                Test Results
              </h3>
              <div>
                {results?.status === 'running' && (
                  <div>
                    <p><strong>Test Started:</strong> {results.startTime}</p>
                    <p><strong>Duration:</strong> {results.duration} seconds</p>
                    <p><strong>Intensity:</strong> {results.intensity}</p>
                    <p><strong>Status:</strong> <span style={{ color: '#2563eb' }}>Running</span></p>
                    <p style={{ marginTop: '1rem', color: '#6b7280' }}>
                      Test in progress... Monitor metrics above for real-time impact.
                    </p>
                  </div>
                )}
                
                {results?.status === 'completed' && (
                  <div>
                    <p><strong>Test Completed:</strong> {results.endTime}</p>
                    <p><strong>Duration:</strong> {results.duration} seconds</p>
                    <p><strong>Intensity:</strong> {results.intensity}</p>
                    <p><strong>Status:</strong> <span style={{ color: '#10b981' }}>Completed</span></p>
                    <div style={{ 
                      marginTop: '1rem', 
                      padding: '1rem', 
                      background: 'rgba(16, 185, 129, 0.1)', 
                      borderRadius: '8px',
                      border: '1px solid rgba(16, 185, 129, 0.2)'
                    }}>
                      <p><strong>✅ Load test completed successfully!</strong></p>
                      <p>Check the metrics above to see the impact on system performance during the test.</p>
                      <p>The system should return to normal levels shortly.</p>
                    </div>
                  </div>
                )}
                
                {results?.status === 'error' && (
                  <div style={{ color: '#ef4444' }}>
                    <p><strong>Error:</strong> {results.message}</p>
                    {results.error && <p>{results.error}</p>}
                  </div>
                )}
              </div>
            </TestResults>
          )}
        </CardBody>
      </Card>

      {/* Test Information */}
      <Card>
        <CardHeader>
          <CardTitle>
            <i className="fas fa-info-circle"></i>
            About Load Testing
          </CardTitle>
        </CardHeader>
        <CardBody>
          <p>
            Load testing helps validate that your application can handle expected traffic
            and identifies performance bottlenecks before they reach production.
          </p>
          
          <ContentGrid style={{ marginTop: '1.5rem' }}>
            <InfraComponent>
              <StatIcon>
                <i className="fas fa-feather-alt"></i>
              </StatIcon>
              <h4>Light Load</h4>
              <p>Simulates normal user activity with minimal CPU usage</p>
            </InfraComponent>
            
            <InfraComponent>
              <StatIcon>
                <i className="fas fa-weight-hanging"></i>
              </StatIcon>
              <h4>Medium Load</h4>
              <p>Simulates moderate traffic with increased CPU and memory usage</p>
            </InfraComponent>
            
            <InfraComponent>
              <StatIcon>
                <i className="fas fa-dumbbell"></i>
              </StatIcon>
              <h4>Heavy Load</h4>
              <p>Simulates high traffic scenarios to test system limits</p>
            </InfraComponent>
          </ContentGrid>
        </CardBody>
      </Card>
    </>
  );
};

export default Testing;