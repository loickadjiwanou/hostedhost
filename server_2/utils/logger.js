import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGS_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOGS_DIR, 'host-logs.txt');

// Créer le répertoire des logs s'il n'existe pas
try {
  await fs.access(LOGS_DIR);
} catch {
  await fs.mkdir(LOGS_DIR, { recursive: true });
}

class Logger {
  constructor() {
    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };
  }

  formatMessage(level, userId = 'SYSTEM', action, details = '') {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${userId}] ${level} ${action} - ${details}\n`;
  }

  async writeLog(message) {
    try {
      await fs.appendFile(LOG_FILE, message);
      console.log(message.trim()); // Aussi afficher dans la console
    } catch (error) {
      console.error('Erreur d\'écriture des logs:', error);
    }
  }

  error(action, details = '', userId = 'SYSTEM') {
    const message = this.formatMessage('ERROR', userId, action, details);
    this.writeLog(message);
  }

  warn(action, details = '', userId = 'SYSTEM') {
    const message = this.formatMessage('WARN', userId, action, details);
    this.writeLog(message);
  }

  info(action, details = '', userId = 'SYSTEM') {
    const message = this.formatMessage('INFO', userId, action, details);
    this.writeLog(message);
  }

  debug(action, details = '', userId = 'SYSTEM') {
    const message = this.formatMessage('DEBUG', userId, action, details);
    this.writeLog(message);
  }

  // Méthodes spéciales pour les actions utilisateur
  userAction(userId, action, details = '') {
    this.info(action, details, userId);
  }

  deployment(userId, projectName, type, status, details = '') {
    this.info(`DEPLOYMENT_${status.toUpperCase()}`, `Project: ${projectName}, Type: ${type}, ${details}`, userId);
  }

  async getLogs(limit = 100) {
    try {
      const content = await fs.readFile(LOG_FILE, 'utf8');
      const lines = content.trim().split('\n');
      return lines.slice(-limit);
    } catch (error) {
      console.error('Erreur de lecture des logs:', error);
      return [];
    }
  }
}

export const logger = new Logger();