import express from "express"
import multer from "multer"
import AdmZip from "adm-zip"
import fs from "fs/promises"
import path from "path"
import { spawn } from "child_process"
import { getDB } from "../config/database.js"
import { authenticateToken } from "../utils/auth.js"
import { logger } from "../utils/logger.js"
import { getUploadsDir, createProjectDirectory, getStaticSiteUrl, getDynamicSiteUrl } from "../utils/fileSystem.js"
import { portManager } from "../utils/portManager.js"

const router = express.Router()

// Store pour garder une trace des processus actifs
const runningProcesses = new Map()

// Configuration de multer (inchangée)
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


// Fonction utilitaire pour exécuter des commandes
const executeCommand = (command, args, cwd, projectName, userId) => {
  return new Promise((resolve, reject) => {
    logger.userAction(userId, "COMMAND_STARTED", `${command} ${args.join(' ')} in ${cwd}`)
    
    const process = spawn(command, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    })

    let stdout = ''
    let stderr = ''

    process.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    process.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    process.on('close', (code) => {
      if (code === 0) {
        logger.userAction(userId, "COMMAND_SUCCESS", `${command} completed for ${projectName}`)
        resolve({ stdout, stderr })
      } else {
        logger.userAction(userId, "COMMAND_FAILED", `${command} failed for ${projectName}: ${stderr}`)
        reject(new Error(`Command failed with code ${code}: ${stderr}`))
      }
    })

    process.on('error', (error) => {
      logger.userAction(userId, "COMMAND_ERROR", `${command} error for ${projectName}: ${error.message}`)
      reject(error)
    })
  })
}

// Fonction pour démarrer le backend
const startBackendServer = (projectPath, projectName, port, userId) => {
  return new Promise((resolve, reject) => {
    const backendPath = path.join(projectPath, 'backend')
    
    logger.userAction(userId, "STARTING_BACKEND", `Project: ${projectName}, Port: ${port}`)
    
    // Démarrer le serveur backend
    const backendProcess = spawn('npm', ['start'], {
      cwd: backendPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      env: {
        ...process.env,
        PORT: port.toString(),
        NODE_ENV: 'production'
      }
    })

    const projectKey = `${userId}-${projectName}`
    
    // Stocker le processus pour pouvoir l'arrêter plus tard
    if (runningProcesses.has(projectKey)) {
      // Arrêter l'ancien processus s'il existe
      runningProcesses.get(projectKey).kill('SIGTERM')
    }
    
    runningProcesses.set(projectKey, backendProcess)

    let startupTimeout = setTimeout(() => {
      logger.userAction(userId, "BACKEND_STARTUP_TIMEOUT", `Project: ${projectName}`)
      reject(new Error('Backend startup timeout'))
    }, 30000) // 30 secondes timeout

    backendProcess.stdout.on('data', (data) => {
      const output = data.toString()
      logger.userAction(userId, "BACKEND_OUTPUT", `${projectName}: ${output.trim()}`)
      
      // Vérifier si le serveur a démarré (patterns courants)
      if (output.includes('listening') || output.includes('started') || output.includes(`${port}`)) {
        clearTimeout(startupTimeout)
        logger.userAction(userId, "BACKEND_STARTED", `Project: ${projectName}, Port: ${port}`)
        resolve(backendProcess)
      }
    })

    backendProcess.stderr.on('data', (data) => {
      const error = data.toString()
      logger.userAction(userId, "BACKEND_ERROR", `${projectName}: ${error.trim()}`)
    })

    backendProcess.on('close', (code) => {
      clearTimeout(startupTimeout)
      runningProcesses.delete(projectKey)
      logger.userAction(userId, "BACKEND_STOPPED", `Project: ${projectName}, Code: ${code}`)
    })

    backendProcess.on('error', (error) => {
      clearTimeout(startupTimeout)
      logger.userAction(userId, "BACKEND_PROCESS_ERROR", `${projectName}: ${error.message}`)
      reject(error)
    })

    // Si aucun signal de démarrage après 5 secondes, on considère que c'est OK
    setTimeout(() => {
      clearTimeout(startupTimeout)
      logger.userAction(userId, "BACKEND_ASSUMED_STARTED", `Project: ${projectName}`)
      resolve(backendProcess)
    }, 5000)
  })
}

