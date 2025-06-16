class LoadBalancer {
  constructor() {
    this.instances = new Map();
    this.currentIndex = new Map();
  }

  // Round-robin load balancing
  getNextInstance(serviceName) {
    const routeConfig = require('../config/routes');
    const serviceUrl = routeConfig.services[serviceName];
    
    if (!serviceUrl) {
      throw new Error(`Service ${serviceName} not found`);
    }

    // For now, return single instance
    // In production, this would cycle through multiple instances
    return serviceUrl;
  }

  // Health check for service instances
  async checkHealth(serviceUrl) {
    try {
      const response = await fetch(`${serviceUrl}/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Add service instance
  addInstance(serviceName, url) {
    if (!this.instances.has(serviceName)) {
      this.instances.set(serviceName, []);
    }
    this.instances.get(serviceName).push(url);
  }

  // Remove unhealthy instance
  removeInstance(serviceName, url) {
    if (this.instances.has(serviceName)) {
      const instances = this.instances.get(serviceName);
      const index = instances.indexOf(url);
      if (index > -1) {
        instances.splice(index, 1);
      }
    }
  }
}

module.exports = {
  loadBalancer: new LoadBalancer()
};