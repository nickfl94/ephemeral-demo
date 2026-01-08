/**
 * Ephemeral Environment Demo - Frontend Application
 * Handles page navigation, API calls, and interactive features
 */

class EphemeralDemo {
  constructor() {
    this.currentPage = 'overview';
    this.refreshInterval = null;
    this.loadTestInProgress = false;
    
    this.init();
  }

  /**
   * Initialize the application
   */
  init() {
    this.setupNavigation();
    this.setupEventListeners();
    this.loadInitialData();
    this.startAutoRefresh();
  }

  /**
   * Setup navigation between pages
   */
  setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page');

    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetPage = link.getAttribute('data-page');
        this.navigateToPage(targetPage);
      });
    });

    // Handle browser back/forward
    window.addEventListener('popstate', (e) => {
      const page = e.state?.page || 'overview';
      this.navigateToPage(page, false);
    });

    // Set initial page from URL hash
    const hash = window.location.hash.substring(1);
    if (hash && ['overview', 'environment', 'metrics', 'testing'].includes(hash)) {
      this.navigateToPage(hash, false);
    }
  }

  /**
   * Navigate to a specific page
   */
  navigateToPage(pageName, updateHistory = true) {
    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('data-page') === pageName) {
        link.classList.add('active');
      }
    });

    // Update pages
    document.querySelectorAll('.page').forEach(page => {
      page.classList.remove('active');
    });
    
    const targetPage = document.getElementById(`${pageName}-page`);
    if (targetPage) {
      targetPage.classList.add('active');
      this.currentPage = pageName;
      
      // Update URL
      if (updateHistory) {
        window.history.pushState({ page: pageName }, '', `#${pageName}`);
      }
      
      // Load page-specific data
      this.loadPageData(pageName);
    }
  }

  /**
   * Setup event listeners for interactive elements
   */
  setupEventListeners() {
    // Refresh metrics button
    const refreshBtn = document.getElementById('refresh-metrics');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadMetrics();
      });
    }

    // Load test button
    const loadTestBtn = document.getElementById('start-load-test');
    if (loadTestBtn) {
      loadTestBtn.addEventListener('click', () => {
        this.startLoadTest();
      });
    }
  }

  /**
   * Load initial data for the application
   */
  async loadInitialData() {
    try {
      await Promise.all([
        this.loadEnvironmentInfo(),
        this.loadOverviewStats()
      ]);
    } catch (error) {
      console.error('Failed to load initial data:', error);
      this.showError('Failed to load application data');
    }
  }

  /**
   * Load page-specific data when navigating
   */
  loadPageData(pageName) {
    switch (pageName) {
      case 'environment':
        this.loadEnvironmentDetails();
        break;
      case 'metrics':
        this.loadMetrics();
        break;
      case 'testing':
        // Testing page doesn't need initial data load
        break;
      default:
        // Overview page data is loaded in loadInitialData
        break;
    }
  }

  /**
   * Load environment information from API
   */
  async loadEnvironmentInfo() {
    try {
      const response = await fetch('/api/environment');
      const data = await response.json();
      
      this.updateOverviewStats(data);
      return data;
    } catch (error) {
      console.error('Failed to load environment info:', error);
      this.showLoadingError('environment info');
    }
  }

  /**
   * Update overview page statistics
   */
  updateOverviewStats(envData) {
    // Update uptime
    const uptimeEl = document.getElementById('uptime');
    if (uptimeEl && envData.uptime) {
      uptimeEl.textContent = this.formatUptime(envData.uptime);
    }

    // Update branch
    const branchEl = document.getElementById('branch');
    if (branchEl && envData.branch) {
      branchEl.textContent = envData.branch;
    }

    // Update region
    const regionEl = document.getElementById('region');
    if (regionEl && envData.region) {
      regionEl.textContent = envData.region;
    }
  }

  /**
   * Load overview statistics
   */
  async loadOverviewStats() {
    // This is handled by loadEnvironmentInfo for now
    // Could be extended to load additional overview-specific data
  }

  /**
   * Load detailed environment information for environment page
   */
  async loadEnvironmentDetails() {
    try {
      const response = await fetch('/api/environment');
      const data = await response.json();
      
      this.updateEnvironmentInfo(data);
      this.updateSystemInfo(data);
    } catch (error) {
      console.error('Failed to load environment details:', error);
      this.showLoadingError('environment details');
    }
  }

  /**
   * Update environment info section
   */
  updateEnvironmentInfo(data) {
    const container = document.getElementById('environment-info');
    if (!container) return;

    const envInfo = [
      { label: 'Environment ID', value: data.environmentId || 'N/A' },
      { label: 'Branch', value: data.branch || 'N/A' },
      { label: 'Version', value: data.version || 'N/A' },
      { label: 'Build Number', value: data.buildNumber || 'N/A' },
      { label: 'Git Commit', value: data.gitCommit || 'N/A' },
      { label: 'Deployed At', value: data.deployedAt ? new Date(data.deployedAt).toLocaleString() : 'N/A' },
      { label: 'Region', value: data.region || 'N/A' },
      { label: 'Instance Type', value: data.instanceType || 'N/A' }
    ];

    container.innerHTML = envInfo.map(item => `
      <div class="info-item">
        <span class="info-label">${item.label}:</span>
        <span class="info-value">${item.value}</span>
      </div>
    `).join('');
  }

  /**
   * Update system info section
   */
  updateSystemInfo(data) {
    const container = document.getElementById('system-info');
    if (!container) return;

    const systemInfo = [
      { label: 'Node.js Version', value: data.nodeVersion || 'N/A' },
      { label: 'Platform', value: data.platform || 'N/A' },
      { label: 'Architecture', value: data.arch || 'N/A' },
      { label: 'Uptime', value: data.uptime ? this.formatUptime(data.uptime) : 'N/A' },
      { label: 'Server Time', value: data.serverTime ? new Date(data.serverTime).toLocaleString() : 'N/A' }
    ];

    container.innerHTML = systemInfo.map(item => `
      <div class="info-item">
        <span class="info-label">${item.label}:</span>
        <span class="info-value">${item.value}</span>
      </div>
    `).join('');
  }

  /**
   * Load system metrics from API
   */
  async loadMetrics() {
    try {
      // Show loading state
      this.showMetricsLoading();
      
      const response = await fetch('/api/metrics');
      const data = await response.json();
      
      this.updateMetrics(data);
      this.updateHealthStatus(data);
    } catch (error) {
      console.error('Failed to load metrics:', error);
      this.showLoadingError('metrics');
    }
  }

  /**
   * Show loading state for metrics
   */
  showMetricsLoading() {
    const metricElements = ['cpu-usage', 'memory-usage', 'system-load', 'uptime-metric'];
    metricElements.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.innerHTML = '<div class="loading">Loading...</div>';
      }
    });
  }

  /**
   * Update metrics display
   */
  updateMetrics(data) {
    // CPU Usage (simulated based on load average)
    const cpuEl = document.getElementById('cpu-usage');
    if (cpuEl && data.loadAverage) {
      const cpuPercent = Math.min(Math.round(data.loadAverage[0] * 100), 100);
      cpuEl.innerHTML = `<span style="color: ${this.getMetricColor(cpuPercent)}">${cpuPercent}%</span>`;
    }

    // Memory Usage
    const memoryEl = document.getElementById('memory-usage');
    if (memoryEl && data.memory) {
      const memoryPercent = Math.round((data.memory.heapUsed / data.memory.heapTotal) * 100);
      const memoryMB = Math.round(data.memory.heapUsed / 1024 / 1024);
      memoryEl.innerHTML = `
        <span style="color: ${this.getMetricColor(memoryPercent)}">${memoryPercent}%</span>
        <small>(${memoryMB} MB)</small>
      `;
    }

    // System Load
    const loadEl = document.getElementById('system-load');
    if (loadEl && data.loadAverage) {
      const load = data.loadAverage[0].toFixed(2);
      const loadPercent = Math.min(Math.round(data.loadAverage[0] * 100), 100);
      loadEl.innerHTML = `<span style="color: ${this.getMetricColor(loadPercent)}">${load}</span>`;
    }

    // Uptime
    const uptimeEl = document.getElementById('uptime-metric');
    if (uptimeEl && data.uptime) {
      uptimeEl.innerHTML = `<span style="color: #4CAF50">${this.formatUptime(data.uptime)}</span>`;
    }
  }

  /**
   * Update health status display
   */
  updateHealthStatus(data) {
    const container = document.getElementById('health-status');
    if (!container) return;

    const healthChecks = [
      { 
        name: 'Server', 
        status: 'healthy',
        icon: 'fas fa-server'
      },
      { 
        name: 'Memory', 
        status: data.memory && (data.memory.heapUsed / data.memory.heapTotal) < 0.9 ? 'healthy' : 'warning',
        icon: 'fas fa-memory'
      },
      { 
        name: 'CPU Load', 
        status: data.loadAverage && data.loadAverage[0] < 1.0 ? 'healthy' : 'warning',
        icon: 'fas fa-microchip'
      },
      { 
        name: 'Uptime', 
        status: data.uptime > 60 ? 'healthy' : 'warning',
        icon: 'fas fa-clock'
      }
    ];

    container.innerHTML = healthChecks.map(check => `
      <div class="health-item">
        <div class="health-status ${check.status}"></div>
        <i class="${check.icon}"></i>
        <span>${check.name}</span>
      </div>
    `).join('');
  }

  /**
   * Start load testing
   */
  async startLoadTest() {
    if (this.loadTestInProgress) return;

    const duration = parseInt(document.getElementById('test-duration').value);
    const intensity = document.getElementById('test-intensity').value;
    const button = document.getElementById('start-load-test');
    const resultsContainer = document.getElementById('test-results');
    const outputContainer = document.getElementById('test-output');

    try {
      this.loadTestInProgress = true;
      button.disabled = true;
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running Test...';

      // Show results container
      resultsContainer.style.display = 'block';
      outputContainer.innerHTML = `
        <div class="loading">Starting ${intensity} load test for ${duration/1000} seconds...</div>
      `;

      // Start the load test
      const response = await fetch('/api/load-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ duration, intensity })
      });

      const result = await response.json();
      
      // Update output with test info
      outputContainer.innerHTML = `
        <div class="test-info">
          <p><strong>Test Started:</strong> ${new Date(result.startTime).toLocaleString()}</p>
          <p><strong>Duration:</strong> ${duration/1000} seconds</p>
          <p><strong>Intensity:</strong> ${intensity}</p>
          <p><strong>Status:</strong> <span style="color: #4CAF50;">Running</span></p>
        </div>
        <div class="loading">Test in progress... Monitor metrics above for real-time impact.</div>
      `;

      // Wait for test duration and then show completion
      setTimeout(() => {
        this.completeLoadTest(result);
      }, duration);

    } catch (error) {
      console.error('Failed to start load test:', error);
      outputContainer.innerHTML = `
        <div style="color: #F44336;">
          <p><strong>Error:</strong> Failed to start load test</p>
          <p>${error.message}</p>
        </div>
      `;
      this.resetLoadTestButton();
    }
  }

  /**
   * Complete load test and show results
   */
  completeLoadTest(testInfo) {
    const outputContainer = document.getElementById('test-output');
    
    outputContainer.innerHTML = `
      <div class="test-info">
        <p><strong>Test Completed:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Duration:</strong> ${testInfo.duration/1000} seconds</p>
        <p><strong>Intensity:</strong> ${testInfo.intensity}</p>
        <p><strong>Status:</strong> <span style="color: #4CAF50;">Completed</span></p>
      </div>
      <div style="margin-top: 1rem; padding: 1rem; background: rgba(76, 175, 80, 0.1); border-radius: 8px;">
        <p><strong>✅ Load test completed successfully!</strong></p>
        <p>Check the metrics above to see the impact on system performance during the test.</p>
        <p>The system should return to normal levels shortly.</p>
      </div>
    `;

    this.resetLoadTestButton();
  }

  /**
   * Reset load test button to initial state
   */
  resetLoadTestButton() {
    const button = document.getElementById('start-load-test');
    if (button) {
      button.disabled = false;
      button.innerHTML = '<i class="fas fa-rocket"></i> Start Load Test';
    }
    this.loadTestInProgress = false;
  }

  /**
   * Start auto-refresh for real-time data
   */
  startAutoRefresh() {
    // Refresh data every 30 seconds
    this.refreshInterval = setInterval(() => {
      if (this.currentPage === 'metrics') {
        this.loadMetrics();
      } else if (this.currentPage === 'overview') {
        this.loadEnvironmentInfo();
      }
    }, 30000);
  }

  /**
   * Stop auto-refresh
   */
  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Format uptime in human-readable format
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Get color for metric based on percentage
   */
  getMetricColor(percentage) {
    if (percentage < 50) return '#4CAF50'; // Green
    if (percentage < 80) return '#FF9800'; // Orange
    return '#F44336'; // Red
  }

  /**
   * Show loading error message
   */
  showLoadingError(dataType) {
    console.error(`Failed to load ${dataType}`);
    // Could show user-friendly error messages here
  }

  /**
   * Show general error message
   */
  showError(message) {
    console.error(message);
    // Could implement toast notifications or error banners here
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.ephemeralDemo = new EphemeralDemo();
});

// Handle page visibility changes to pause/resume auto-refresh
document.addEventListener('visibilitychange', () => {
  if (window.ephemeralDemo) {
    if (document.hidden) {
      window.ephemeralDemo.stopAutoRefresh();
    } else {
      window.ephemeralDemo.startAutoRefresh();
    }
  }
});