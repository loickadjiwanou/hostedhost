import express from "express"
import { getDB } from "../config/database.js"
import { authenticateToken } from "../utils/auth.js"
import { logger } from "../utils/logger.js"
import { getStaticSiteUrl, getDynamicSiteUrl } from "../utils/fileSystem.js"

const router = express.Router()

// Obtenir tous les projets de l'utilisateur
router.get("/", authenticateToken, async (req, res) => {
  try {
    const db = getDB()

    const projects = await db
      .collection("projects")
      .find({
        userId: req.userId,
      })
      .toArray()

    const userProjects = projects.map((project) => ({
      ...project,
      id: project._id.toString(),
      url: project.type === "static" ? getStaticSiteUrl(project.name) : getDynamicSiteUrl(project.port),
    }))

    res.json({
      success: true,
      projects: userProjects,
    })
  } catch (error) {
    logger.error("GET_PROJECTS_ERROR", error.message, req.userId)
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des projets",
    })
  }
})

// Obtenir un projet spécifique
router.get("/:projectId", authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params
    const db = getDB()

    const { ObjectId } = await import("mongodb")
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(projectId),
    })

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Projet non trouvé",
      })
    }

    if (project.userId !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "Accès interdit à ce projet",
      })
    }

    res.json({
      success: true,
      project: {
        ...project,
        id: project._id.toString(),
        url: project.type === "static" ? getStaticSiteUrl(project.name) : getDynamicSiteUrl(project.port),
      },
    })
  } catch (error) {
    logger.error("GET_PROJECT_ERROR", error.message, req.userId)
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération du projet",
    })
  }
})

// Supprimer un projet
router.delete("/:projectId", authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params
    const db = getDB()

    const { ObjectId } = await import("mongodb")
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(projectId),
    })

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Projet non trouvé",
      })
    }

    if (project.userId !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "Accès interdit à ce projet",
      })
    }

    // Supprimer le projet de la base de données
    await db.collection("projects").deleteOne({
      _id: new ObjectId(projectId),
    })

    // TODO: Supprimer les fichiers du projet et arrêter les processus
    // deleteProjectDirectory(project.type, project.name, req.userId);

    logger.userAction(req.userId, "PROJECT_DELETED", `Project: ${project.name}, Type: ${project.type}`)

    res.json({
      success: true,
      message: "Projet supprimé avec succès",
    })
  } catch (error) {
    logger.error("DELETE_PROJECT_ERROR", error.message, req.userId)
    res.status(500).json({
      success: false,
      message: "Erreur lors de la suppression du projet",
    })
  }
})

// Obtenir les statistiques de l'utilisateur
router.get("/stats/overview", authenticateToken, async (req, res) => {
  try {
    const db = getDB()

    const projects = await db
      .collection("projects")
      .find({
        userId: req.userId,
      })
      .toArray()

    let staticSites = 0
    let dynamicSites = 0
    let totalSize = 0

    projects.forEach((project) => {
      if (project.type === "static") {
        staticSites++
      } else {
        dynamicSites++
      }
      totalSize += project.size || 0
    })

    res.json({
      success: true,
      stats: {
        totalProjects: staticSites + dynamicSites,
        staticSites,
        dynamicSites,
        totalSize,
        maxProjects: 10, // Limite simulée
        storageUsed: totalSize,
        maxStorage: 1000, // 1GB limite simulée
      },
    })
  } catch (error) {
    logger.error("GET_STATS_ERROR", error.message, req.userId)
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des statistiques",
    })
  }
})

export default router
