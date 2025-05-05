// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const emailController = require('./controller');
const { verifyToken } = require('./middleware');

const app = express();

// Configura middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Configura serving dei file statici
app.use('/home', express.static('frontend/home'));

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
    res.redirect(`/home?token=${token}`);
});

// Rotte API
app.get('/api/emails', verifyToken, emailController.getEmails);
app.post('/api/emails/sync', verifyToken, emailController.syncEmails);
app.post('/api/emails/trash', verifyToken, emailController.trashEmail);

// Rotta per la pagina principale
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/frontend/index.html');
});

// Rotta per la pagina home
app.get('/home', (req, res) => {
    res.sendFile(__dirname + '/frontend/home/index.html');
});

// Avvio del server
const PORT = process.env.PORT || 8888;
app.listen(PORT, () => {
    console.log(`Server in esecuzione sulla porta ${PORT}`);
});