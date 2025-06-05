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
    userEmail: String,
    attachments: [{
        filename: String,
        mimeType: String,
        size: Number,
        attachmentId: String,
        partId: String
    }]
}));

const getGmailClient = (accessToken) => {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.gmail({ version: 'v1', auth: oauth2Client });
};

exports.getEmails = async (accessToken, limit, userId) => {
    try {
        const emails = await Email.find({ userId })
            .sort({ date: -1 })
            .limit(limit || 50)
            .lean();
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
            userEmail: email.userEmail,
            attachments: email.attachments || []
        }));
    } catch (err) {
        console.error('Errore getEmails:', err.message);
        throw err;
    }
};

exports.syncEmailsFromGmail = async (accessToken, userId) => {
    try {
        const gmail = getGmailClient(accessToken);
        const labels = ['INBOX', 'SENT', 'IMPORTANT', 'SPAM', 'TRASH', 'CATEGORY_PROMOTIONS'];
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
                const attachments = [];

                for (const part of parts) {
                    if (part.filename && part.body.attachmentId) {
                        attachments.push({
                            filename: part.filename,
                            mimeType: part.mimeType,
                            size: part.body.size,
                            attachmentId: part.body.attachmentId,
                            partId: part.partId
                        });
                    }
                    if (part.mimeType === 'text/plain' && part.body.data) {
                        body = Buffer.from(part.body.data, 'base64').toString('utf-8');
                    } else if (part.mimeType === 'text/html' && part.body.data) {
                        body = Buffer.from(part.body.data, 'base64').toString('utf-8');
                    }
                }
                if (!body && msg.data.payload.body?.data) {
                    body = Buffer.from(msg.data.payload.body.data, 'base64').toString('utf-8');
                }

                const content = body.toLowerCase();
                const subjectLower = subject.toLowerCase();
                const categories = [];
                if (labelIds.includes('SENT')) categories.push('Inviate');
                if (labelIds.includes('IMPORTANT')) categories.push('Importanti');
                if (labelIds.includes('SPAM')) categories.push('Spam');
                if (labelIds.includes('TRASH')) categories.push('Cestino');
                if (labelIds.includes('CATEGORY_PROMOTIONS')) categories.push('Promozioni');
                if (labelIds.includes('UNREAD') && !labelIds.includes('SENT')) categories.push('Da rispondere');
                if (content.includes('riunione') || content.includes('zoom') || content.includes('meet') || subjectLower.includes('riunione')) categories.push('Riunioni');
                if (content.includes('calendario') || content.includes('evento') || content.includes('invito') || subjectLower.includes('invito')) categories.push('Calendario');
                if (!categories.length) categories.push('Posta in arrivo');

                const backgroundColor = categories.includes('Inviate') ? '#c9daf8' :
                    categories.includes('Importanti') ? '#4a86e8' :
                        categories.includes('Spam') ? '#ffad47' :
                            categories.includes('Cestino') ? '#e66550' :
                                categories.includes('Riunioni') ? '#16a766' :
                                    categories.includes('Calendario') ? '#fad165' :
                                        categories.includes('Promozioni') ? '#f4b400' :
                                            categories.includes('Da rispondere') ? '#ff6f61' :
                                                '#ffffff';
                const textColor = categories.includes('Inviate') ? '#000000' :
                    categories.includes('Importanti') ? '#ffffff' :
                        categories.includes('Spam') ? '#000000' :
                            categories.includes('Cestino') ? '#ffffff' :
                                categories.includes('Riunioni') ? '#ffffff' :
                                    categories.includes('Calendario') ? '#000000' :
                                        categories.includes('Promozioni') ? '#000000' :
                                            categories.includes('Da rispondere') ? '#ffffff' :
                                                '#000000';

                const emailData = {
                    userId,
                    id: message.id,
                    from,
                    subject,
                    body,
                    date: new Date(date),
                    categories,
                    backgroundColor,
                    textColor,
                    gmailLabelIds: labelIds,
                    userEmail: userId,
                    attachments
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
                    email.categories = categories;
                    email.backgroundColor = backgroundColor;
                    email.textColor = textColor;
                    email.gmailLabelIds = labelIds;
                    email.attachments = attachments;
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
                    userEmail: email.userEmail,
                    attachments: email.attachments
                });
            }
        }
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
        return { modifiedCount: result.modifiedCount };
    } catch (err) {
        console.error('Errore updateEmailCategories:', err.message);
        throw err;
    }
};

exports.getAttachment = async (accessToken, emailId, attachmentId) => {
    try {
        const gmail = getGmailClient(accessToken);
        const res = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: emailId,
            id: attachmentId
        });
        return {
            data: res.data.data,
            size: res.data.size,
            filename: (await Email.findOne({ id: emailId, 'attachments.attachmentId': attachmentId }, { 'attachments.$': 1 })).attachments[0].filename,
            mimeType: (await Email.findOne({ id: emailId, 'attachments.attachmentId': attachmentId }, { 'attachments.$': 1 })).attachments[0].mimeType
        };
    } catch (err) {
        console.error('Errore getAttachment:', err.message);
        throw err;
    }
};