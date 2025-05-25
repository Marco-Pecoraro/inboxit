const { GoogleGenerativeAI } = require('@google/generative-ai');
const dedent = require('dedent');
const MongoDB = require('../mongodb');
const { classifyEmail } = require('../services/emailClassifier');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

const CATEGORY_IDS = ['Posta in arrivo', 'Inviate', 'Importanti', 'Riunioni', 'Calendario', 'Spam', 'Cestino', 'Promozioni', 'Da rispondere'];
const CATEGORY_COLORS = {
    'Posta in arrivo': { background: '#ffffff', text: '#000000' },
    'Inviate': { background: '#c9daf8', text: '#000000' },
    'Importanti': { background: '#4a86e8', text: '#ffffff' },
    'Riunioni': { background: '#16a766', text: '#ffffff' },
    'Calendario': { background: '#fad165', text: '#000000' },
    'Spam': { background: '#ffad47', text: '#000000' },
    'Cestino': { background: '#e66550', text: '#ffffff' },
    'Promozioni': { background: '#f4b400', text: '#000000' }, // Yellow for promotions
    'Da rispondere': { background: '#ff6f61', text: '#ffffff' } // Coral for to reply
};

const delay = ms => new Promise(res => setTimeout(res, ms));

function defaultCategory(categories, backgroundColor = '#ffffff', textColor = '#000000') {
    return { id: 'unknown', categories, backgroundColor, textColor };
}

async function quickCategorize(email) {
    if (!email || !email.id) return defaultCategory(['Posta in arrivo']);
    const categories = [];

    if (email.gmailLabelIds?.includes('TRASH')) categories.push('Cestino');
    else if (email.gmailLabelIds?.includes('SPAM')) categories.push('Spam');
    else if (email.gmailLabelIds?.includes('IMPORTANT')) categories.push('Importanti');
    else if (email.gmailLabelIds?.includes('SENT')) categories.push('Inviate');
    else if (email.gmailLabelIds?.includes('CATEGORY_PROMOTIONS')) categories.push('Promozioni');
    else if (email.gmailLabelIds?.includes('UNREAD') && !email.gmailLabelIds?.includes('SENT')) categories.push('Da rispondere');
    else categories.push('Posta in arrivo');

    return defaultCategory(categories, CATEGORY_COLORS[categories[0]]?.background, CATEGORY_COLORS[categories[0]]?.text);
}

async function categorizeSingleEmail(email) {
    const quick = await quickCategorize(email);
    if (quick.categories.length > 0 && quick.categories[0] !== 'Posta in arrivo') return { ...quick, id: email.id };

    try {
        const categories = await classifyEmail({
            subject: email.subject || '(nessun oggetto)',
            body: email.body?.substring(0, 500) || '(vuoto)'
        });

        const validCategories = categories
            .map(cat => {
                switch (cat.toLowerCase()) {
                    case 'inbox': return 'Posta in arrivo';
                    case 'sent': return 'Inviate';
                    case 'important': return 'Importanti';
                    case 'meetings': return 'Riunioni';
                    case 'calendar': return 'Calendario';
                    case 'spam': return 'Spam';
                    case 'trash': return 'Cestino';
                    case 'promotions': return 'Promozioni';
                    case 'to reply': return 'Da rispondere';
                    default: return null;
                }
            })
            .filter(cat => cat && CATEGORY_IDS.includes(cat));

        if (!validCategories.length) validCategories.push('Posta in arrivo');
        const primary = validCategories[0];

        return {
            id: email.id,
            categories: validCategories,
            backgroundColor: CATEGORY_COLORS[primary]?.background || '#ffffff',
            textColor: CATEGORY_COLORS[primary]?.text || '#000000'
        };
    } catch (err) {
        console.error(`Errore categorizzazione AI (${email.id}):`, err.message);
        return defaultCategory(['Posta in arrivo']);
    }
}

async function processEmailBatch(emails, batchSize = 10) {
    const results = [];
    for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize);
        const res = await Promise.all(batch.map(email => categorizeSingleEmail(email)));
        results.push(...res);
        await delay(150);
    }
    return results;
}

async function updateCategoriesInMongoDB(userId, categorizedEmails) {
    try {
        const mongo = new MongoDB();
        const db = await mongo.getDb();
        const bulkOps = categorizedEmails.map(email => ({
            updateOne: {
                filter: { id: email.id, userId },
                update: {
                    $set: {
                        categories: email.categories,
                        backgroundColor: email.backgroundColor,
                        textColor: email.textColor
                    }
                },
                upsert: true
            }
        }));
        return await db.collection('emails').bulkWrite(bulkOps);
    } catch (err) {
        console.error('Errore update MongoDB:', err.message);
        throw err;
    }
}

exports.categorizeEmail = async (req, res) => {
    try {
        const { emails } = req.body;
        if (!Array.isArray(emails) || !emails.length) {
            return res.status(400).json({ error: 'Email non valide' });
        }
        const categorized = await processEmailBatch(emails);
        await updateCategoriesInMongoDB(req.user.userId, categorized);
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
        - Oggetto: ${email.subject || '(nessun oggetto)'}
        - Corpo: ${email.body?.slice(0, 500) || '(vuoto)'}
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