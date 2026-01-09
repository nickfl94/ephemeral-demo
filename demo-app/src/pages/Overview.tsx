import React from 'react';
import { EnvironmentData } from '../types';
import {
  PageTitle,
  StatsGrid,
  StatCard,
  StatIcon,
  StatValue,
  StatLabel,
  ContentGrid,
  Card,
  CardHeader,
  CardTitle,
  CardSubtitle,
  CardBody,
  WorkflowStep,
  StepNumber,
  StepTitle,
  StepDescription,
  LoadingContainer
} from '../components/UI';
import { formatUptime } from '../utils/formatters';

interface OverviewProps {
  environmentData: EnvironmentData | null;
  loading: boolean;
}

const Overview: React.FC<OverviewProps> = ({ environmentData, loading }) => {
  return (
    <>
      <PageTitle>
        <i className="fas fa-rocket"></i>
        Ephemeral Environment Overview
      </PageTitle>

      {/* Environment Stats */}
      <StatsGrid>
        <StatCard>
          <StatIcon>
            <i className="fas fa-clock"></i>
          </StatIcon>
          <StatValue>
            {loading ? <LoadingContainer>Loading...</LoadingContainer> : formatUptime(environmentData?.uptime || 0)}
          </StatValue>
          <StatLabel>Uptime</StatLabel>
        </StatCard>
        
        <StatCard>
          <StatIcon>
            <i className="fas fa-code-branch"></i>
          </StatIcon>
          <StatValue>
            {loading ? <LoadingContainer>Loading...</LoadingContainer> : environmentData?.branch || 'N/A'}
          </StatValue>
          <StatLabel>Branch</StatLabel>
        </StatCard>
        
        <StatCard>
          <StatIcon>
            <i className="fas fa-map-marker-alt"></i>
          </StatIcon>
          <StatValue>
            {loading ? <LoadingContainer>Loading...</LoadingContainer> : environmentData?.region || 'N/A'}
          </StatValue>
          <StatLabel>AWS Region</StatLabel>
        </StatCard>
        
        <StatCard>
          <StatIcon>
            <i className="fas fa-server"></i>
          </StatIcon>
          <StatValue>
            {loading ? <LoadingContainer>Loading...</LoadingContainer> : environmentData?.instanceType || 'N/A'}
          </StatValue>
          <StatLabel>Instance Type</StatLabel>
        </StatCard>
      </StatsGrid>

      {/* Feature Cards */}
      <ContentGrid>
        <Card>
          <CardHeader>
            <CardTitle>
              <i className="fas fa-bolt"></i>
              Instant Provisioning
            </CardTitle>
          </CardHeader>
          <CardBody>
            <p>This environment was automatically created in minutes using Terraform and AWS infrastructure as code. No manual setup required.</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <i className="fas fa-shield-alt"></i>
              Isolated & Secure
            </CardTitle>
          </CardHeader>
          <CardBody>
            <p>Each environment is completely isolated with its own VPC, security groups, and resources. No cross-contamination between environments.</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <i className="fas fa-dollar-sign"></i>
              Cost Optimized
            </CardTitle>
          </CardHeader>
          <CardBody>
            <p>Automatic cleanup ensures you only pay for what you use, with built-in cost monitoring and alerts to prevent overspend.</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <i className="fas fa-git-alt"></i>
              Git Integrated
            </CardTitle>
          </CardHeader>
          <CardBody>
            <p>Environments are automatically created for PRs and destroyed when branches are merged or deleted. Seamless developer workflow.</p>
          </CardBody>
        </Card>
      </ContentGrid>

      {/* Workflow Steps */}
      <Card>
        <CardHeader>
          <CardTitle>
            <i className="fas fa-info-circle"></i>
            How It Works
          </CardTitle>
          <CardSubtitle>Automated ephemeral environment lifecycle</CardSubtitle>
        </CardHeader>
        <CardBody>
          <ContentGrid>
            <WorkflowStep>
              <StepNumber>1</StepNumber>
              <StepTitle>Pull Request Created</StepTitle>
              <StepDescription>
                When you create a PR, GitHub Actions triggers the provisioning workflow automatically.
              </StepDescription>
            </WorkflowStep>
            
            <WorkflowStep>
              <StepNumber>2</StepNumber>
              <StepTitle>Infrastructure Provisioned</StepTitle>
              <StepDescription>
                Terraform creates AWS resources: VPC, EC2/ECS, security groups, and load balancers.
              </StepDescription>
            </WorkflowStep>
            
            <WorkflowStep>
              <StepNumber>3</StepNumber>
              <StepTitle>Application Deployed</StepTitle>
              <StepDescription>
                Your application is built, containerized, and deployed to the new infrastructure.
              </StepDescription>
            </WorkflowStep>
            
            <WorkflowStep>
              <StepNumber>4</StepNumber>
              <StepTitle>Testing & Review</StepTitle>
              <StepDescription>
                Integration tests run automatically, and reviewers can test the live environment.
              </StepDescription>
            </WorkflowStep>
            
            <WorkflowStep>
              <StepNumber>5</StepNumber>
              <StepTitle>Automatic Cleanup</StepTitle>
              <StepDescription>
                When the PR is closed or merged, all resources are automatically destroyed.
              </StepDescription>
            </WorkflowStep>
          </ContentGrid>
        </CardBody>
      </Card>
    </>
  );
};

export default Overview;