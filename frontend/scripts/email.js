// Funzioni per la gestione delle email
async function syncEmails() {
    try {
        const response = await fetch('/api/emails/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Errore durante la sincronizzazione');
        }

        return await response.json();
    } catch (err) {
        console.error('Errore sincronizzazione:', err);
        throw err;
    }
}

async function loadEmailsToPage() {
    try {
        const response = await fetch('/api/emails', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Errore nel caricamento delle email');
        }

        const emails = await response.json();
        renderEmails(emails);
    } catch (err) {
        console.error('Errore caricamento email:', err);
    }
}

function renderEmails(emails) {
    const emailList = document.getElementById('emailList');
    emailList.innerHTML = '';

    emails.forEach(email => {
        const emailElement = document.createElement('div');
        emailElement.className = 'email-item';
        emailElement.innerHTML = `
            <div class="email-sender">${email.from}</div>
            <div class="email-subject">${email.subject}</div>
            <div class="email-preview">${email.body.substring(0, 100)}...</div>
            <div class="email-time">${new Date(email.date).toLocaleString()}</div>
        `;
        emailList.appendChild(emailElement);
    });
}

// Inizializzazione
document.addEventListener('DOMContentLoaded', () => {
    loadEmailsToPage();
    
    const syncButton = document.getElementById('sync-button');
    if (syncButton) {
        syncButton.addEventListener('click', async () => {
            try {
                await syncEmails();
                await loadEmailsToPage();
                alert('Email sincronizzate con successo!');
            } catch (err) {
                alert('Errore durante la sincronizzazione: ' + err.message);
            }
        });
    }
});