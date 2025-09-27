import express from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());

const users = [
  { username: 'admin', passwordHash: bcrypt.hashSync('password123', 10) },
];

app.post('/api/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'credenciales invalidas' });

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) return res.status(401).json({ error: 'credenciales invalidas' });

  const token = jwt.sign({ username: user.username }, 'secreto', { expiresIn: '1h' });
  res.json({ token });
});


app.get('/api/mallas/:codigo/:catalogo', async (req: Request, res: Response) => {
  const { codigo, catalogo } = req.params;

  try {
    const url = `https://losvilos.ucn.cl/hawaii/api/mallas?${codigo}-${catalogo}`;
    const response = await fetch(url, {
      headers: { 'X-HAWAII-AUTH': 'jf400fejof13f' }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Error al obtener malla' });
    }

    const data = await response.json();
    console.log('Datos recibidos del API externo:', data);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en el servidor proxy' });
  }
});


app.listen(3000, () => console.log('Servidor escuchando en puerto 3000'));