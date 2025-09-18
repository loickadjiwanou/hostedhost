import { MongoClient } from 'mongodb';
import { logger } from '../utils/logger.js';

let db;
let client;

export async function connectDB() {
  try {
    // Pour cet exemple, on simule une base de données en mémoire
    // Dans un environnement de production, utilisez une vraie URL MongoDB
    const url = process.env.MONGODB_URI || 'mongodb://localhost:27017/ho-host';
    
    // Simulation d'une connexion MongoDB
    logger.info('Simulation de connexion à MongoDB...');
    
    // Base de données simulée en mémoire
    db = {
      users: new Map(),
      projects: new Map(),
      logs: []
    };
    
    logger.info('✅ Base de données simulée initialisée avec succès');
    return db;
  } catch (error) {
    logger.error('❌ Erreur de connexion à la base de données:', error);
    process.exit(1);
  }
}

export function getDB() {
  if (!db) {
    throw new Error('Base de données non initialisée');
  }
  return db;
}

export async function closeDB() {
  if (client) {
    await client.close();
    logger.info('Connexion à la base de données fermée');
  }
}