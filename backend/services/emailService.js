const mongoose = require('mongoose');
const { google } = require('googleapis');

const Email = mongoose.model('Email', new mongoose.Schema({
    userId: String,
    id: String,
    from: String,
    subject: String,
    body: String,
    date: Date,
    categories: [String],
    backgroundColor: String,
    textColor: String,
    gmailLabelIds: [String],
    userEmail: String
}));

const getGmailClient = (accessToken) => {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.gmail({ version: 'v1', auth: oauth2Client });
};

exports.getEmails = async (accessToken, limit, userId) => {
    try {
        console.log('Recupero email da MongoDB con limite:', limit, 'per userId:', userId);
        const emails = await Email.find({ userId })
            .sort({ date: -1 })
            .limit(limit || 50)
            .lean();
        console.log('Email recuperate:', emails.length);
        return emails.map(email => ({
            id: email.id,
            from: email.from,
            subject: email.subject,
            body: email.body,
            date: email.date,
            categories: email.categories,
            backgroundColor: email.backgroundColor,
            textColor: email.textColor,
            gmailLabelIds: email.gmailLabelIds,
            userEmail: email.userEmail
        }));
    } catch (err) {
        console.error('Errore getEmails:', err.message);
        throw err;
    }
};

exports.syncEmailsFromGmail = async (accessToken, userId) => {
    try {
        const gmail = getGmailClient(accessToken);
        const labels = ['INBOX', 'SENT', 'IMPORTANT', 'SPAM', 'TRASH'];
        const emails = [];
        for (const label of labels) {
            const res = await gmail.users.messages.list({ userId: 'me', labelIds: [label], maxResults: 50 });
            const messages = res.data.messages || [];
            for (const message of messages) {
                const msg = await gmail.users.messages.get({ userId: 'me', id: message.id, format: 'full' });
                const headers = msg.data.payload.headers || [];
                const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || 'Sconosciuto';
                const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(senza oggetto)';
                const date = headers.find(h => h.name.toLowerCase() === 'date')?.value || new Date().toISOString();
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
                const content = body.toLowerCase();
                const subjectLower = subject.toLowerCase();
                const initialCategory = labelIds.includes('SENT') ? ['Inviate'] :
                    labelIds.includes('IMPORTANT') ? ['Importanti'] :
                        labelIds.includes('SPAM') ? ['Spam'] :
                            labelIds.includes('TRASH') ? ['Cestino'] :
                                content.includes('riunione') || content.includes('zoom') || content.includes('meet') || subjectLower.includes('riunione') ? ['Riunioni'] :
                                    content.includes('calendario') || content.includes('evento') || content.includes('invito') || subjectLower.includes('invito') ? ['Calendario'] :
                                        ['Posta in arrivo'];
                const backgroundColor = labelIds.includes('SENT') ? '#c9daf8' :
                    labelIds.includes('IMPORTANT') ? '#4a86e8' :
                        labelIds.includes('SPAM') ? '#ffad47' :
                            labelIds.includes('TRASH') ? '#e66550' :
                                initialCategory[0] === 'Riunioni' ? '#16a766' :
                                    initialCategory[0] === 'Calendario' ? '#fad165' :
                                        '#ffffff';
                const textColor = labelIds.includes('SENT') ? '#000000' :
                    labelIds.includes('IMPORTANT') ? '#ffffff' :
                        labelIds.includes('SPAM') ? '#000000' :
                            labelIds.includes('TRASH') ? '#ffffff' :
                                initialCategory[0] === 'Riunioni' ? '#ffffff' :
                                    initialCategory[0] === 'Calendario' ? '#000000' :
                                        '#000000';
                const emailData = {
                    userId,
                    id: message.id,
                    from,
                    subject,
                    body,
                    date: new Date(date),
                    categories: initialCategory,
                    backgroundColor,
                    textColor,
                    gmailLabelIds: labelIds,
                    userEmail: userId
                };
                let email = await Email.findOne({ id: message.id, userId });
                if (!email) {
                    email = new Email(emailData);
                    await email.save();
                } else {
                    email.from = from;
                    email.subject = subject;
                    email.body = body;
                    email.date = new Date(date);
                    email.categories = initialCategory;
                    email.backgroundColor = backgroundColor;
                    email.textColor = textColor;
                    email.gmailLabelIds = labelIds;
                    await email.save();
                }
                emails.push({
                    id: email.id,
                    from: email.from,
                    subject: email.subject,
                    body: email.body,
                    date: email.date,
                    categories: email.categories,
                    backgroundColor: email.backgroundColor,
                    textColor: email.textColor,
                    gmailLabelIds: email.gmailLabelIds,
                    userEmail: email.userEmail
                });
            }
        }
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
            email.categories = ['Cestino'];
            email.backgroundColor = '#e66550';
            email.textColor = '#ffffff';
            await email.save();
        }
        console.log('Email spostata nel cestino:', emailId);
        return { id: emailId, categories: ['Cestino'], backgroundColor: '#e66550', textColor: '#ffffff' };
    } catch (err) {
        console.error('Errore trashEmail:', err.message);
        throw err;
    }
};

exports.updateEmailCategories = async (userId, emails) => {
    try {
        const bulkOps = emails.map(({ id, categories, backgroundColor, textColor }) => ({
            updateOne: {
                filter: { id, userId },
                update: { $set: { categories, backgroundColor, textColor } }
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