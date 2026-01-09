import React from 'react';
import { EnvironmentData } from '../types';
import {
  PageTitle,
  ContentGrid,
  Card,
  CardHeader,
  CardTitle,
  CardSubtitle,
  CardBody,
  InfoList,
  InfoItem,
  InfoLabel,
  InfoValue,
  StatIcon,
  InfraComponent,
  LoadingContainer
} from '../components/UI';

interface EnvironmentProps {
  environmentData: EnvironmentData | null;
  loading: boolean;
}

const Environment: React.FC<EnvironmentProps> = ({ environmentData, loading }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <>
      <PageTitle>
        <i className="fas fa-server"></i>
        Environment Details
      </PageTitle>

      <ContentGrid>
        <Card>
          <CardHeader>
            <CardTitle>
              <i className="fas fa-id-card"></i>
              Environment Information
            </CardTitle>
          </CardHeader>
          <CardBody>
            {loading ? (
              <LoadingContainer>Loading environment information...</LoadingContainer>
            ) : (
              <InfoList>
                <InfoItem>
                  <InfoLabel>Environment ID:</InfoLabel>
                  <InfoValue>{environmentData?.environmentId || 'N/A'}</InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>Branch:</InfoLabel>
                  <InfoValue>{environmentData?.branch || 'N/A'}</InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>Version:</InfoLabel>
                  <InfoValue>{environmentData?.version || 'N/A'}</InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>Build Number:</InfoLabel>
                  <InfoValue>{environmentData?.buildNumber || 'N/A'}</InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>Git Commit:</InfoLabel>
                  <InfoValue>{environmentData?.gitCommit || 'N/A'}</InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>Deployed At:</InfoLabel>
                  <InfoValue>
                    {environmentData?.deployedAt ? formatDate(environmentData.deployedAt) : 'N/A'}
                  </InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>Region:</InfoLabel>
                  <InfoValue>{environmentData?.region || 'N/A'}</InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>Instance Type:</InfoLabel>
                  <InfoValue>{environmentData?.instanceType || 'N/A'}</InfoValue>
                </InfoItem>
              </InfoList>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <i className="fas fa-cogs"></i>
              System Information
            </CardTitle>
          </CardHeader>
          <CardBody>
            {loading ? (
              <LoadingContainer>Loading system information...</LoadingContainer>
            ) : (
              <InfoList>
                <InfoItem>
                  <InfoLabel>Node.js Version:</InfoLabel>
                  <InfoValue>{environmentData?.nodeVersion || 'N/A'}</InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>Platform:</InfoLabel>
                  <InfoValue>{environmentData?.platform || 'N/A'}</InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>Architecture:</InfoLabel>
                  <InfoValue>{environmentData?.arch || 'N/A'}</InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>Server Time:</InfoLabel>
                  <InfoValue>
                    {environmentData?.serverTime ? formatDate(environmentData.serverTime) : 'N/A'}
                  </InfoValue>
                </InfoItem>
              </InfoList>
            )}
          </CardBody>
        </Card>
      </ContentGrid>

      {/* Infrastructure Components */}
      <Card>
        <CardHeader>
          <CardTitle>
            <i className="fas fa-network-wired"></i>
            Infrastructure Components
          </CardTitle>
          <CardSubtitle>AWS resources provisioned for this environment</CardSubtitle>
        </CardHeader>
        <CardBody>
          <ContentGrid>
            <InfraComponent>
              <StatIcon>
                <i className="fas fa-cloud"></i>
              </StatIcon>
              <h4>VPC</h4>
              <p>Isolated virtual private cloud with custom CIDR block</p>
            </InfraComponent>
            
            <InfraComponent>
              <StatIcon>
                <i className="fas fa-server"></i>
              </StatIcon>
              <h4>Compute</h4>
              <p>EC2 instances or ECS containers running your application</p>
            </InfraComponent>
            
            <InfraComponent>
              <StatIcon>
                <i className="fas fa-shield-alt"></i>
              </StatIcon>
              <h4>Security Groups</h4>
              <p>Firewall rules controlling inbound and outbound traffic</p>
            </InfraComponent>
            
            <InfraComponent>
              <StatIcon>
                <i className="fas fa-balance-scale"></i>
              </StatIcon>
              <h4>Load Balancer</h4>
              <p>Application Load Balancer distributing traffic</p>
            </InfraComponent>
            
            <InfraComponent>
              <StatIcon>
                <i className="fas fa-database"></i>
              </StatIcon>
              <h4>Storage</h4>
              <p>S3 buckets and EBS volumes for persistent data</p>
            </InfraComponent>
            
            <InfraComponent>
              <StatIcon>
                <i className="fas fa-chart-bar"></i>
              </StatIcon>
              <h4>Monitoring</h4>
              <p>CloudWatch logs, metrics, and alarms</p>
            </InfraComponent>
          </ContentGrid>
        </CardBody>
      </Card>
    </>
  );
};

export default Environment;