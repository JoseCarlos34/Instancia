cat > server.js <<'EOF'
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// Ruta raíz
app.get('/', (req, res) => {
  res.send('Servidor activo ✅ Usa /register, /login, /ranking, /partidos...');
});

// Registro de usuario
app.post('/register', async (req, res) => {
  const { nombre, correo, contrasena } = req.body;
  if (!nombre || !correo || !contrasena) return res.status(400).json({ error: 'Faltan datos' });

  const [users] = await pool.query('SELECT id FROM usuarios WHERE correo = ?', [correo]);
  if (users.length > 0) return res.status(400).json({ error: 'Correo ya registrado' });

  const hash = await bcrypt.hash(contrasena, 10);
  await pool.query('INSERT INTO usuarios (nombre, correo, contrasena) VALUES (?, ?, ?)', [nombre, correo, hash]);

  res.json({ message: 'Usuario registrado exitosamente' });
});

// Login
app.post('/login', async (req, res) => {
  const { correo, contrasena } = req.body;
  if (!correo || !contrasena) return res.status(400).json({ error: 'Faltan datos' });

  const [users] = await pool.query('SELECT * FROM usuarios WHERE correo = ?', [correo]);
  if (users.length === 0) return res.status(400).json({ error: 'Credenciales inválidas' });

  const user = users[0];
  const valid = await bcrypt.compare(contrasena, user.contrasena);
  if (!valid) return res.status(400).json({ error: 'Credenciales inválidas' });

  res.json({ message: 'Login exitoso', usuario: { id: user.id, nombre: user.nombre } });
});

// Ranking
app.get('/ranking', async (req, res) => {
  const [rows] = await pool.query('SELECT id, nombre, liga, ranking FROM equipos ORDER BY ranking ASC');
  res.json(rows);
});

// Partidos
app.get('/partidos', async (req, res) => {
  const [rows] = await pool.query(`
    SELECT p.id, p.fecha, el.nombre AS equipo_local, ev.nombre AS equipo_visitante
    FROM partidos p
    JOIN equipos el ON p.equipo_local_id = el.id
    JOIN equipos ev ON p.equipo_visitante_id = ev.id
    ORDER BY p.fecha ASC
  `);
  res.json(rows);
});

// Recomendaciones por usuario
app.get('/recomendacion/:usuario_id', async (req, res) => {
  const userId = req.params.usuario_id;
  const [rows] = await pool.query(`
    SELECT e.id, e.nombre, e.liga, e.ranking
    FROM preferencias p
    JOIN equipos e ON p.equipo_id = e.id
    WHERE p.usuario_id = ?
    ORDER BY e.ranking ASC
  `, [userId]);
  res.json(rows);
});

app.listen(PORT, () => {
console.log(`Servidor corriendo en http://localhost:${PORT}`);

});
