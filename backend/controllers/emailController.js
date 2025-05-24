const emailService = require('../services/emailService');
const { categorizeEmailsWithGemini } = require('./aiController');

exports.getEmails = async (req, res) => {
    try {
        const emails = await emailService.getEmails(req.user.accessToken, 100, req.user.userId);
        res.json(emails);
    } catch (error) {
        console.error("Errore getEmails:", error);
        res.status(500).json({ message: 'Errore nel caricamento delle email' });
    }
};

exports.syncEmails = async (req, res) => {
    try {
        const syncedEmails = await emailService.syncEmailsFromGmail(req.user.accessToken, req.user.userId);

        // Categorizza automaticamente con Gemini
        const categorized = await categorizeEmailsWithGemini(syncedEmails, req.user.userId);
        res.json(categorized);
    } catch (err) {
        console.error("Errore syncEmails:", err);
        res.status(500).json({ message: "Errore durante la sincronizzazione delle email" });
    }
};

exports.sendEmail = async (req, res) => {
    const { to, subject, body } = req.body;
    try {
        const result = await emailService.sendEmail(req.user.accessToken, to, subject, body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Errore invio email' });
    }
};

exports.trashEmail = async (req, res) => {
    const { emailId } = req.body;
    try {
        const result = await emailService.trashEmail(req.user.accessToken, emailId, req.user.userId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Errore spostamento email nel cestino' });
    }
};

exports.updateCategories = async (req, res) => {
    try {
        const emails = req.body.emails;
        const result = await emailService.updateEmailCategories(req.user.userId, emails);
        res.json(result);
    } catch (err) {
        console.error("Errore updateCategories:", err);
        res.status(500).json({ message: "Errore aggiornamento categorie" });
    }
};