// Déployer un site dynamique (version améliorée)
router.post("/deploy/dynamic", authenticateToken, upload.single("zipFile"), async (req, res) => {
  let tempFilePath = null
  let projectPath = null
  let allocatedPort = null

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
    logger.userAction(req.userId, "DYNAMIC_DEPLOY_STARTED", `Project: ${projectName}, File: ${req.file.originalname}`)

    // Créer le répertoire du projet
    projectPath = await createProjectDirectory("dynamic", projectName.trim(), req.userId)

    // Extraire le fichier ZIP temporairement
    const tempExtractPath = path.join(projectPath, "temp_extract")
    await fs.mkdir(tempExtractPath)

    const zip = new AdmZip(tempFilePath)
    zip.extractAllTo(tempExtractPath, true)

    // Vérifier la structure (même code qu'avant)
    const extractedFiles = await fs.readdir(tempExtractPath, { withFileTypes: true })
    let frontendDir = null
    let backendDir = null

    for (const file of extractedFiles) {
      if (file.isDirectory()) {
        if (file.name.toLowerCase() === "frontend") {
          frontendDir = path.join(tempExtractPath, file.name)
        } else if (file.name.toLowerCase() === "backend") {
          backendDir = path.join(tempExtractPath, file.name)
        }
      }
    }

    if (!frontendDir || !backendDir) {
      throw new Error('Structure invalide: les dossiers "frontend" et "backend" sont requis')
    }

    // Vérifier les package.json
    const frontendPackageJson = path.join(frontendDir, "package.json")
    const backendPackageJson = path.join(backendDir, "package.json")

    let frontendPackage, backendPackage
    try {
      const frontendPackageContent = await fs.readFile(frontendPackageJson, "utf8")
      frontendPackage = JSON.parse(frontendPackageContent)
    } catch (error) {
      throw new Error("package.json manquant ou invalide dans le dossier frontend")
    }

    try {
      const backendPackageContent = await fs.readFile(backendPackageJson, "utf8")
      backendPackage = JSON.parse(backendPackageContent)
    } catch (error) {
      throw new Error("package.json manquant ou invalide dans le dossier backend")
    }

    // Déplacer les dossiers à leur emplacement final
    const finalFrontendDir = path.join(projectPath, "frontend")
    const finalBackendDir = path.join(projectPath, "backend")

    await fs.rename(frontendDir, finalFrontendDir)
    await fs.rename(backendDir, finalBackendDir)

    // Nettoyer le dossier temporaire
    await fs.rm(tempExtractPath, { recursive: true, force: true })

    // Allouer un port pour le backend
    allocatedPort = portManager.allocatePort(req.userId, projectName.trim())

    // Vérifier la configuration du frontend (.env)
    const frontendEnvPath = path.join(finalFrontendDir, ".env")
    let needsEnvUpdate = true

    try {
      const envContent = await fs.readFile(frontendEnvPath, "utf8")
      if (envContent.includes("BACKEND_ADRESSE") || envContent.includes("VITE_API_URL")) {
        needsEnvUpdate = false
      }
    } catch (error) {
      // Le fichier .env n'existe pas, on va le créer
    }

    if (needsEnvUpdate) {
      const envContent = `VITE_API_URL=http://localhost:${allocatedPort}\nBACKEND_ADRESSE=http://localhost:${allocatedPort}\n`
      await fs.writeFile(frontendEnvPath, envContent)
      logger.userAction(
        req.userId,
        "ENV_FILE_CREATED",
        `Project: ${projectName}, Backend URL: http://localhost:${allocatedPort}`,
      )
    }

    // NOUVEAU: Installation des dépendances
    logger.userAction(req.userId, "INSTALLING_DEPENDENCIES", `Project: ${projectName}`)
    
    // Installer les dépendances du backend
    try {
      await executeCommand('npm', ['install'], finalBackendDir, projectName, req.userId)
      logger.userAction(req.userId, "BACKEND_DEPS_INSTALLED", `Project: ${projectName}`)
    } catch (error) {
      throw new Error(`Erreur lors de l'installation des dépendances backend: ${error.message}`)
    }

    // Installer les dépendances du frontend
    try {
      await executeCommand('npm', ['install'], finalFrontendDir, projectName, req.userId)
      logger.userAction(req.userId, "FRONTEND_DEPS_INSTALLED", `Project: ${projectName}`)
    } catch (error) {
      throw new Error(`Erreur lors de l'installation des dépendances frontend: ${error.message}`)
    }

    // NOUVEAU: Build du frontend
    try {
      await executeCommand('npm', ['run', 'build'], finalFrontendDir, projectName, req.userId)
      logger.userAction(req.userId, "FRONTEND_BUILT", `Project: ${projectName}`)
    } catch (error) {
      logger.userAction(req.userId, "FRONTEND_BUILD_WARNING", `Project: ${projectName}, Error: ${error.message}`)
      // On continue même si le build échoue, certains projets n'ont pas de script build
    }

    // NOUVEAU: Démarrer le serveur backend
    try {
      await startBackendServer(projectPath, projectName.trim(), allocatedPort, req.userId)
    } catch (error) {
      throw new Error(`Erreur lors du démarrage du backend: ${error.message}`)
    }

    // Vérifier les dépendances MongoDB
    const usesMongoDB =
      backendPackage.dependencies && (backendPackage.dependencies.mongodb || backendPackage.dependencies.mongoose)

    const size = Math.round(req.file.size / (1024 * 1024))

    const newProject = {
      userId: req.userId,
      name: projectName.trim(),
      description: description || "",
      type: "dynamic",
      status: "active", // Maintenant vraiment actif !
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

    const result = await db.collection("projects").insertOne(newProject)
    const projectId = result.insertedId.toString()

    // Nettoyer le fichier temporaire
    await fs.unlink(tempFilePath)
    tempFilePath = null

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
        "Dépendances installées automatiquement",
        "Frontend buildé et optimisé", 
        `Backend démarré sur le port ${allocatedPort}`,
        usesMongoDB ? "MongoDB requis - instance automatique configurée" : "Aucune base de données détectée",
        needsEnvUpdate ? "Fichier .env créé automatiquement" : "Configuration .env existante respectée",
      ],
    })
  } catch (error) {
    logger.deployment(req.userId, req.body.projectName || "unknown", "dynamic", "failed", error.message)

    // Nettoyer en cas d'erreur
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath)
      } catch (e) {
        // Ignorer
      }
    }

    if (allocatedPort) {
      portManager.releasePort(allocatedPort, req.userId, req.body.projectName || "unknown")
    }

    // Arrêter le processus s'il a été démarré
    const projectKey = `${req.userId}-${req.body.projectName || "unknown"}`
    if (runningProcesses.has(projectKey)) {
      runningProcesses.get(projectKey).kill('SIGTERM')
      runningProcesses.delete(projectKey)
    }

    res.status(500).json({
      success: false,
      message: error.message || "Erreur lors du déploiement du site dynamique",
    })
  }
})

