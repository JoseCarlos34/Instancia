require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Ruta raíz
app.get('/', (req, res) => {
  res.send('¡Servidor funcionando! Usa /ranking, /partidos, /recomendacion/:usuario_id, /register y /login');
});

// Configuración DB
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'apuestas_db'
};

const pool = mysql.createPool(dbConfig);

// Registro de usuario
app.post('/register', async (req, res) => {
  const { nombre, correo, contrasena } = req.body;

  if (!nombre || !correo || !contrasena) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  try {
    const [existingUser] = await pool.query('SELECT * FROM usuarios WHERE correo = ?', [correo]);
    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'El correo ya está registrado' });
    }

    const hashedPassword = await bcrypt.hash(contrasena, 10);

    await pool.query('INSERT INTO usuarios (nombre, correo, contrasena) VALUES (?, ?, ?)', [nombre, correo, hashedPassword]);

    res.json({ message: 'Usuario registrado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login de usuario
app.post('/login', async (req, res) => {
  const { correo, contrasena } = req.body;

  if (!correo || !contrasena) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE correo = ?', [correo]);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Correo o contraseña incorrectos' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(contrasena, user.contrasena);
    if (!match) {
      return res.status(400).json({ error: 'Correo o contraseña incorrectos' });
    }

    res.json({ message: 'Login exitoso', usuario: { id: user.id, nombre: user.nombre, correo: user.correo } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener ranking de equipos
app.get('/ranking', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM equipos ORDER BY ranking ASC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener partidos
app.get('/partidos', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.id, p.fecha, 
             el.nombre AS equipo_local, ev.nombre AS equipo_visitante
      FROM partidos p
      JOIN equipos el ON p.equipo_local_id = el.id
      JOIN equipos ev ON p.equipo_visitante_id = ev.id
      ORDER BY p.fecha ASC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Recomendaciones según preferencias del usuario
app.get('/recomendacion/:usuario_id', async (req, res) => {
  const userId = req.params.usuario_id;
  try {
    const [rows] = await pool.query(`
      SELECT e.*
      FROM equipos e
      JOIN preferencias p ON e.id = p.equipo_id
      WHERE p.usuario_id = ?
      ORDER BY e.ranking ASC
    `, [userId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
