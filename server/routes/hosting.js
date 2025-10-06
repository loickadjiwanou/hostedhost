import express from "express"
import multer from "multer"
import AdmZip from "adm-zip"
import fs from "fs/promises"
import path from "path"
import { getDB } from "../config/database.js"
import { authenticateToken } from "../utils/auth.js"
import { logger } from "../utils/logger.js"
import { getUploadsDir, createProjectDirectory, getStaticSiteUrl, getDynamicSiteUrl } from "../utils/fileSystem.js"
import { portManager } from "../utils/portManager.js"

const router = express.Router()

// Configuration de multer pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getUploadsDir())
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, uniqueSuffix + "-" + file.originalname)
  },
})

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "application/zip" ||
      file.mimetype === "application/x-zip-compressed" ||
      file.originalname.endsWith(".zip")
    ) {
      cb(null, true)
    } else {
      cb(new Error("Seuls les fichiers ZIP sont acceptés"), false)
    }
  },
})

// Déployer un site statique
router.post("/deploy/static", authenticateToken, upload.single("zipFile"), async (req, res) => {
  let tempFilePath = null
  let projectPath = null

  try {
    const { projectName, description } = req.body

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Fichier ZIP requis",
      })
    }

    if (!projectName || !projectName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Nom du projet requis",
      })
    }

    const db = getDB()
    const existingProject = await db.collection("projects").findOne({
      userId: req.userId,
      name: projectName.trim(),
    })

    if (existingProject) {
      return res.status(409).json({
        success: false,
        message: "Un projet avec ce nom existe déjà",
      })
    }

    tempFilePath = req.file.path
    logger.userAction(req.userId, "STATIC_DEPLOY_STARTED", `Project: ${projectName}, File: ${req.file.originalname}`)

    // Créer le répertoire du projet
    projectPath = await createProjectDirectory("static", projectName.trim(), req.userId)

    // Extraire le fichier ZIP
    const zip = new AdmZip(tempFilePath)
    zip.extractAllTo(projectPath, true)

    // Vérifier qu'il y a au moins un fichier index.html
    const files = await fs.readdir(projectPath, { withFileTypes: true })
    let hasIndexHtml = false

    for (const file of files) {
      if (file.name === "index.html" && file.isFile()) {
        hasIndexHtml = true
        break
      }
    }

    if (!hasIndexHtml) {
      // Chercher dans les sous-dossiers
      for (const file of files) {
        if (file.isDirectory()) {
          try {
            const subFiles = await fs.readdir(path.join(projectPath, file.name))
            if (subFiles.includes("index.html")) {
              hasIndexHtml = true
              break
            }
          } catch (e) {
            // Ignorer les erreurs de lecture des sous-dossiers
          }
        }
      }
    }

    if (!hasIndexHtml) {
      logger.warn("NO_INDEX_HTML", `Project: ${projectName}`, req.userId)
    }

    // Calculer la taille approximative
    const stats = await fs.stat(projectPath)
    const size = Math.round(req.file.size / (1024 * 1024)) // MB

    const newProject = {
      userId: req.userId,
      name: projectName.trim(),
      description: description || "",
      type: "static",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      size,
      hasIndexHtml,
      files: files.length,
    }

    const result = await db.collection("projects").insertOne(newProject)
    const projectId = result.insertedId.toString()

    // Nettoyer le fichier temporaire
    await fs.unlink(tempFilePath)
    tempFilePath = null

    logger.deployment(req.userId, projectName, "static", "success", `Size: ${size}MB, Files: ${files.length}`)

    res.json({
      success: true,
      message: "Site statique déployé avec succès",
      project: {
        ...newProject,
        id: projectId,
        url: getStaticSiteUrl(projectName.trim()),
      },
    })
  } catch (error) {
    logger.deployment(req.userId, req.body.projectName || "unknown", "static", "failed", error.message)

    // Nettoyer en cas d'erreur
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath)
      } catch (e) {
        // Ignorer les erreurs de suppression
      }
    }

    res.status(500).json({
      success: false,
      message: error.message || "Erreur lors du déploiement du site statique",
    })
  }
})


