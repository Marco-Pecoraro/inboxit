const { GoogleGenerativeAI } = require('@google/generative-ai');
const dedent = require('dedent');
const MongoDB = require('../mongodb');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

const CATEGORY_IDS = ['Posta in arrivo', 'Inviate', 'Importanti', 'Riunioni', 'Calendario', 'Spam', 'Cestino'];
const delay = ms => new Promise(res => setTimeout(res, ms));

async function quickCategorize(email) {
    if (!email || !email.id) return defaultCategory('Posta in arrivo');
    if (email.gmailLabelIds?.includes('TRASH')) return defaultCategory('Cestino', '#e66550', '#ffffff');
    if (email.gmailLabelIds?.includes('SPAM')) return defaultCategory('Spam', '#ffad47', '#000000');
    if (email.gmailLabelIds?.includes('IMPORTANT')) return defaultCategory('Importanti', '#4a86e8', '#ffffff');
    if (email.gmailLabelIds?.includes('SENT')) return defaultCategory('Inviate', '#c9daf8', '#000000');
    return null;
}

function defaultCategory(category, backgroundColor = '#ffffff', textColor = '#000000') {
    return { id: 'unknown', categories: [category], backgroundColor, textColor };
}

async function categorizeSingleEmail(email) {
    const quick = await quickCategorize(email);
    if (quick) return { ...quick, id: email.id };

    const prompt = dedent`
    Categorizza questa email in una delle seguenti categorie: ${CATEGORY_IDS.join(', ')}.
    Rispondi SOLO con un oggetto JSON nel formato:
    {"category": "Categoria", "backgroundColor": "#hex", "textColor": "#hex"}

    Oggetto: ${email.subject || '(nessun oggetto)'}
    Contenuto: ${email.body?.substring(0, 500) || '(vuoto)'}
    `;

    try {
        const result = await model.generateContent(prompt);
        const json = JSON.parse(result.response.text().trim());
        const category = CATEGORY_IDS.includes(json.category) ? json.category : 'Posta in arrivo';
        return {
            id: email.id,
            categories: [category],
            backgroundColor: json.backgroundColor || '#ffffff',
            textColor: json.textColor || '#000000'
        };
    } catch (err) {
        console.error(`Errore categorizzazione AI (${email.id}):`, err.message);
        return defaultCategory('Posta in arrivo');
    }
}

async function processEmailBatch(emails, batchSize = 10) {
    const results = [];
    for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize);
        const res = await Promise.all(batch.map(email => categorizeSingleEmail(email)));
        results.push(...res);
        await delay(1500);
    }
    return results;
}

exports.categorizeEmail = async (req, res) => {
    try {
        const { emails } = req.body;
        if (!Array.isArray(emails) || emails.length === 0) return res.status(400).json({ error: 'Email non valide' });

        const categorized = await processEmailBatch(emails);
        const result = await updateCategoriesInMongoDB(req.user.userId, categorized);
        console.log(`Mongo aggiornato: ${result.modifiedCount} modifiche`);
        res.json(categorized);
    } catch (err) {
        console.error('Errore categorizzazione:', err.message);
        res.status(500).json({ error: 'Errore durante la categorizzazione' });
    }
};

exports.generateReply = async (req, res) => {
    const { email, userStyle = {} } = req.body;
    if (!email?.id) return res.status(400).json({ error: 'Email mancante' });

    const prompt = dedent`
    <system>
    Sei un assistente AI. Scrivi una risposta professionale a questa email in italiano:
    - Oggetto: ${email.subject}
    - Corpo: ${email.body?.slice(0, 500)}
    Rispondi come il mittente. Usa uno stile formale.
    </system>
    `;

    try {
        const result = await model.generateContent(prompt);
        res.json({ id: email.id, reply: result.response.text().trim() });
    } catch (err) {
        console.error('Errore risposta Gemini:', err.message);
        res.status(500).json({ error: 'Errore durante la generazione della risposta' });
    }
};

async function updateCategoriesInMongoDB(userId, categorizedEmails) {
    const mongo = new MongoDB();
    const db = await mongo.getDb();
    const bulkOps = categorizedEmails.map(email => ({
        updateOne: {
            filter: { id: email.id, userId },
            update: { $set: email },
            upsert: true
        }
    }));
    const result = await db.collection('emails').bulkWrite(bulkOps);
    return result;
}

exports.categorizeEmailsWithGemini = async (emails, userId) => {
    const results = await processEmailBatch(emails, 10, 2000);
    await updateCategoriesInMongoDB(userId, results);
    return results;
};