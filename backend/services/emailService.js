const mongoose = require('mongoose');
const { google } = require('googleapis');
const { classifyEmail } = require('./emailClassifier');

const Email = mongoose.model('Email', new mongoose.Schema({
    userId: String,
    id: String,
    from: String,
    subject: String,
    body: String,
    date: Date,
    categories: [String]
}));

const getGmailClient = (accessToken) => {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.gmail({ version: 'v1', auth: oauth2Client });
};

// Utility per creare una label se non esiste
async function ensureGmailLabel(gmail, name) {
    const res = await gmail.users.labels.list({ userId: 'me' });
    const existing = res.data.labels.find(label => label.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;

    const newLabel = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
            name,
            labelListVisibility: 'labelShow',
            messageListVisibility: 'show'
        }
    });
    return newLabel.data.id;
}

exports.getEmails = async (accessToken, limit) => {
    try {
        console.log('Recupero email con limite:', limit);
        const gmail = getGmailClient(accessToken);
        const res = await gmail.users.messages.list({ userId: 'me', maxResults: limit || 50 });
        const messages = res.data.messages || [];

        const emails = await Promise.all(messages.map(async (message) => {
            const msg = await gmail.users.messages.get({ userId: 'me', id: message.id, format: 'full' });
            const headers = msg.data.payload.headers;
            const from = headers.find(h => h.name === 'From')?.value || 'Sconosciuto';
            const subject = headers.find(h => h.name === 'Subject')?.value || '(senza oggetto)';
            const date = headers.find(h => h.name === 'Date')?.value || new Date().toISOString();
            const labelIds = msg.data.labelIds || [];
            let body = '';

            const parts = msg.data.payload.parts || [];
            for (const part of parts) {
                if (part.mimeType === 'text/plain' && part.body.data) {
                    body = Buffer.from(part.body.data, 'base64').toString('utf-8');
                    break;
                }
                if (part.mimeType === 'text/html' && part.body.data) {
                    body = Buffer.from(part.body.data, 'base64').toString('utf-8');
                    break;
                }
            }

            if (!body && msg.data.payload.body?.data) {
                body = Buffer.from(msg.data.payload.body.data, 'base64').toString('utf-8');
            }

            let email = await Email.findOne({ id: message.id });
            if (!email) {
                const categories = await classifyEmail({ subject, body });
                email = new Email({ userId: '', id: message.id, from, subject, body, date: new Date(date), categories });
                await email.save();
            }

            return {
                id: email.id,
                from: email.from,
                subject: email.subject,
                body: email.body,
                date: email.date,
                categories: email.categories
            };
        }));

        console.log('Email recuperate:', emails.length);
        return emails;
    } catch (err) {
        console.error('Errore getEmails:', err.message);
        throw err;
    }
};

exports.syncEmailsFromGmail = async (accessToken, userId) => {
    try {
        const gmail = getGmailClient(accessToken);
        const res = await gmail.users.messages.list({ userId: 'me', maxResults: 50 });
        const messages = res.data.messages || [];

        const emails = await Promise.all(messages.map(async (message) => {
            const msg = await gmail.users.messages.get({ userId: 'me', id: message.id });
            const headers = msg.data.payload.headers;
            const from = headers.find(h => h.name === 'From')?.value || 'Sconosciuto';
            const subject = headers.find(h => h.name === 'Subject')?.value || '(senza oggetto)';
            const date = headers.find(h => h.name === 'Date')?.value || new Date().toISOString();

            let body = '';
            if (msg.data.payload.parts) {
                const textPart = msg.data.payload.parts.find(part => part.mimeType === 'text/plain');
                body = textPart ? Buffer.from(textPart.body.data, 'base64').toString('utf-8') : '';
            } else {
                body = msg.data.payload.body.data ? Buffer.from(msg.data.payload.body.data, 'base64').toString('utf-8') : '';
            }

            let categories = ['inbox'];
            try {
                categories = await classifyEmail({ subject, body });
            } catch (err) {
                console.warn('Errore AI categorizzazione:', err.message);
            }

            let email = await Email.findOne({ id: message.id, userId });
            if (!email) {
                email = new Email({
                    userId,
                    id: message.id,
                    from,
                    subject,
                    body,
                    date: new Date(date),
                    categories
                });
                await email.save();
            } else {
                email.categories = categories;
                await email.save();
            }

            return {
                id: email.id,
                from: email.from,
                subject: email.subject,
                body: email.body,
                date: email.date,
                categories: email.categories
            };
        }));

        console.log('Email sincronizzate:', emails.length);
        return emails;
    } catch (err) {
        console.error('Errore syncEmailsFromGmail:', err.message);
        throw err;
    }
};

exports.sendEmail = async (accessToken, to, subject, body) => {
    try {
        const gmail = getGmailClient(accessToken);
        const raw = Buffer.from(
            `To: ${to}\nSubject: ${subject}\nContent-Type: text/plain; charset=utf-8\n\n${body}`
        ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        const res = await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw }
        });

        console.log('Email inviata:', res.data.id);
        return { id: res.data.id };
    } catch (err) {
        console.error('Errore sendEmail:', err.message);
        throw err;
    }
};

exports.trashEmail = async (accessToken, emailId, userId) => {
    try {
        const gmail = getGmailClient(accessToken);
        await gmail.users.messages.trash({ userId: 'me', id: emailId });

        const email = await Email.findOne({ id: emailId, userId });
        if (email) {
            email.categories = ['trash'];
            await email.save();
        }

        console.log('Email spostata nel cestino:', emailId);
        return { id: emailId, categories: ['trash'] };
    } catch (err) {
        console.error('Errore trashEmail:', err.message);
        throw err;
    }
};

exports.updateEmailCategories = async (userId, emails) => {
    try {
        const bulkOps = emails.map(({ id, categories }) => ({
            updateOne: {
                filter: { id, userId },
                update: { $set: { categories } }
            }
        }));

        const result = await Email.bulkWrite(bulkOps);
        console.log('Categorie aggiornate:', result.modifiedCount);
        return { modifiedCount: result.modifiedCount };
    } catch (err) {
        console.error('Errore updateEmailCategories:', err.message);
        throw err;
    }
};