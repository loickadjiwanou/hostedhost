import express from 'express';
import { getDB } from '../config/database.js';
import { hashPassword, comparePassword, generateToken, authenticateToken } from '../utils/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Inscription
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs sont requis'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Le mot de passe doit contenir au moins 6 caractères'
      });
    }

    const db = getDB();

    // Vérifier si l'utilisateur existe déjà
    for (const [id, user] of db.users) {
      if (user.email === email || user.username === username) {
        return res.status(409).json({
          success: false,
          message: 'Un utilisateur avec cet email ou ce nom d\'utilisateur existe déjà'
        });
      }
    }

    // Créer l'utilisateur
    const userId = Date.now().toString();
    const hashedPassword = await hashPassword(password);
    
    const newUser = {
      id: userId,
      username,
      email,
      password: hashedPassword,
      createdAt: new Date(),
      projects: []
    };

    db.users.set(userId, newUser);
    logger.userAction(userId, 'USER_REGISTERED', `Username: ${username}, Email: ${email}`);

    const token = generateToken(userId);

    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès',
      token,
      user: {
        id: userId,
        username,
        email,
        createdAt: newUser.createdAt
      }
    });

  } catch (error) {
    logger.error('REGISTER_ERROR', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du compte'
    });
  }
});

// Connexion
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
    }

    const db = getDB();

    // Trouver l'utilisateur
    let foundUser = null;
    for (const [id, user] of db.users) {
      if (user.email === email) {
        foundUser = { id, ...user };
        break;
      }
    }

    if (!foundUser) {
      logger.warn('LOGIN_FAILED', `Email not found: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await comparePassword(password, foundUser.password);
    if (!isPasswordValid) {
      logger.warn('LOGIN_FAILED', `Invalid password for: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    logger.userAction(foundUser.id, 'USER_LOGIN', `Email: ${email}`);

    const token = generateToken(foundUser.id);

    res.json({
      success: true,
      message: 'Connexion réussie',
      token,
      user: {
        id: foundUser.id,
        username: foundUser.username,
        email: foundUser.email,
        createdAt: foundUser.createdAt
      }
    });

  } catch (error) {
    logger.error('LOGIN_ERROR', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion'
    });
  }
});

// Vérifier le token
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const db = getDB();
    const user = db.users.get(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    logger.error('ME_ERROR', error.message, req.userId);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil'
    });
  }
});

export default router;