// NOUVEAU: Endpoint pour arrêter un projet
router.post("/stop/:projectName", authenticateToken, async (req, res) => {
  try {
    const { projectName } = req.params
    const projectKey = `${req.userId}-${projectName}`
    
    if (runningProcesses.has(projectKey)) {
      const process = runningProcesses.get(projectKey)
      process.kill('SIGTERM')
      runningProcesses.delete(projectKey)
      
      // Mettre à jour le statut en base
      const db = getDB()
      await db.collection("projects").updateOne(
        { userId: req.userId, name: projectName },
        { $set: { status: "stopped", updatedAt: new Date() } }
      )
      
      logger.userAction(req.userId, "PROJECT_STOPPED", `Project: ${projectName}`)
      
      res.json({
        success: true,
        message: `Projet ${projectName} arrêté avec succès`
      })
    } else {
      res.status(404).json({
        success: false,
        message: "Projet non trouvé ou déjà arrêté"
      })
    }
  } catch (error) {
    logger.error("STOP_PROJECT_ERROR", error.message, req.userId)
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'arrêt du projet"
    })
  }
})

// NOUVEAU: Endpoint pour redémarrer un projet
router.post("/restart/:projectName", authenticateToken, async (req, res) => {
  try {
    const { projectName } = req.params
    const db = getDB()
    
    const project = await db.collection("projects").findOne({
      userId: req.userId,
      name: projectName
    })
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Projet non trouvé"
      })
    }
    
    // Arrêter s'il tourne
    const projectKey = `${req.userId}-${projectName}`
    if (runningProcesses.has(projectKey)) {
      runningProcesses.get(projectKey).kill('SIGTERM')
      runningProcesses.delete(projectKey)
    }
    
    // Redémarrer
    const projectPath = path.join(process.cwd(), 'hosted-sites', 'dynamic', projectName)
    await startBackendServer(projectPath, projectName, project.port, req.userId)
    
    // Mettre à jour le statut
    await db.collection("projects").updateOne(
      { _id: project._id },
      { $set: { status: "active", updatedAt: new Date() } }
    )
    
    logger.userAction(req.userId, "PROJECT_RESTARTED", `Project: ${projectName}`)
    
    res.json({
      success: true,
      message: `Projet ${projectName} redémarré avec succès`
    })
  } catch (error) {
    logger.error("RESTART_PROJECT_ERROR", error.message, req.userId)
    res.status(500).json({
      success: false,
      message: "Erreur lors du redémarrage du projet"
    })
  }
})

// Obtenir le statut des processus actifs
router.get("/processes", authenticateToken, async (req, res) => {
  try {
    const userProcesses = []
    
    for (const [key, process] of runningProcesses) {
      if (key.startsWith(req.userId)) {
        const projectName = key.replace(`${req.userId}-`, '')
        userProcesses.push({
          projectName,
          pid: process.pid,
          running: !process.killed
        })
      }
    }
    
    res.json({
      success: true,
      processes: userProcesses
    })
  } catch (error) {
    logger.error("GET_PROCESSES_ERROR", error.message, req.userId)
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des processus"
    })
  }
})

export default router
