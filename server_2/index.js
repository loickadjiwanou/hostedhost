import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import hostingRoutes from './routes/hosting.js';
import { connectDB } from './config/database.js';
import { initializeDirectories } from './utils/fileSystem.js';
import { logger } from './utils/logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Initialisation de la base de données
await connectDB();

// Initialisation des répertoires
await initializeDirectories();

// Middlewares de sécurité
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// Middlewares de logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(`HTTP: ${message.trim()}`)
  }
}));

// Middlewares de parsing
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/hosting', hostingRoutes);

// Servir les sites statiques hébergés
app.use('/hosted', express.static(path.join(__dirname, '../hosted-sites')));

// Route de santé
app.get('/api/health', (req, res) => {
  logger.info('Health check requested');
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  logger.error(`Global error: ${err.message}`, err);
  res.status(500).json({ 
    success: false, 
    message: 'Une erreur interne du serveur s\'est produite' 
  });
});

// Gestionnaire de routes non trouvées
app.use('*', (req, res) => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    success: false, 
    message: 'Route non trouvée' 
  });
});

app.listen(PORT, () => {
  logger.info(`🚀 Serveur d'hébergement démarré sur le port ${PORT}`);
  console.log(`🌐 Interface d'administration: http://localhost:5173`);
  console.log(`📁 Sites hébergés: http://localhost:${PORT}/hosted/`);
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  logger.info('Arrêt du serveur demandé');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Rejection non gérée à ${promise}:`, reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Exception non capturée:', error);
  process.exit(1);
});