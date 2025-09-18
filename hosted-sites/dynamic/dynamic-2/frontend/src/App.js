import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [users, setUsers] = useState([]);
  const [backendPort, setBackendPort] = useState(null);
  const projectName = 'dynac';

  const fetchPort = async () => {
    for (let retries = 3; retries > 0; retries--) {
      try {
        const res = await axios.get(`http://127.0.0.1:8055/project-port/${projectName}`);
        setBackendPort(res.data.port);
        return;
      } catch (err) {
        console.error(`Error fetching backend port (attempt ${4 - retries}):`, err.message);
        if (retries === 1) {
          console.error('Failed to fetch backend port after retries');
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
      }
    }
  };

  useEffect(() => {
    fetchPort();
  }, []);

  const fetchUsers = async () => {
    if (!backendPort) {
      console.error('Backend port not available');
      return;
    }
    try {
      const res = await axios.get(`http://localhost:${backendPort}/users`);
      setUsers(res.data);
    } catch (err) {
      console.error('Error fetching users:', err.message);
    }
  };

  useEffect(() => {
    if (backendPort) {
      fetchUsers();
    }
  }, [backendPort]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    if (!backendPort) {
      console.error('Backend port not available');
      return;
    }
    try {
      await axios.post(`http://localhost:${backendPort}/register`, { username, password });
      setUsername('');
      setPassword('');
      fetchUsers();
    } catch (err) {
      console.error('Error registering user:', err.message);
    }
  };

  return (
    <div style={{
      maxWidth: 400,
      margin: '40px auto',
      padding: 20,
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      backgroundColor: '#f9f9f9',
      borderRadius: 8,
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ textAlign: 'center', color: '#333' }}>Register</h2>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{
            padding: '10px 12px',
            fontSize: 16,
            borderRadius: 5,
            border: '1.5px solid #ccc',
            outline: 'none',
            transition: 'border-color 0.3s',
          }}
          onFocus={e => (e.target.style.borderColor = '#007bff')}
          onBlur={e => (e.target.style.borderColor = '#ccc')}
        />
        
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            padding: '10px 12px',
            fontSize: 16,
            borderRadius: 5,
            border: '1.5px solid #ccc',
            outline: 'none',
            transition: 'border-color 0.3s',
          }}
          onFocus={e => (e.target.style.borderColor = '#007bff')}
          onBlur={e => (e.target.style.borderColor = '#ccc')}
        />
        
        <button
          type="submit"
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            padding: '12px 0',
            fontSize: 18,
            fontWeight: '600',
            borderRadius: 5,
            cursor: 'pointer',
            boxShadow: '0 4px 8px rgba(0,123,255,0.3)',
            transition: 'background-color 0.3s',
          }}
          onMouseEnter={e => (e.target.style.backgroundColor = '#0056b3')}
          onMouseLeave={e => (e.target.style.backgroundColor = '#007bff')}
        >
          Register
        </button>
      </form>

      <h3 style={{ marginTop: 30, color: '#555' }}>Registered Users:</h3>
      <ul style={{ listStyle: 'none', padding: 0, maxHeight: 300, overflowY: 'auto' }}>
        {users.length === 0 && <li style={{ color: '#888' }}>No users registered yet.</li>}
        {users.map((u) => (
          <li key={u._id} style={{
            backgroundColor: 'white',
            padding: '10px 15px',
            marginBottom: 10,
            borderRadius: 5,
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
            fontWeight: '500',
            color: '#333',
          }}>
            {u.username}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;