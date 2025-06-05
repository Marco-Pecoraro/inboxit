const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function classifyEmail({ subject, body }) {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
        const prompt = `
        Sei un assistente AI. Analizza questa email e restituisci SOLO un array JSON con categorie rilevanti tra:
        ["Posta in arrivo", "Inviate", "Importanti", "Riunioni", "Calendario", "Spam", "Cestino", "Promozioni", "Da rispondere"].
        Può includere più categorie. Se nessuna è rilevante, usa ["Posta in arrivo"].

        - Usa "Promozioni" per email di marketing, offerte, newsletter o promozioni commerciali.
        - Usa "Da rispondere" per email che richiedono una risposta, come domande, richieste dirette o email non lette non inviate dall'utente.
        - Usa "Riunioni" per email relative a riunioni, come inviti a Zoom o Microsoft Teams.
        - Usa "Calendario" per inviti a eventi o promemoria di calendario.
        - Usa "Importanti" per email contrassegnate come importanti o con contenuto critico.
        - Usa "Spam" per email indesiderate o sospette.
        - Usa "Cestino" per email eliminate.
        - Usa "Inviate" per email inviate dall'utente.
        - Usa "Posta in arrivo" come categoria predefinita per email generiche.

        Esempio: ["Posta in arrivo", "Promozioni"]

        Oggetto: ${subject || '(nessun oggetto)'}
        Contenuto: ${body?.substring(0, 500) || '...'}
        `;
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const categories = JSON.parse(text);
        if (!Array.isArray(categories)) throw new Error('Risposta non è un array');
        const validCategories = categories.filter(c => ['Posta in arrivo', 'Inviate', 'Importanti', 'Riunioni', 'Calendario', 'Spam', 'Cestino', 'Promozioni', 'Da rispondere'].includes(c));
        return validCategories.length ? validCategories : ['Posta in arrivo'];
    } catch (err) {
        console.error('Errore classificazione email:', err.message);
        return ['Posta in arrivo'];
    }
}

module.exports = { classifyEmail };