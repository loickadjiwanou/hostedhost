const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const User = require('./models/User');

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 5000;
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sampledb';

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected');
}).catch(err => {
  console.error('MongoDB connection error:', err.message);
  process.exit(1);
});

app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = new User({ username, password });
    await user.save();
    res.json(user);
  } catch (err) {
    console.error('Error in /register:', err.message);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

app.get('/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    console.error('Error in /users:', err.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});