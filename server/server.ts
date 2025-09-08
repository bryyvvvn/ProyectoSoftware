import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());

const users = [
    {
        username: 'admin',
        passwordHash: bcrypt.hashSync('password123', 10)
    }
];

app.post('api/login', async (req, res) => {
    const {username,password} = req.body;
    const user = users.find(u => u.username === username);
    if(!user){
        return res.status(401).json({error: 'credenciales invalidas'});
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if(!validPassword){
        return res.status(401).json({error: 'credenciales invalidas'});
    }

    const token = jwt.sign({username: user.username}, 'secreto', {expiresIn: '1hr'});
    res.json({token});
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
});
