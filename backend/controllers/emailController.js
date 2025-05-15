const emailService = require('../services/emailService');

exports.getEmails = async (req, res) => {
    try {
        console.log('Richiesta /api/emails per userId:', req.user.userId);
        const emails = await emailService.getEmails(req.user.accessToken, req.query.limit ? parseInt(req.query.limit) : undefined);
        console.log('Email restituite:', emails.length);
        res.json(emails);
    } catch (err) {
        console.error('Errore getEmails:', err.message);
        res.status(500).json({ message: 'Errore recupero email: ' + err.message });
    }
};

exports.syncEmails = async (req, res) => {
    try {
        console.log('Richiesta /api/emails/sync per userId:', req.user.userId);
        const emails = await emailService.syncEmailsFromGmail(req.user.accessToken, req.user.userId);
        console.log('Email sincronizzate:', emails.length);
        res.json(emails);
    } catch (err) {
        console.error('Errore syncEmails:', err.message);
        res.status(500).json({ message: 'Errore sincronizzazione email: ' + err.message });
    }
};

exports.sendEmail = async (req, res) => {
    try {
        const { to, subject, body } = req.body;
        if (!to || !subject || !body) {
            console.error('Dati mancanti per sendEmail:', req.body);
            return res.status(400).json({ message: 'Compila tutti i campi' });
        }
        console.log('Invio email per userId:', req.user.userId, { to, subject });
        const result = await emailService.sendEmail(req.user.accessToken, to, subject, body);
        res.json(result);
    } catch (err) {
        console.error('Errore sendEmail:', err.message);
        res.status(500).json({ message: 'Errore invio email: ' + err.message });
    }
};

exports.trashEmail = async (req, res) => {
    try {
        const { emailId } = req.body;
        if (!emailId) {
            console.error('emailId mancante per trashEmail');
            return res.status(400).json({ message: 'ID email mancante' });
        }
        console.log('Spostamento email nel cestino per userId:', req.user.userId, { emailId });
        const result = await emailService.trashEmail(req.user.accessToken, emailId, req.user.userId);
        res.json(result);
    } catch (err) {
        console.error('Errore trashEmail:', err.message);
        res.status(500).json({ message: 'Errore spostamento email: ' + err.message });
    }
};