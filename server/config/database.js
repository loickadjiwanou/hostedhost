import { MongoClient } from "mongodb"
import { logger } from "../utils/logger.js"

let db
let client

export async function connectDB() {
  try {
    const url = process.env.MONGODB_URI || "mongodb://localhost:27017/hothost"

    logger.info(`Connexion à MongoDB: ${url}`)

    // Connexion réelle à MongoDB
    client = new MongoClient(url, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })

    await client.connect()

    // Test de la connexion
    await client.db("admin").command({ ping: 1 })

    db = client.db()

    await createIndexes()

    logger.info("✅ Connexion à MongoDB établie avec succès")
    return db
  } catch (error) {
    logger.error("❌ Erreur de connexion à MongoDB:", error)

    logger.warn("🔄 Basculement vers la base de données simulée en mémoire")
    db = {
      users: new Map(),
      projects: new Map(),
      logs: [],
      // MongoDB-like interface for compatibility
      collection: (name) => ({
        insertOne: async (doc) => {
          const id = Date.now().toString()
          doc._id = id
          db[name].set(id, doc)
          return { insertedId: id }
        },
        findOne: async (query) => {
          for (const [id, doc] of db[name]) {
            if (matchQuery(doc, query)) {
              return { _id: id, ...doc }
            }
          }
          return null
        },
        find: async (query = {}) => ({
          toArray: async () => {
            const results = []
            for (const [id, doc] of db[name]) {
              if (matchQuery(doc, query)) {
                results.push({ _id: id, ...doc })
              }
            }
            return results
          },
        }),
        updateOne: async (query, update) => {
          for (const [id, doc] of db[name]) {
            if (matchQuery(doc, query)) {
              Object.assign(doc, update.$set || update)
              return { modifiedCount: 1 }
            }
          }
          return { modifiedCount: 0 }
        },
        deleteOne: async (query) => {
          for (const [id, doc] of db[name]) {
            if (matchQuery(doc, query)) {
              db[name].delete(id)
              return { deletedCount: 1 }
            }
          }
          return { deletedCount: 0 }
        },
      }),
    }

    logger.info("✅ Base de données simulée initialisée")
    return db
  }
}

function matchQuery(doc, query) {
  if (!query || Object.keys(query).length === 0) return true

  for (const [key, value] of Object.entries(query)) {
    if (doc[key] !== value) return false
  }
  return true
}

async function createIndexes() {
  try {
    // Index pour les utilisateurs
    await db.collection("users").createIndex({ email: 1 }, { unique: true })
    await db.collection("users").createIndex({ username: 1 }, { unique: true })

    // Index pour les projets
    await db.collection("projects").createIndex({ userId: 1 })
    await db.collection("projects").createIndex({ name: 1, userId: 1 }, { unique: true })
    await db.collection("projects").createIndex({ createdAt: -1 })

    // Index pour les logs
    await db.collection("logs").createIndex({ timestamp: -1 })
    await db.collection("logs").createIndex({ userId: 1 })

    logger.info("✅ Index de base de données créés")
  } catch (error) {
    logger.warn("⚠️ Erreur lors de la création des index:", error.message)
  }
}

export function getDB() {
  if (!db) {
    throw new Error("Base de données non initialisée")
  }
  return db
}

export async function closeDB() {
  if (client) {
    await client.close()
    logger.info("Connexion à MongoDB fermée")
  }
}
