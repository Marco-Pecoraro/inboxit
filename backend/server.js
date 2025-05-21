const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

if (!process.env.MONGO_URI) {
    console.error('Errore: MONGO_URI non definito nel file .env');
    process.exit(1);
}

const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const emailController = require('./controllers/emailController');
const eventController = require('./controllers/eventController');
const aiController = require('./controllers/aiController');

const app = express();

// Configura middleware per gestire payload più grandi
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(passport.initialize());
app.use('/img', express.static(path.join(__dirname, '../frontend/img')));
app.use(express.static(path.join(__dirname, '../frontend/login')));
app.use('/home', express.static(path.join(__dirname, '../frontend/home')));

// Middleware per verificare il token JWT
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error('Errore autenticazione: Token mancante o malformato', { headers: req.headers });
        return res.status(401).json({ message: 'Token mancante o malformato' });
    }

    const token = authHeader.split('Bearer ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded.userId || !decoded.accessToken || !decoded.email) {
            console.error('Errore autenticazione: Token non valido, informazioni utente mancanti', decoded);
            return res.status(403).json({ message: 'Token non valido: informazioni utente mancanti' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        console.error('Errore autenticazione: Token non valido o scaduto', err.message);
        return res.status(403).json({ message: `Token non valido o scaduto: ${err.message}` });
    }
};

// Configurazione Google OAuth
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: 'http://localhost:8888/auth/google/callback'
}, (accessToken, refreshToken, profile, done) => {
    try {
        console.log('Google OAuth callback ricevuto, profilo:', {
            id: profile.id,
            email: profile.emails?.[0]?.value,
            name: profile.displayName
        });
        if (!profile.emails || !profile.emails[0]) {
            console.error('Errore OAuth: Nessun email trovata nel profilo utente', profile);
            return done(new Error('Nessun email trovata nel profilo utente'));
        }
        const user = {
            accessToken,
            userId: profile.id,
            email: profile.emails[0].value,
            name: profile.displayName || ''
        };
        console.log('Dati utente OAuth:', user);
        return done(null, user);
    } catch (err) {
        console.error('Errore configurazione Google OAuth:', err.message);
        return done(err);
    }
}));

// Connessione a MongoDB
mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.DB_NAME
}).then(() => {
    console.log('Connesso a MongoDB');
}).catch(err => {
    console.error('Errore connessione MongoDB:', err);
    process.exit(1);
});

// Route per autenticazione Google
app.get('/auth/google', (req, res, next) => {
    console.log('Inizio flusso OAuth, redirect_uri:', 'http://localhost:8888/auth/google/callback');
    passport.authenticate('google', {
        scope: ['profile', 'email', 'https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send']
    })(req, res, next);
});

// Callback OAuth
app.get('/auth/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/?error=auth_failed' }), (req, res) => {
    try {
        const { accessToken, userId, email, name } = req.user;
        if (!accessToken || !userId || !email) {
            console.error('Errore callback OAuth: Dati utente incompleti', req.user);
            return res.redirect('/?error=auth_failed');
        }
        const jwtToken = jwt.sign({ accessToken, userId, email, name }, process.env.JWT_SECRET, { expiresIn: '1h' });
        console.log('JWT generato con successo per userId:', userId);
        res.redirect(`/home?token=${jwtToken}`);
    } catch (err) {
        console.error('Errore callback OAuth:', err.message);
        res.redirect('/?error=auth_failed');
    }
});

// Route API
app.get('/api/user', verifyToken, (req, res) => {
    try {
        console.log('Richiesta /api/user, restituisco dati utente:', { email: req.user.email, name: req.user.name });
        res.json({ email: req.user.email, name: req.user.name || '' });
    } catch (err) {
        console.error('Errore recupero dati utente:', err.message);
        res.status(500).json({ message: 'Errore recupero dati utente' });
    }
});

app.get('/api/emails', verifyToken, emailController.getEmails);
app.post('/api/emails/sync', verifyToken, emailController.syncEmails);
app.post('/api/emails/send', verifyToken, emailController.sendEmail);
app.post('/api/emails/trash', verifyToken, emailController.trashEmail);
app.post('/api/emails/update-categories', verifyToken, emailController.updateCategories);
app.post('/api/ai/reply', verifyToken, aiController.generateReply);
app.post('/api/ai/gemini-reply', verifyToken, aiController.generateReply);
app.post('/api/ai/categorize', verifyToken, aiController.categorizeEmail);
app.get('/api/events', verifyToken, eventController.getEvents);
app.post('/api/events', verifyToken, eventController.addEvent);
app.delete('/api/events/:id', verifyToken, eventController.deleteEvent);

// Route per la pagina principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login/index.html'));
});

// Route per la pagina home
app.get('/home', (req, res) => {
    const token = req.query.token || req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
        console.error('Accesso a /home senza token', { query: req.query, headers: req.headers });
        return res.redirect('/?error=auth_required');
    }
    console.log('Caricamento pagina /home con token:', token.substring(0, 20) + '...');
    res.sendFile(path.join(__dirname, '../frontend/home/index.html'));
});

// Middleware per gestire errori non catturati
app.use((err, req, res, next) => {
    console.error('Errore non gestito:', err.message, err.stack);
    res.status(500).json({ message: `Errore server: ${err.message}` });
});

const PORT = process.env.PORT || 8888;
app.listen(PORT, () => {
    console.log(`Server in esecuzione sulla porta ${PORT}`);
});