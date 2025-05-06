const { google } = require('googleapis');
const { htmlToText } = require('html-to-text');
const MongoDB = require('../mongodb');

// Funzione factory per inizializzare MongoDB
let dbInstance = null;
async function getDb() {
    if (!dbInstance) {
        try {
            console.log('Inizializzazione MongoDB...');
            const mongo = new MongoDB();
            dbInstance = await mongo.getDb(); // Attende la connessione
            console.log('MongoDB inizializzato con successo');
        } catch (err) {
            console.error('Errore inizializzazione MongoDB:', err.message, err.stack);
            throw err;
        }
    }
    return dbInstance;
}

async function syncEmailsFromGmail(token, userId = 'me') {
    console.log('Inizio sincronizzazione email con token:', token ? 'Presente' : 'Assente');
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });

    const gmail = google.gmail({ version: 'v1', auth });
    const db = await getDb(); // Attende la connessione

    try {
        const res = await gmail.users.messages.list({
            userId,
            maxResults: 150,
            q: 'from:*',
        });

        const messages = res.data.messages || [];
        console.log('Messaggi ricevuti da Gmail:', messages.length);

        // Svuota la collezione esistente per evitare duplicati
        await db.collection('emails').deleteMany({ userId });
        console.log('Collezione emails svuotata');

        const emails = [];

        for (const message of messages) {
            const msg = await gmail.users.messages.get({
                userId,
                id: message.id,
                format: 'full',
            });

            const headers = msg.data.payload.headers || [];
            const fromHeader = headers.find(h => h.name.toLowerCase() === 'from')?.value || 'Sconosciuto';
            const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(senza oggetto)';
            const dateHeader = headers.find(h => h.name.toLowerCase() === 'date')?.value || new Date().toISOString();

            let body = '';
            if (msg.data.payload.parts) {
                for (const part of msg.data.payload.parts) {
                    if (part.mimeType === 'text/plain' && part.body.data) {
                        body = Buffer.from(part.body.data, 'base64').toString('utf-8');
                        body = body.replace(/\r\n/g, '\n').replace(/\n{2,}/g, '\n\n').trim();
                        break;
                    } else if (part.mimeType === 'text/html' && part.body.data) {
                        const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
                        body = htmlToText(html, {
                            wordwrap: 80,
                            preserveNewlines: true,
                            uppercaseHeadings: false,
                            formatters: {
                                anchor: (elem, walk, builder) => {
                                    const href = elem.attribs?.href || '';
                                    if (href.includes('unsubscribe') || href.includes('utm_')) {
                                        return;
                                    }
                                    builder.addInline(`[${elem.children[0]?.data || 'Link'}](${href})`);
                                },
                            },
                            tags: {
                                'a': { format: 'anchor' },
                                'img': { format: 'skip' },
                            },
                        }).trim();
                    }
                }
            } else if (msg.data.payload.body?.data) {
                body = Buffer.from(msg.data.payload.body.data, 'base64').toString('utf-8');
                body = body.replace(/\r\n/g, '\n').replace(/\n{2,}/g, '\n\n').trim();
            }

            body = body || '(Nessun contenuto)';
            body = body.replace(/Unsubscribe\s*http[s]?:\/\/[^\s]+/gi, '').trim();
            body = body.replace(/Sent to: [^\n]+/gi, '').trim();

            const categories = [];
            if (msg.data.labelIds?.includes('INBOX')) categories.push('inbox');
            if (msg.data.labelIds?.includes('IMPORTANT')) categories.push('important');
            if (msg.data.labelIds?.includes('SENT')) categories.push('sent');
            if (msg.data.labelIds?.includes('TRASH')) categories.push('trash');
            if (subjectHeader.toLowerCase().includes('meeting') || body.toLowerCase().includes('meeting')) {
                categories.push('meetings');
            }

            const email = {
                id: message.id,
                userId,
                from: fromHeader,
                subject: subjectHeader,
                body,
                date: new Date(dateHeader),
                categories: categories.length ? categories : ['inbox'],
            };

            emails.push(email);
        }

        // Salva le email in MongoDB
        if (emails.length > 0) {
            await db.collection('emails').insertMany(emails);
            console.log('Email salvate in MongoDB:', emails.length);
        }

        console.log('Email sincronizzate:', emails.length);
        return emails;
    } catch (err) {
        console.error('Errore sincronizzazione email in emailService:', err.message, err.stack);
        throw err;
    }
}

async function trashEmail(token, emailId, userId = 'me') {
    console.log('Spostamento email nel cestino:', emailId);
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });

    const gmail = google.gmail({ version: 'v1', auth });
    const db = await getDb(); // Attende la connessione

    try {
        await gmail.users.messages.trash({
            userId,
            id: emailId,
        });

        // Aggiorna la categoria in MongoDB
        await db.collection('emails').updateOne(
            { id: emailId, userId },
            { $set: { categories: ['trash'] } }
        );

        console.log('Email spostata nel cestino con successo:', emailId);
        return { success: true, message: 'Email spostata nel cestino' };
    } catch (err) {
        console.error('Errore spostamento email nel cestino:', err.message, err.stack);
        throw err;
    }
}

async function getEmails(token, limit = 150) {
    const db = await getDb(); // Attende la connessione
    try {
        const query = { userId: 'me' };
        let emails = await db.collection('emails')
            .find(query)
            .sort({ date: -1 })
            .limit(limit === null ? 0 : limit)
            .toArray();

        console.log('Email recuperate da MongoDB:', emails.length);
        return emails;
    } catch (err) {
        console.error('Errore recupero email da MongoDB:', err.message, err.stack);
        throw err;
    }
}

module.exports = { syncEmailsFromGmail, trashEmail, getEmails };