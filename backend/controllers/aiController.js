const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const categories = ['inbox', 'sent', 'important', 'meetings', 'spam', 'trash', 'calendar'];

exports.generateReply = async (req, res) => {
    try {
        const { body } = req.body;
        if (!body) {
            console.error('Dati mancanti per generateReply:', req.body);
            return res.status(400).json({ message: 'Contenuto email mancante' });
        }

        console.log('Generazione risposta AI per email:', body.substring(0, 50) + '...');

        const prompt = `Sei un assistente AI per email. Scrivi una risposta professionale e concisa all'email seguente:\n\n${body}\n\nRispondi in italiano, mantenendo un tono formale e appropriato al contesto.`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o', // Usa gpt-4o, fallback a gpt-3.5-turbo se necessario
            messages: [
                { role: 'system', content: 'Sei un assistente esperto nella scrittura di email.' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 500,
            temperature: 0.7
        });

        const reply = response.choices[0].message.content.trim();
        console.log('Risposta AI generata:', reply.substring(0, 50) + '...');
        res.json({ reply });
    } catch (err) {
        console.error('Errore generazione risposta AI:', err.message);
        if (err.response && err.response.status === 404) {
            console.error('Modello non trovato:', err.response.data);
            return res.status(404).json({ message: 'Modello non disponibile. Contatta l\'amministratore.' });
        }
        res.status(500).json({ message: 'Errore durante la generazione della risposta AI' });
    }
};

exports.categorizeEmail = async (req, res) => {
    try {
        const { emails } = req.body;
        if (!emails || !Array.isArray(emails)) {
            console.error('Dati mancanti per categorizeEmail:', req.body);
            return res.status(400).json({ message: 'Lista email mancante o non valida' });
        }

        console.log('Categorizzazione email per userId:', req.user.userId, 'Numero email:', emails.length);

        const categorizedEmails = await Promise.all(emails.map(async (email) => {
            if (email.categories && email.categories.length > 0) {
                console.log('Email già categorizzata:', email.id);
                return { id: email.id, categories: email.categories };
            }

            const content = `${email.subject || ''}\n${email.body || ''}`.substring(0, 1000);
            const prompt = `Sei un assistente AI per la categorizzazione di email. Analizza il contenuto dell'email e assegna una o più categorie appropriate tra: ${categories.join(', ')}. Fornisci la risposta come un array di categorie (es. ["inbox", "important"]). Contenuto email:\n\n${content}`;

            const response = await openai.chat.completions.create({
                model: 'gpt-4o', // Usa gpt-4o, fallback a gpt-3.5-turbo
                messages: [
                    { role: 'system', content: 'Sei un assistente esperto nella categorizzazione di email.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 100,
                temperature: 0.5
            });

            let assignedCategories = JSON.parse(response.choices[0].message.content.trim());
            if (!Array.isArray(assignedCategories)) {
                assignedCategories = ['inbox'];
            }
            assignedCategories = assignedCategories.filter(cat => categories.includes(cat));
            if (assignedCategories.length === 0) {
                assignedCategories = ['inbox'];
            }

            console.log('Categorie assegnate per email', email.id, ':', assignedCategories);
            return { id: email.id, categories: assignedCategories };
        }));

        res.json(categorizedEmails);
    } catch (err) {
        console.error('Errore categorizzazione email:', err.message);
        if (err.response && err.response.status === 404) {
            console.error('Modello non trovato:', err.response.data);
            return res.status(404).json({ message: 'Modello non disponibile. Contatta l\'amministratore.' });
        }
        res.status(500).json({ message: 'Errore durante la categorizzazione delle email' });
    }
};