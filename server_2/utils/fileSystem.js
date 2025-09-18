import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.join(__dirname, '../../');
const HOSTED_SITES_DIR = path.join(BASE_DIR, 'hosted-sites');
const STATIC_SITES_DIR = path.join(HOSTED_SITES_DIR, 'static');
const DYNAMIC_SITES_DIR = path.join(HOSTED_SITES_DIR, 'dynamic');
const UPLOADS_DIR = path.join(BASE_DIR, 'uploads');
const LOGS_DIR = path.join(BASE_DIR, 'logs');

export async function initializeDirectories() {
  const directories = [
    HOSTED_SITES_DIR,
    STATIC_SITES_DIR,
    DYNAMIC_SITES_DIR,
    UPLOADS_DIR,
    LOGS_DIR
  ];

  for (const dir of directories) {
    try {
      await fs.access(dir);
      logger.info(`Directory exists: ${dir}`);
    } catch {
      await fs.mkdir(dir, { recursive: true });
      logger.info(`Directory created: ${dir}`);
    }
  }
}

export function getProjectPath(type, projectName) {
  const baseDir = type === 'static' ? STATIC_SITES_DIR : DYNAMIC_SITES_DIR;
  return path.join(baseDir, projectName);
}

export function getUploadsDir() {
  return UPLOADS_DIR;
}

export async function createProjectDirectory(type, projectName, userId) {
  const projectPath = getProjectPath(type, projectName);
  
  try {
    await fs.access(projectPath);
    throw new Error(`Le projet ${projectName} existe déjà`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Le répertoire n'existe pas, on peut le créer
      await fs.mkdir(projectPath, { recursive: true });
      logger.userAction(userId, 'PROJECT_DIRECTORY_CREATED', `Path: ${projectPath}`);
      return projectPath;
    }
    throw error;
  }
}

export async function deleteProjectDirectory(type, projectName, userId) {
  const projectPath = getProjectPath(type, projectName);
  
  try {
    await fs.rm(projectPath, { recursive: true, force: true });
    logger.userAction(userId, 'PROJECT_DIRECTORY_DELETED', `Path: ${projectPath}`);
  } catch (error) {
    logger.error('DELETE_PROJECT_DIRECTORY_FAILED', error.message, userId);
    throw error;
  }
}

export async function listProjectFiles(type, projectName) {
  const projectPath = getProjectPath(type, projectName);
  
  try {
    const files = await fs.readdir(projectPath, { withFileTypes: true });
    return files.map(file => ({
      name: file.name,
      isDirectory: file.isDirectory(),
      path: path.join(projectPath, file.name)
    }));
  } catch (error) {
    return [];
  }
}

export function getStaticSiteUrl(projectName, port = 5000) {
  return `http://localhost:${port}/hosted/static/${projectName}`;
}

export function getDynamicSiteUrl(port) {
  return `http://localhost:${port}`;
}