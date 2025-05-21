const { GoogleGenerativeAI } = require('@google/generative-ai');
const { format } = require('date-fns');
const dedent = require('dedent');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

const CATEGORY_IDS = ['Posta in arrivo', 'Inviate', 'Importanti', 'Riunioni', 'Calendario', 'Spam', 'Cestino'];
const colors = ['#000000', '#434343', '#666666', '#999999', '#cccccc', '#efefef', '#f3f3f3', '#ffffff', '#fb4c2f', '#ffad47', '#fad165', '#16a766', '#43d692', '#4a86e8', '#a479e2', '#f691b3', '#f6c5be', '#ffe6c7', '#fef1d1', '#b9e4d0', '#c6f3de', '#c9daf8', '#e4d7f5', '#fcdee8', '#efa093', '#ffd6a2', '#fce8b3', '#89d3b2', '#a0eac9', '#a4c2f4', '#d0bcf1', '#fbc8d9', '#e66550', '#ffbc6b', '#fcda83', '#44b984', '#68dfa9', '#6d9eeb', '#b694e8', '#f7a7c0', '#cc3a21', '#eaa041', '#f2c960', '#149e60', '#3dc789', '#3c78d8', '#8e63ce', '#e07798', '#ac2b16', '#cf8933', '#d5ae49', '#0b804b', '#2a9c68', '#285bac', '#653e9b', '#b65775', '#822111', '#a46a21', '#aa8831', '#076239', '#1a764d', '#1c4587', '#41236d', '#83334c', '#464646', '#e7e7e7', '#0d3472', '#b6cff5', '#0d3b44', '#98d7e4', '#3d188e', '#e3d7ff', '#711a36', '#fbd3e0', '#8a1c0a', '#f2b2a8', '#7a2e0b', '#ffc8af', '#7a4706', '#ffdeb5', '#594c05', '#fbe983', '#684e07', '#fdedc1', '#0b4f30', '#b3efd3', '#04502e', '#a2dcc1', '#c2c2c2', '#4986e7', '#2da2bb', '#b99aff', '#994a64', '#f691b2', '#ff7537', '#ffad46', '#662e37', '#ebdbde', '#cca6ac', '#094228', '#42d692', '#16a765'];

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function quickCategorize(email) {
    const content = email.content.toLowerCase();
    if (content.includes('promozione') || content.includes('offerta') || content.includes('newsletter')) return { id: email.id, categories: ['Spam'], backgroundColor: '#ffad47', textColor: '#000000' };
    if (content.includes('lavoro') || content.includes('collega') || content.includes('deadline')) return { id: email.id, categories: ['Importanti'], backgroundColor: '#4a86e8', textColor: '#ffffff' };
    if (content.includes('riunione') || content.includes('zoom') || content.includes('meet')) return { id: email.id, categories: ['Riunioni'], backgroundColor: '#16a766', textColor: '#ffffff' };
    if (content.includes('calendario') || content.includes('evento') || content.includes('invito')) return { id: email.id, categories: ['Calendario'], backgroundColor: '#fad165', textColor: '#000000' };
    if (content.includes('spam') || content.includes('clicca qui')) return { id: email.id, categories: ['Spam'], backgroundColor: '#ffad47', textColor: '#000000' };
    if (email.from === email.userEmail) return { id: email.id, categories: ['Inviate'], backgroundColor: '#c9daf8', textColor: '#000000' };
    return null;
}

async function categorizeSingleEmail(email, retries = 3, baseDelay = 1000) {
    const quickResult = await quickCategorize(email);
    if (quickResult) return quickResult;
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const prompt = dedent`
        Categorizza questa email in una delle seguenti categorie: ${CATEGORY_IDS.join(', ')}.
        Fornisci solo il nome della categoria e il colore di sfondo e testo in formato JSON:
        {"category": "Categoria", "backgroundColor": "#hex", "textColor": "#hex"}
        Contenuto: ${email.content.slice(0, 500)}
      `;
            const result = await model.generateContent(prompt);
            const jsonResponse = JSON.parse(result.response.text());
            return { id: email.id, categories: [jsonResponse.category], backgroundColor: jsonResponse.backgroundColor, textColor: jsonResponse.textColor };
        } catch (error) {
            if (error.message.includes('429') && attempt < retries - 1) {
                const delayMs = baseDelay * Math.pow(2, attempt);
                console.warn(`Errore 429 per email ${email.id}, tentativo ${attempt + 1}/${retries}. Attendo ${delayMs}ms.`);
                await delay(delayMs);
                continue;
            }
            console.error(`Errore categorizzazione email ${email.id}:`, error.message);
            return { id: email.id, categories: ['Posta in arrivo'], backgroundColor: '#ffffff', textColor: '#000000' };
        }
    }
}

