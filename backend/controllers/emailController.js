const emailService = require('../services/emailService');

exports.getEmails = async (req, res) => {
    try {
        const emails = await emailService.getEmails(req.user.accessToken, req.query.limit, req.user.userId);
        res.json(emails);
    } catch (err) {
        console.error('Errore recupero email:', err.message);
        res.status(500).json({ error: 'Errore durante il recupero delle email' });
    }
};

exports.syncEmails = async (req, res) => {
    try {
        const emails = await emailService.syncEmailsFromGmail(req.user.accessToken, req.user.userId);
        res.json(emails);
    } catch (err) {
        console.error('Errore sincronizzazione email:', err.message);
        res.status(500).json({ error: 'Errore durante la sincronizzazione delle email' });
    }
};

exports.sendEmail = async (req, res) => {
    const { to, subject, body } = req.body;
    if (!to || !subject || !body) {
        return res.status(400).json({ error: 'Dati email incompleti' });
    }
    try {
        const result = await emailService.sendEmail(req.user.accessToken, to, subject, body);
        res.json(result);
    } catch (err) {
        console.error('Errore invio email:', err.message);
        res.status(500).json({ error: 'Errore durante l\'invio dell\'email' });
    }
};

exports.trashEmail = async (req, res) => {
    const { emailId } = req.body;
    if (!emailId) {
        return res.status(400).json({ error: 'ID email mancante' });
    }
    try {
        const result = await emailService.trashEmail(req.user.accessToken, emailId, req.user.userId);
        res.json(result);
    } catch (err) {
        console.error('Errore eliminazione email:', err.message);
        res.status(500).json({ error: 'Errore durante l\'eliminazione dell\'email' });
    }
};

exports.updateCategories = async (req, res) => {
    const { emails } = req.body;
    if (!Array.isArray(emails) || !emails.length) {
        return res.status(400).json({ error: 'Email non valide' });
    }
    try {
        const result = await emailService.updateEmailCategories(req.user.userId, emails);
        res.json(result);
    } catch (err) {
        console.error('Errore aggiornamento categorie:', err.message);
        res.status(500).json({ error: 'Errore durante l\'aggiornamento delle categorie' });
    }
};

exports.getAttachment = async (req, res) => {
    const { emailId, attachmentId } = req.params;
    if (!emailId || !attachmentId) {
        return res.status(400).json({ error: 'ID email o allegato mancante' });
    }
    try {
        const attachment = await emailService.getAttachment(req.user.accessToken, emailId, attachmentId);
        const data = Buffer.from(attachment.data, 'base64');
        res.set({
            'Content-Type': attachment.mimeType,
            'Content-Disposition': `attachment; filename="${attachment.filename}"`,
            'Content-Length': attachment.size
        });
        res.send(data);
    } catch (err) {
        console.error('Errore download allegato:', err.message);
        res.status(500).json({ error: 'Errore durante il download dell\'allegato' });
    }
};