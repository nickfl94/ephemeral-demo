import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';

const HeaderContainer = styled.header`
  background: white;
  border-bottom: 1px solid #e9ecef;
  position: sticky;
  top: 0;
  z-index: 1000;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const NavContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 2rem;
  height: 60px;
`;

const NavBrand = styled(Link)`
  display: flex;
  align-items: center;
  font-size: 1.25rem;
  font-weight: 600;
  color: #2563eb;
  text-decoration: none;
  
  i {
    margin-right: 0.5rem;
    font-size: 1.5rem;
  }
`;

const NavMenu = styled.nav`
  display: flex;
  gap: 0;
  list-style: none;
`;

const NavLink = styled(Link)<{ $isActive: boolean }>`
  text-decoration: none;
  color: ${props => props.$isActive ? '#2563eb' : '#6b7280'};
  font-weight: 500;
  padding: 1rem 1.5rem;
  border-bottom: 3px solid ${props => props.$isActive ? '#2563eb' : 'transparent'};
  background: ${props => props.$isActive ? 'rgba(37, 99, 235, 0.05)' : 'transparent'};
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 60px;

  &:hover {
    color: #2563eb;
    border-bottom-color: #2563eb;
    background: rgba(37, 99, 235, 0.05);
  }

  i {
    font-size: 0.875rem;
  }
`;

const Header: React.FC = () => {
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname === path || (location.pathname === '/' && path === '/overview');
  };

  return (
    <HeaderContainer>
      <NavContainer>
        <NavBrand to="/overview">
          <i className="fas fa-cloud"></i>
          Ephemeral Demo
        </NavBrand>
        <NavMenu>
          <NavLink to="/overview" $isActive={isActive('/overview')}>
            <i className="fas fa-home"></i>
            Overview
          </NavLink>
          <NavLink to="/environment" $isActive={isActive('/environment')}>
            <i className="fas fa-server"></i>
            Environment
          </NavLink>
          <NavLink to="/metrics" $isActive={isActive('/metrics')}>
            <i className="fas fa-chart-line"></i>
            Metrics
          </NavLink>
          <NavLink to="/testing" $isActive={isActive('/testing')}>
            <i className="fas fa-vial"></i>
            Testing
          </NavLink>
        </NavMenu>
      </NavContainer>
    </HeaderContainer>
  );
};

export default Header;