async function generateReply(email, userStyle = {}, retries = 3, baseDelay = 1000) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const prompt = dedent`
        <system_prompt>
          <role>
            You are an AI assistant that composes email bodies mirroring the sender’s writing style.
          </role>
          <instructions>
            <goal>
              Generate a ready-to-send email body that is professional, concise, and reflects the user’s style.
            </goal>
            <persona>
              Write in the first person as the user.
            </persona>
            <style_adaptation>
              ${JSON.stringify(userStyle)}
              Include greeting if greetingPresent is true.
              Include sign-off if signOffPresent is true.
              Use emoji if emojiRate > 0.
            </style_adaptation>
            <formatting>
              Separate paragraphs with two newlines.
            </formatting>
            <output_format>
              Respond with the email body text only.
            </output_format>
          </instructions>
        </system_prompt>
        Genera una risposta professionale per questa email: ${email.content.slice(0, 500)}
      `;
            const result = await model.generateContent(prompt);
            return { id: email.id, reply: result.response.text().trim() };
        } catch (error) {
            if (error.message.includes('429') && attempt < retries - 1) {
                const delayMs = baseDelay * Math.pow(2, attempt);
                console.warn(`Errore 429 per risposta email ${email.id}, tentativo ${attempt + 1}/${retries}. Attendo ${delayMs}ms.`);
                await delay(delayMs);
                continue;
            }
            console.error(`Errore generazione risposta email ${email.id}:`, error.message);
            return { id: email.id, reply: 'Spiacenti, non è possibile generare una risposta al momento.' };
        }
    }
}

async function processEmailBatch(emails, batchSize = 10, requestDelay = 2000) {
    const results = [];
    const totalEmails = emails.length;
    for (let i = 0; i < totalEmails; i += batchSize) {
        const batch = emails.slice(i, i + batchSize);
        console.log(`Processo batch ${i / batchSize + 1} con ${batch.length} email...`);
        const batchResults = [];
        for (const email of batch) {
            const result = await categorizeSingleEmail(email);
            batchResults.push(result);
            await delay(requestDelay);
        }
        const allSuccessful = batchResults.every(result => result.categories[0] !== 'Posta in arrivo');
        if (!allSuccessful) {
            console.warn(`Alcune categorizzazioni nel batch ${i / batchSize + 1} sono fallite. Verifica i log.`);
        }
        results.push(...batchResults);
        console.log(`Batch ${i / batchSize + 1} completato.`);
    }
    return results;
}

exports.categorizeEmail = async (req, res) => {
    try {
        const emails = req.body.emails;
        if (!emails || !Array.isArray(emails)) {
            return res.status(400).json({ error: 'Email non valide' });
        }
        const categorizedEmails = await processEmailBatch(emails, 10, 2000);
        const updateResult = await updateCategoriesInMongoDB(req.userId, categorizedEmails);
        console.log(`Categorie aggiornate: ${updateResult.modifiedCount}`);
        res.json(categorizedEmails);
    } catch (error) {
        console.error('Errore in categorizeEmail:', error);
        res.status(500).json({ error: 'Errore durante la categorizzazione' });
    }
};

exports.generateReply = async (req, res) => {
    try {
        const email = req.body.email;
        const userStyle = req.body.userStyle || { greetingPresent: true, signOffPresent: true, emojiRate: 0 };
        if (!email || !email.id || !email.content) {
            return res.status(400).json({ error: 'Dati email non validi' });
        }
        const replyResult = await generateReply(email, userStyle, 3, 1000);
        res.json(replyResult);
    } catch (error) {
        console.error('Errore in generateReply:', error);
        res.status(500).json({ error: 'Errore durante la generazione della risposta' });
    }
};

async function updateCategoriesInMongoDB(userId, categorizedEmails) {
    return { modifiedCount: 0 };
}