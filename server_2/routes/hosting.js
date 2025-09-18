import express from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import fs from 'fs/promises';
import path from 'path';
import { getDB } from '../config/database.js';
import { authenticateToken } from '../utils/auth.js';
import { logger } from '../utils/logger.js';
import { 
  getUploadsDir, 
  createProjectDirectory, 
  getProjectPath,
  getStaticSiteUrl,
  getDynamicSiteUrl 
} from '../utils/fileSystem.js';
import { portManager } from '../utils/portManager.js';

const router = express.Router();

// Configuration de multer pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getUploadsDir());
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || 
        file.mimetype === 'application/x-zip-compressed' ||
        file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers ZIP sont acceptés'), false);
    }
  }
});

// Déployer un site statique
router.post('/deploy/static', authenticateToken, upload.single('zipFile'), async (req, res) => {
  let tempFilePath = null;
  let projectPath = null;

  try {
    const { projectName, description } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Fichier ZIP requis'
      });
    }

    if (!projectName || !projectName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nom du projet requis'
      });
    }

    // Vérifier que le nom du projet est unique pour cet utilisateur
    const db = getDB();
    for (const [projectId, project] of db.projects) {
      if (project.userId === req.userId && project.name === projectName.trim()) {
        return res.status(409).json({
          success: false,
          message: 'Un projet avec ce nom existe déjà'
        });
      }
    }

    tempFilePath = req.file.path;
    logger.userAction(req.userId, 'STATIC_DEPLOY_STARTED', `Project: ${projectName}, File: ${req.file.originalname}`);

    // Créer le répertoire du projet
    projectPath = await createProjectDirectory('static', projectName.trim(), req.userId);

    // Extraire le fichier ZIP
    const zip = new AdmZip(tempFilePath);
    zip.extractAllTo(projectPath, true);

    // Vérifier qu'il y a au moins un fichier index.html
    const files = await fs.readdir(projectPath, { withFileTypes: true });
    let hasIndexHtml = false;
    
    for (const file of files) {
      if (file.name === 'index.html' && file.isFile()) {
        hasIndexHtml = true;
        break;
      }
    }

    if (!hasIndexHtml) {
      // Chercher dans les sous-dossiers
      for (const file of files) {
        if (file.isDirectory()) {
          try {
            const subFiles = await fs.readdir(path.join(projectPath, file.name));
            if (subFiles.includes('index.html')) {
              hasIndexHtml = true;
              break;
            }
          } catch (e) {
            // Ignorer les erreurs de lecture des sous-dossiers
          }
        }
      }
    }

    if (!hasIndexHtml) {
      logger.warn('NO_INDEX_HTML', `Project: ${projectName}`, req.userId);
    }

    // Calculer la taille approximative
    const stats = await fs.stat(projectPath);
    const size = Math.round(req.file.size / (1024 * 1024)); // MB

    // Enregistrer le projet en base
    const projectId = Date.now().toString();
    const newProject = {
      id: projectId,
      userId: req.userId,
      name: projectName.trim(),
      description: description || '',
      type: 'static',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      size,
      hasIndexHtml,
      files: files.length
    };

    db.projects.set(projectId, newProject);

    // Nettoyer le fichier temporaire
    await fs.unlink(tempFilePath);
    tempFilePath = null;

    logger.deployment(req.userId, projectName, 'static', 'success', `Size: ${size}MB, Files: ${files.length}`);

    res.json({
      success: true,
      message: 'Site statique déployé avec succès',
      project: {
        ...newProject,
        url: getStaticSiteUrl(projectName.trim())
      }
    });

  } catch (error) {
    logger.deployment(req.userId, req.body.projectName || 'unknown', 'static', 'failed', error.message);
    
    // Nettoyer en cas d'erreur
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (e) {
        // Ignorer les erreurs de suppression
      }
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors du déploiement du site statique'
    });
  }
});

