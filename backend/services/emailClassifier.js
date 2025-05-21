const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function classifyEmail({ subject, body }) {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const prompt = `
Sei un assistente AI. Ti fornisco il contenuto di una email. 
Rispondi SOLO con un array JSON contenente categorie rilevanti tra: 
["inbox", "important", "trash", "spam", "calendar", "meetings", "sent"].

Esempio: ["inbox", "meetings"]

Email:
Oggetto: ${subject}
Contenuto: ${body}
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        try {
            const categories = JSON.parse(text);
            if (Array.isArray(categories)) {
                return categories;
            }
        } catch (parseErr) {
            console.error('Errore parsing risposta Gemini:', parseErr, text);
        }

        return ['inbox'];
    } catch (err) {
        console.error('Errore generazione Gemini:', err.message);
        return ['inbox'];
    }
}

module.exports = { classifyEmail };
