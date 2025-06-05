async function syncEmails() {
    try {
        const response = await fetch('/api/emails/sync', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('gt')}`,
                'Content-Type': 'application/json'
            }
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
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('gt')}`
            }
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
        emailElement.setAttribute('data-id', email.id);
        emailElement.setAttribute('data-category', email.categories?.join(' ') || 'inbox');

        emailElement.innerHTML = `
            <div class="email-sender">
                <span class="email-label label-${email.categories?.[0] || 'inbox'}">${email.categories?.[0] || 'inbox'}</span>
                ${email.from}
            </div>
            <div class="email-subject">${email.subject}</div>
            <div class="email-preview">${email.body?.substring(0, 100) || ''}...</div>
            <div class="email-time">${new Date(email.date).toLocaleString()}</div>
        `;

        emailList.appendChild(emailElement);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadEmailsToPage();

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

function filterEmailsByCategory(category) {
    const items = document.querySelectorAll('.email-item');

    items.forEach(item => {
        const categories = (item.getAttribute('data-category') || '').split(' ');
        if (category === 'inbox' || categories.includes(category)) {
            item.style.display = 'grid';
        } else {
            item.style.display = 'none';
        }
    });

    document.querySelectorAll('.email-nav li').forEach(li => {
        li.classList.toggle('active', li.dataset.category === category);
    });
}
