import { logger } from './logger.js';

class PortManager {
  constructor() {
    this.usedPorts = new Set();
    this.minPort = 3001;
    this.maxPort = 4000;
  }

  allocatePort(userId, projectName) {
    for (let port = this.minPort; port <= this.maxPort; port++) {
      if (!this.usedPorts.has(port)) {
        this.usedPorts.add(port);
        logger.userAction(userId, 'PORT_ALLOCATED', `Port ${port} for project ${projectName}`);
        return port;
      }
    }
    
    logger.error('PORT_ALLOCATION_FAILED', 'No available ports', userId);
    throw new Error('Aucun port disponible');
  }

  releasePort(port, userId, projectName) {
    if (this.usedPorts.has(port)) {
      this.usedPorts.delete(port);
      logger.userAction(userId, 'PORT_RELEASED', `Port ${port} for project ${projectName}`);
    }
  }

  isPortInUse(port) {
    return this.usedPorts.has(port);
  }

  getUsedPorts() {
    return Array.from(this.usedPorts);
  }
}

export const portManager = new PortManager();