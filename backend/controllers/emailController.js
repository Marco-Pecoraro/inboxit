const { syncEmailsFromGmail, trashEmail, getEmails } = require('../services/emailService');

exports.syncEmails = async (req, res) => {
    try {
        const token = req.headers.authorization?.split('Bearer ')[1];
        console.log('Token ricevuto in syncEmails:', token ? 'Presente' : 'Assente');
        if (!token) {
            return res.status(401).json({ message: 'Token mancante' });
        }

        const emails = await syncEmailsFromGmail(token);
        console.log('Email sincronizzate:', emails.length);
        res.json(emails);
    } catch (err) {
        console.error('Errore sincronizzazione in controller:', err.message, err.stack);
        res.status(500).json({ message: 'Errore sincronizzazione email', error: err.message });
    }
};

exports.trashEmail = async (req, res) => {
    try {
        const token = req.headers.authorization?.split('Bearer ')[1];
        console.log('Token ricevuto in trashEmail:', token ? 'Presente' : 'Assente');
        if (!token) {
            return res.status(401).json({ message: 'Token mancante' });
        }

        const { emailId } = req.body;
        if (!emailId) {
            return res.status(400).json({ message: 'ID email mancante' });
        }

        const result = await trashEmail(token, emailId);
        console.log('Email spostata nel cestino:', emailId);
        res.json(result);
    } catch (err) {
        console.error('Errore spostamento email:', err.message, err.stack);
        res.status(500).json({ message: 'Errore spostamento email nel cestino', error: err.message });
    }
};

exports.getEmails = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 150;
        const emails = await getEmails(limit === 0 ? null : limit);
        console.log('Email recuperate:', emails.length);
        res.json(emails);
    } catch (err) {
        console.error('Errore recupero email:', err.message, err.stack);
        res.status(500).json({ message: 'Errore recupero email', error: err.message });
    }
};