// Déployer un site dynamique
router.post("/deploy/dynamic", authenticateToken, upload.single("zipFile"), async (req, res) => {
  let tempFilePath = null
  let projectPath = null
  let allocatedPort = null

  try {
    logger.info("Début du déploiement dynamique", JSON.stringify({ userId: req.userId, body: req.body }))

    const { projectName, description } = req.body

    if (!req.file) {
      logger.error("Aucun fichier ZIP reçu", JSON.stringify({ userId: req.userId }))
      return res.status(400).json({ success: false, message: "Fichier ZIP requis" })
    }
    logger.info("Fichier ZIP reçu", JSON.stringify({ file: req.file.originalname, userId: req.userId }))

    if (!projectName || !projectName.trim()) {
      logger.error("Nom du projet manquant", JSON.stringify({ userId: req.userId }))
      return res.status(400).json({ success: false, message: "Nom du projet requis" })
    }

    const db = getDB()
    logger.info("Connexion à la base de données réussie", JSON.stringify({ userId: req.userId }))

    const existingProject = await db.collection("projects").findOne({
      userId: req.userId,
      name: projectName.trim(),
    })
    if (existingProject) {
      logger.error("Projet déjà existant", JSON.stringify({ projectName, userId: req.userId }))
      return res.status(409).json({ success: false, message: "Un projet avec ce nom existe déjà" })
    }

    tempFilePath = req.file.path
    logger.info("Chemin du fichier temporaire défini", JSON.stringify({ tempFilePath, userId: req.userId }))

    // Créer le répertoire du projet
    projectPath = await createProjectDirectory("dynamic", projectName.trim(), req.userId)
    logger.info("Répertoire du projet créé", JSON.stringify({ projectPath, userId: req.userId }))

    // Extraire le fichier ZIP temporairement
    const tempExtractPath = path.join(projectPath, "temp_extract")
    await fs.mkdir(tempExtractPath)
    logger.info("Répertoire temporaire d'extraction créé", JSON.stringify({ tempExtractPath, userId: req.userId }))

    const zip = new AdmZip(tempFilePath)
    zip.extractAllTo(tempExtractPath, true)
    logger.info("Extraction du ZIP terminée", JSON.stringify({ tempExtractPath, userId: req.userId }))

    // Recherche récursive des dossiers frontend et backend
    async function findDirs(root) {
      let frontend = null, backend = null
      let entries
      try {
        entries = await fs.readdir(root, { withFileTypes: true })
      } catch (e) {
        logger.error("Erreur lecture dossier dans findDirs", JSON.stringify({ root, error: e.message, userId: req.userId }))
        return { frontend, backend }
      }
      for (const entry of entries) {
        const fullPath = path.join(root, entry.name)
        if (entry.isDirectory()) {
          logger.info("Exploration dossier", JSON.stringify({ fullPath, userId: req.userId }))
          if (entry.name.toLowerCase() === "frontend") frontend = fullPath
          if (entry.name.toLowerCase() === "backend") backend = fullPath
          if (!frontend || !backend) {
            const sub = await findDirs(fullPath)
            frontend = frontend || sub.frontend
            backend = backend || sub.backend
          }
        }
      }
      return { frontend, backend }
    }
    logger.info("Recherche des dossiers frontend et backend...", JSON.stringify({ tempExtractPath, userId: req.userId }))
    const { frontend: frontendDir, backend: backendDir } = await findDirs(tempExtractPath)
    logger.info("Résultat de la recherche", JSON.stringify({ frontendDir, backendDir, userId: req.userId }))
    if (!frontendDir || !backendDir) {
      logger.error("Dossiers frontend ou backend non trouvés", JSON.stringify({ tempExtractPath, userId: req.userId }))
      throw new Error('Structure invalide: les dossiers "frontend" et "backend" sont requis')
    }

    // Vérifier les package.json
    const frontendPackageJson = path.join(frontendDir, "package.json")
    const backendPackageJson = path.join(backendDir, "package.json")
    let frontendPackage, backendPackage
    try {
      logger.info("Lecture du package.json frontend", JSON.stringify({ frontendPackageJson, userId: req.userId }))
      frontendPackage = JSON.parse(await fs.readFile(frontendPackageJson, "utf8"))
    } catch (e) {
      logger.error("Erreur lecture package.json frontend", JSON.stringify({ error: e.message, userId: req.userId }))
      throw new Error("package.json manquant ou invalide dans le dossier frontend")
    }
    try {
      logger.info("Lecture du package.json backend", JSON.stringify({ backendPackageJson, userId: req.userId }))
      backendPackage = JSON.parse(await fs.readFile(backendPackageJson, "utf8"))
    } catch (e) {
      logger.error("Erreur lecture package.json backend", JSON.stringify({ error: e.message, userId: req.userId }))
      throw new Error("package.json manquant ou invalide dans le dossier backend")
    }

    // Déplacer les dossiers à leur emplacement final
    const finalFrontendDir = path.join(projectPath, "frontend")
    const finalBackendDir = path.join(projectPath, "backend")
    await fs.rm(finalFrontendDir, { recursive: true, force: true }).catch(() => {})
    await fs.rm(finalBackendDir, { recursive: true, force: true }).catch(() => {})
    logger.info("Suppression des anciens dossiers frontend/backend si existants", JSON.stringify({ userId: req.userId }))
    await fs.rename(frontendDir, finalFrontendDir)
    await fs.rename(backendDir, finalBackendDir)
    logger.info("Déplacement des dossiers frontend/backend terminé", JSON.stringify({ userId: req.userId }))

    // Nettoyer le dossier temporaire
    await fs.rm(tempExtractPath, { recursive: true, force: true })
    logger.info("Nettoyage du dossier temporaire terminé", JSON.stringify({ userId: req.userId }))

    // Allouer un port pour le backend
    allocatedPort = portManager.allocatePort(req.userId, projectName.trim())
    logger.info("Port backend alloué", JSON.stringify({ allocatedPort, userId: req.userId }))

    // Vérifier la configuration du frontend (.env)
    const frontendEnvPath = path.join(finalFrontendDir, ".env")
    let envVars = [
      `VITE_API_URL=http://localhost:${allocatedPort}`,
      `BACKEND_ADRESSE=http://localhost:${allocatedPort}`,
    ]
    let envContent = ""
    try {
      envContent = await fs.readFile(frontendEnvPath, "utf8")
      envVars = envVars.filter(v => !envContent.includes(v.split("=")[0]))
      logger.info("Lecture du fichier .env frontend réussie", JSON.stringify({ frontendEnvPath, userId: req.userId }))
    } catch (e) {
      logger.warn("Fichier .env frontend absent, il sera créé", JSON.stringify({ frontendEnvPath, userId: req.userId }))
    }
    if (envVars.length) {
      await fs.appendFile(frontendEnvPath, envVars.join("\n") + "\n")
      logger.info("Ajout des variables au fichier .env frontend", JSON.stringify({ envVars, userId: req.userId }))
    }

    // Vérifier les dépendances MongoDB
    const usesMongoDB =
      (backendPackage.dependencies && (backendPackage.dependencies.mongodb || backendPackage.dependencies.mongoose)) ||
      (backendPackage.devDependencies && (backendPackage.devDependencies.mongodb || backendPackage.devDependencies.mongoose))
    logger.info("Vérification MongoDB terminée", JSON.stringify({ usesMongoDB, userId: req.userId }))

    const size = Math.round(req.file.size / (1024 * 1024))
    const newProject = {
      userId: req.userId,
      name: projectName.trim(),
      description: description || "",
      type: "dynamic",
      status: "deployed",
      createdAt: new Date(),
      updatedAt: new Date(),
      size,
      port: allocatedPort,
      usesMongoDB,
      frontendPackage: frontendPackage.name,
      backendPackage: backendPackage.name,
      dependencies: {
        frontend: Object.keys(frontendPackage.dependencies || {}),
        backend: Object.keys(backendPackage.dependencies || {}),
      },
    }
    logger.info("Insertion du projet en base", JSON.stringify({ newProject, userId: req.userId }))
    let projectId
    try {
      const result = await db.collection("projects").insertOne(newProject)
      projectId = result.insertedId.toString()
      logger.info("Projet inséré en base avec succès", JSON.stringify({ projectId, userId: req.userId }))
    } catch (error) {
      logger.error("Erreur lors de l'insertion du projet en base ou réponse API", JSON.stringify({ error: error.message, stack: error.stack, userId: req.userId }))
      logger.deployment(req.userId, req.body.projectName || "unknown", "dynamic", "failed", error.message)
      if (tempFilePath) await fs.unlink(tempFilePath).catch(() => {})
      if (projectPath) await fs.rm(projectPath, { recursive: true, force: true }).catch(() => {})
      if (allocatedPort) portManager.releasePort(allocatedPort, req.userId, req.body.projectName || "unknown")
      return res.status(500).json({
        success: false,
        message: error.message || "Erreur lors du déploiement du site dynamique",
      })
    }

    // Nettoyer le fichier temporaire
    await fs.unlink(tempFilePath)
    tempFilePath = null
    logger.info("Fichier temporaire supprimé", JSON.stringify({ userId: req.userId }))

    logger.deployment(
      req.userId,
      projectName,
      "dynamic",
      "success",
      `Port: ${allocatedPort}, MongoDB: ${usesMongoDB}, Size: ${size}MB`,
    )

    res.json({
      success: true,
      message: "Site dynamique déployé avec succès",
      project: {
        ...newProject,
        id: projectId,
        url: getDynamicSiteUrl(allocatedPort),
      },
      notes: [
        "Le projet a été déployé avec succès",
        `Backend accessible sur le port ${allocatedPort}`,
        usesMongoDB ? "MongoDB requis - instance automatique configurée" : "Aucune base de données détectée",
        envVars.length ? "Fichier .env mis à jour automatiquement" : "Configuration .env existante respectée",
      ],
    })
  } catch (error) {
    logger.error("Erreur lors du déploiement dynamique", JSON.stringify({ error: error.message, stack: error.stack, userId: req.userId }))
    logger.deployment(req.userId, req.body.projectName || "unknown", "dynamic", "failed", error.message)
    if (tempFilePath) await fs.unlink(tempFilePath).catch(() => {})
    if (projectPath) await fs.rm(projectPath, { recursive: true, force: true }).catch(() => {})
    if (allocatedPort) portManager.releasePort(allocatedPort, req.userId, req.body.projectName || "unknown")
    res.status(500).json({
      success: false,
      message: error.message || "Erreur lors du déploiement du site dynamique",
    })
  }
})
// Obtenir les logs récents
router.get("/logs", authenticateToken, async (req, res) => {
  try {
    const { limit = 50 } = req.query
    const logs = await logger.getLogs(Number.parseInt(limit))

    // Filtrer les logs pour ne montrer que ceux de l'utilisateur actuel et les logs système pertinents
    const filteredLogs = logs.filter((log) => {
      return log.includes(`[${req.userId}]`) || log.includes("[SYSTEM]") || log.includes("HTTP:")
    })

    res.json({
      success: true,
      logs: filteredLogs,
    })
  } catch (error) {
    logger.error("GET_LOGS_ERROR", error.message, req.userId)
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des logs",
    })
  }
})

// Obtenir les informations système
router.get("/system/info", authenticateToken, async (req, res) => {
  try {
    const usedPorts = portManager.getUsedPorts()

    res.json({
      success: true,
      system: {
        usedPorts,
        availablePorts: `${portManager.minPort}-${portManager.maxPort}`,
        uptime: Math.floor(process.uptime()),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version,
      },
    })
  } catch (error) {
    logger.error("GET_SYSTEM_INFO_ERROR", error.message, req.userId)
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des informations système",
    })
  }
})

export default router
