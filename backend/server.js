const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Verifica che MONGO_URI sia definito
if (!process.env.MONGO_URI) {
    console.error('Errore: MONGO_URI non definito nel file .env');
    process.exit(1);
}

console.log('MONGO_URI:', process.env.MONGO_URI);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('CLIENT_ID:', process.env.CLIENT_ID);

const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const emailController = require('./controllers/emailController');

const app = express();

// Middleware per verificare il token JWT
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Token mancante o malformato' });
    }

    const token = authHeader.split('Bearer ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Token non valido o scaduto' });
    }
};

// Configura middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Serve la cartella img
app.use('/img', express.static(path.join(__dirname, '../frontend/img')));

// Serve la cartella login
app.use(express.static(path.join(__dirname, '../frontend/login')));

// Serve la cartella home
app.use('/home', express.static(path.join(__dirname, '../frontend/home')));

// Configura Passport per Google OAuth
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: 'http://localhost:8888/auth/google/callback'
}, (accessToken, refreshToken, profile, done) => {
    return done(null, { accessToken, profile });
}));

// Connessione a MongoDB
mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.DB_NAME
}).then(() => {
    console.log('Connesso a MongoDB');
}).catch(err => {
    console.error('Errore connessione MongoDB:', err);
});

// Rotte di autenticazione
app.get('/auth/google', passport.authenticate('google', {
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/gmail.readonly']
}));

app.get('/auth/google/callback', passport.authenticate('google', { session: false }), (req, res) => {
    const token = req.user.accessToken;
    const jwtToken = jwt.sign({ accessToken: token }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.redirect(`/home?token=${jwtToken}`);
});

// Rotte API protette
app.get('/api/emails', verifyToken, emailController.getEmails);
app.post('/api/emails/sync', verifyToken, emailController.syncEmails);
app.post('/api/emails/trash', verifyToken, emailController.trashEmail);

// Rotta per la pagina principale (login)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login/index.html'));
});

// Rotta per la pagina home
app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/home/index.html'));
});

// Avvio del server
const PORT = process.env.PORT || 8888;
app.listen(PORT, () => {
    console.log(`Server in esecuzione sulla porta ${PORT}`);
});