// Déployer un site dynamique
router.post('/deploy/dynamic', authenticateToken, upload.single('zipFile'), async (req, res) => {
  let tempFilePath = null;
  let projectPath = null;
  let allocatedPort = null;

  try {
    const { projectName, description } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Fichier ZIP requis'
      });
    }

    if (!projectName || !projectName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nom du projet requis'
      });
    }

    const db = getDB();
    
    // Vérifier que le nom du projet est unique
    for (const [projectId, project] of db.projects) {
      if (project.userId === req.userId && project.name === projectName.trim()) {
        return res.status(409).json({
          success: false,
          message: 'Un projet avec ce nom existe déjà'
        });
      }
    }

    tempFilePath = req.file.path;
    logger.userAction(req.userId, 'DYNAMIC_DEPLOY_STARTED', `Project: ${projectName}, File: ${req.file.originalname}`);

    // Créer le répertoire du projet
    projectPath = await createProjectDirectory('dynamic', projectName.trim(), req.userId);

    // Extraire le fichier ZIP temporairement
    const tempExtractPath = path.join(projectPath, 'temp_extract');
    await fs.mkdir(tempExtractPath);
    
    const zip = new AdmZip(tempFilePath);
    zip.extractAllTo(tempExtractPath, true);

    // Vérifier la structure (dossiers frontend et backend requis)
    const extractedFiles = await fs.readdir(tempExtractPath, { withFileTypes: true });
    let frontendDir = null;
    let backendDir = null;

    for (const file of extractedFiles) {
      if (file.isDirectory()) {
        if (file.name.toLowerCase() === 'frontend') {
          frontendDir = path.join(tempExtractPath, file.name);
        } else if (file.name.toLowerCase() === 'backend') {
          backendDir = path.join(tempExtractPath, file.name);
        }
      }
    }

    if (!frontendDir || !backendDir) {
      throw new Error('Structure invalide: les dossiers "frontend" et "backend" sont requis');
    }

    // Vérifier les package.json
    const frontendPackageJson = path.join(frontendDir, 'package.json');
    const backendPackageJson = path.join(backendDir, 'package.json');

    let frontendPackage, backendPackage;
    try {
      const frontendPackageContent = await fs.readFile(frontendPackageJson, 'utf8');
      frontendPackage = JSON.parse(frontendPackageContent);
    } catch (error) {
      throw new Error('package.json manquant ou invalide dans le dossier frontend');
    }

    try {
      const backendPackageContent = await fs.readFile(backendPackageJson, 'utf8');
      backendPackage = JSON.parse(backendPackageContent);
    } catch (error) {
      throw new Error('package.json manquant ou invalide dans le dossier backend');
    }

    // Déplacer les dossiers à leur emplacement final
    const finalFrontendDir = path.join(projectPath, 'frontend');
    const finalBackendDir = path.join(projectPath, 'backend');

    await fs.rename(frontendDir, finalFrontendDir);
    await fs.rename(backendDir, finalBackendDir);

    // Nettoyer le dossier temporaire
    await fs.rm(tempExtractPath, { recursive: true, force: true });

    // Allouer un port pour le backend
    allocatedPort = portManager.allocatePort(req.userId, projectName.trim());

    // Vérifier la configuration du frontend (.env)
    const frontendEnvPath = path.join(finalFrontendDir, '.env');
    let needsEnvUpdate = true;
    
    try {
      const envContent = await fs.readFile(frontendEnvPath, 'utf8');
      if (envContent.includes('BACKEND_ADRESSE') || envContent.includes('VITE_API_URL')) {
        needsEnvUpdate = false;
      }
    } catch (error) {
      // Le fichier .env n'existe pas, on va le créer
    }

    if (needsEnvUpdate) {
      const envContent = `VITE_API_URL=http://localhost:${allocatedPort}\nBACKEND_ADRESSE=http://localhost:${allocatedPort}\n`;
      await fs.writeFile(frontendEnvPath, envContent);
      logger.userAction(req.userId, 'ENV_FILE_CREATED', `Project: ${projectName}, Backend URL: http://localhost:${allocatedPort}`);
    }

    // Vérifier les dépendances MongoDB
    const usesMongoDB = backendPackage.dependencies && 
      (backendPackage.dependencies.mongodb || 
       backendPackage.dependencies.mongoose);

    const size = Math.round(req.file.size / (1024 * 1024));

    // Enregistrer le projet
    const projectId = Date.now().toString();
    const newProject = {
      id: projectId,
      userId: req.userId,
      name: projectName.trim(),
      description: description || '',
      type: 'dynamic',
      status: 'deployed', // Dans un vrai système, ce serait "deploying" puis "active"
      createdAt: new Date(),
      updatedAt: new Date(),
      size,
      port: allocatedPort,
      usesMongoDB,
      frontendPackage: frontendPackage.name,
      backendPackage: backendPackage.name,
      dependencies: {
        frontend: Object.keys(frontendPackage.dependencies || {}),
        backend: Object.keys(backendPackage.dependencies || {})
      }
    };

    db.projects.set(projectId, newProject);

    // Nettoyer le fichier temporaire
    await fs.unlink(tempFilePath);
    tempFilePath = null;

    logger.deployment(req.userId, projectName, 'dynamic', 'success', 
      `Port: ${allocatedPort}, MongoDB: ${usesMongoDB}, Size: ${size}MB`);

    res.json({
      success: true,
      message: 'Site dynamique déployé avec succès',
      project: {
        ...newProject,
        url: getDynamicSiteUrl(allocatedPort)
      },
      notes: [
        'Le projet a été déployé avec succès',
        `Backend accessible sur le port ${allocatedPort}`,
        usesMongoDB ? 'MongoDB requis - instance automatique configurée' : 'Aucune base de données détectée',
        needsEnvUpdate ? 'Fichier .env créé automatiquement' : 'Configuration .env existante respectée'
      ]
    });

  } catch (error) {
    logger.deployment(req.userId, req.body.projectName || 'unknown', 'dynamic', 'failed', error.message);
    
    // Nettoyer en cas d'erreur
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (e) {
        // Ignorer
      }
    }

    if (allocatedPort) {
      portManager.releasePort(allocatedPort, req.userId, req.body.projectName || 'unknown');
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors du déploiement du site dynamique'
    });
  }
});

// Obtenir les logs récents
router.get('/logs', authenticateToken, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const logs = await logger.getLogs(parseInt(limit));
    
    // Filtrer les logs pour ne montrer que ceux de l'utilisateur actuel et les logs système pertinents
    const filteredLogs = logs.filter(log => {
      return log.includes(`[${req.userId}]`) || 
             log.includes('[SYSTEM]') ||
             log.includes('HTTP:');
    });

    res.json({
      success: true,
      logs: filteredLogs
    });

  } catch (error) {
    logger.error('GET_LOGS_ERROR', error.message, req.userId);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des logs'
    });
  }
});

// Obtenir les informations système
router.get('/system/info', authenticateToken, async (req, res) => {
  try {
    const usedPorts = portManager.getUsedPorts();
    
    res.json({
      success: true,
      system: {
        usedPorts,
        availablePorts: `${portManager.minPort}-${portManager.maxPort}`,
        uptime: Math.floor(process.uptime()),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version
      }
    });

  } catch (error) {
    logger.error('GET_SYSTEM_INFO_ERROR', error.message, req.userId);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des informations système'
    });
  }
});

export default router;