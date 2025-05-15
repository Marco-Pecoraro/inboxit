// frontend/home/script.js
const navItems = document.querySelectorAll('.email-nav li');
const emailListContainer = document.querySelector('.email-list-container');
const emailHeader = document.querySelector('.email-header');
const calendarSection = document.querySelector('#calendarSection');
const composeModal = document.querySelector('#composeModal');
const settingsModal = document.querySelector('#settingsModal');
const eventModal = document.querySelector('#eventModal');
const emailPreviewModal = document.querySelector('#emailPreviewModal');
const composeBtn = document.querySelector('.compose-btn');
const settingsBtn = document.querySelector('.settings-btn');
const syncBtn = document.querySelector('.sync-btn');
const sendBtn = document.querySelector('.send-btn');
const overlay = document.querySelector('#overlay');
const closeButtons = document.querySelectorAll('.close-btn');
const saveBtn = document.querySelector('.save-btn');
const calendarGrid = document.querySelector('#calendarGrid');
const calendarMonth = document.querySelector('#calendarMonth');
const prevBtn = document.querySelector('.calendar-nav.prev');
const nextBtn = document.querySelector('.calendar-nav.next');
const eventsList = document.querySelector('#eventsList');
const searchInput = document.querySelector('#searchInput');
const addEventBtn = document.querySelector('.add-event-btn');
const eventTitleInput = document.querySelector('#eventTitle');
const eventDateInput = document.querySelector('#eventDate');
const eventTimeInput = document.querySelector('#eventTime');
const logoutBtn = document.querySelector('.logout-btn');
const saveAccountBtn = document.querySelector('.save-account-btn');
const previewSender = document.querySelector('#previewSender');
const previewSubject = document.querySelector('#previewSubject');
const previewBody = document.querySelector('#previewBody');
const previewTime = document.querySelector('#previewTime');
const deleteBtn = document.querySelector('.delete-btn');
const replyBtn = document.querySelector('.reply-btn');
const aiReplyBtn = document.querySelector('.ai-reply-btn');
const notificationsCheckbox = document.querySelector('#notifications');
const darkThemeCheckbox = document.querySelector('#darkTheme');
const showEmailCountCheckbox = document.querySelector('#showEmailCount');
const emailCounts = document.querySelectorAll('.email-count');
const composeInput = document.querySelector('.compose-input');
const composeSubject = document.querySelector('.compose-subject');
const composeText = document.querySelector('.compose-text');
const accountNameInput = document.querySelector('#accountName');
const accountEmailInput = document.querySelector('#accountEmail');
const emailLimitSelect = document.querySelector('#emailLimit');
const loadingOverlay = document.querySelector('#loadingOverlay');

let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();
let currentCategory = 'inbox';
let events = [];
let currentEmail = null;
let emailLimit = 50;

// Inizializzazione
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Inizio inizializzazione pagina home');
        toggleLoading(true);

        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const error = urlParams.get('error');

        console.log('Parametri URL:', { token, error });

        if (error) {
            let errorMessage = 'Errore durante il login. Riprova.';
            if (error === 'auth_required') {
                errorMessage = 'Autenticazione richiesta. Effettua il login.';
            } else if (error === 'auth_failed') {
                errorMessage = 'Autenticazione fallita. Verifica le credenziali e riprova.';
            } else if (error === 'init_failed') {
                errorMessage = 'Errore di inizializzazione. Riprova più tardi.';
            }
            console.error('Errore rilevato:', errorMessage);
            alert(errorMessage);
            window.location.href = '/';
            return;
        }

        if (token) {
            console.log('Token ricevuto dall\'URL, salvataggio in sessionStorage:', token.substring(0, 20) + '...');
            sessionStorage.setItem('gt', token);
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        const storedToken = sessionStorage.getItem('gt');
        let user = {};
        try {
            user = JSON.parse(localStorage.getItem('user') || '{}');
            console.log('Dati utente da localStorage:', user);
        } catch (err) {
            console.error('Errore parsing user da localStorage:', err);
            user = {};
        }

        console.log('Dati autenticazione:', { storedToken: storedToken ? storedToken.substring(0, 20) + '...' : null, user });

        if (!storedToken) {
            console.error('Token mancante in sessionStorage');
            alert('Sessione scaduta. Effettua nuovamente il login.');
            window.location.href = '/?error=auth_required';
            return;
        }

        if (!user.email) {
            console.warn('Email utente mancante, tentativo di recupero da /api/user');
            try {
                const response = await fetch('/api/user', {
                    headers: {
                        'Authorization': `Bearer ${storedToken}`,
                        'Content-Type': 'application/json'
                    }
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Impossibile recuperare i dati utente');
                }
                user = await response.json();
                console.log('Dati utente recuperati da /api/user:', user);
                localStorage.setItem('user', JSON.stringify(user));
            } catch (err) {
                console.error('Errore recupero dati utente:', err);
                alert('Errore recupero dati utente: ' + err.message);
                window.location.href = '/?error=auth_failed';
                return;
            }
        }

        accountNameInput.value = user.name || '';
        accountEmailInput.value = user.email;

        console.log('Inizio caricamento email');
        await loadEmailsToPage();
        console.log('Email caricate, verifica presenza elementi');

        // Categorizza email non categorizzate
        await categorizeEmails();

        if (!document.querySelectorAll('.email-item').length) {
            console.log('Nessuna email presente, avvio sincronizzazione automatica');
            syncBtn.disabled = true;
            syncBtn.textContent = 'Sincronizzazione...';
            try {
                await syncEmails();
                await loadEmailsToPage();
                await categorizeEmails();
            } catch (err) {
                console.error('Errore sincronizzazione automatica:', err);
                alert('Errore sincronizzazione email: ' + err.message);
            } finally {
                syncBtn.disabled = false;
                syncBtn.textContent = 'Sincronizza';
            }
        }

        updateEmailCounts();
        toggleEmailCountVisibility(showEmailCountCheckbox.checked);
        filterEmails('inbox');
        await loadEvents();
        generateCalendar(currentMonth, currentYear);

        if (localStorage.getItem('darkTheme') === 'true') {
            darkThemeCheckbox.checked = true;
            document.body.classList.add('dark');
        }

        if (emailListContainer && emailHeader) {
            emailListContainer.addEventListener('scroll', () => {
                const emailItems = document.querySelectorAll('.email-item');
                const headerBottom = emailHeader.getBoundingClientRect().bottom;

                emailItems.forEach(item => {
                    const itemTop = item.getBoundingClientRect().top;
                    item.classList.toggle('blur', itemTop < headerBottom + 20);
                });
            });
        }

        setInterval(async () => {
            try {
                console.log('Sincronizzazione automatica...');
                await syncEmails();
                await loadEmailsToPage();
                await categorizeEmails();
                updateEmailCounts();
                filterEmails(currentCategory, searchInput.value.toLowerCase());
            } catch (err) {
                console.error('Errore sincronizzazione automatica:', err);
                alert('Errore sincronizzazione automatica: ' + err.message);
            }
        }, 5 * 60 * 1000);

        console.log('Inizializzazione completata con successo');
    } catch (err) {
        console.error('Errore inizializzazione:', err);
        alert('Errore inizializzazione: ' + err.message);
    } finally {
        toggleLoading(false);
    }
});

function toggleLoading(show) {
    if (loadingOverlay) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }
}

async function loadEmailsToPage() {
    try {
        console.log('Inizio caricamento email da /api/emails');
        const query = emailLimit === null ? '' : `?limit=${emailLimit}`;
        const response = await fetch(`/api/emails${query}`, {
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('gt')}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Risposta /api/emails:', { status: response.status, ok: response.ok });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Errore risposta /api/emails:', errorData);
            throw new Error(errorData.message || 'Errore caricamento email');
        }

        const emails = await response.json();
        console.log('Email ricevute:', emails.length);
        renderEmails(emails);
        attachEmailListeners();
    } catch (err) {
        console.error('Errore caricamento email:', err);
        throw err;
    }
}

async function categorizeEmails() {
    try {
        console.log('Inizio categorizzazione email');
        const emailItems = document.querySelectorAll('.email-item');
        const emailsToCategorize = Array.from(emailItems)
            .filter(item => !item.getAttribute('data-category') || item.getAttribute('data-category').split(' ').length === 0)
            .map(item => ({
                id: item.getAttribute('data-id'),
                subject: item.getAttribute('data-subject'),
                body: item.getAttribute('data-body')
            }));

        if (emailsToCategorize.length === 0) {
            console.log('Nessuna email da categorizzare');
            return;
        }

        console.log('Email da categorizzare:', emailsToCategorize.length);
        const response = await fetch('/api/ai/categorize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('gt')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ emails: emailsToCategorize })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Errore risposta /api/ai/categorize:', errorData);
            throw new Error(errorData.message || 'Errore categorizzazione email');
        }

        const categorizedEmails = await response.json();
        console.log('Email categorizzate:', categorizedEmails.length);

        categorizedEmails.forEach(({ id, categories }) => {
            const emailItem = document.querySelector(`.email-item[data-id="${id}"]`);
            if (emailItem) {
                emailItem.setAttribute('data-category', categories.join(' '));
                const category = categories[0] || 'inbox';
                const label = emailItem.querySelector('.email-label');
                if (label) {
                    label.textContent = category;
                    label.className = `email-label label-${category}`;
                }
            }
        });

        updateEmailCounts();
        filterEmails(currentCategory, searchInput.value.toLowerCase());
    } catch (err) {
        console.error('Errore categorizzazione email:', err);
        alert('Errore categorizzazione email: ' + err.message);
    }
}

function renderEmails(emails) {
    if (!emailListContainer) {
        console.error('emailListContainer non trovato');
        return;
    }
    emailListContainer.innerHTML = '';

    emails.forEach(email => {
        const emailElement = document.createElement('div');
        emailElement.className = 'email-item';
        emailElement.setAttribute('data-id', email.id || '');
        emailElement.setAttribute('data-category', email.categories?.join(' ') || 'inbox');
        emailElement.setAttribute('data-sender', email.from || 'Sconosciuto');
        emailElement.setAttribute('data-subject', email.subject || '(senza oggetto)');
        emailElement.setAttribute('data-body', email.body || '');
        emailElement.setAttribute('data-time', email.date ? new Date(email.date).toLocaleString() : 'N/D');

        const category = email.categories?.[0] || 'inbox';
        const safeFrom = window.sanitizeHtml(email.from || 'Sconosciuto', { allowedTags: [] });
        const safeSubject = window.sanitizeHtml(email.subject || '(senza oggetto)', { allowedTags: [] });
        const safeBody = window.sanitizeHtml(email.body?.substring(0, 100) || '', { allowedTags: [] });

        emailElement.innerHTML = `
            <div class="email-sender"><span class="email-label label-${category}">${category}</span>${safeFrom}</div>
            <div class="email-subject">${safeSubject}</div>
            <div class="email-time">${email.date ? new Date(email.date).toLocaleString() : 'N/D'}</div>
            <div class="email-preview">${safeBody}...</div>
        `;

        emailListContainer.appendChild(emailElement);
    });
}

function filterEmails(category, searchTerm = '') {
    currentCategory = category;
    navItems.forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-category') === category);
    });

    emailListContainer.style.display = category === 'calendar' ? 'none' : 'block';
    calendarSection.style.display = category === 'calendar' ? 'block' : 'none';

    if (category !== 'calendar') {
        document.querySelectorAll('.email-item').forEach(item => {
            const categories = item.getAttribute('data-category').split(' ');
            const matchesCategory = category === 'inbox' ?
                !categories.includes('sent') && !categories.includes('trash') :
                categories.includes(category);

            const matchesSearch = !searchTerm ||
                item.getAttribute('data-sender').toLowerCase().includes(searchTerm) ||
                item.getAttribute('data-subject').toLowerCase().includes(searchTerm) ||
                item.getAttribute('data-body').toLowerCase().includes(searchTerm);

            item.style.display = matchesCategory && matchesSearch ? 'grid' : 'none';
        });
    }

    updateEmailCounts();
}

async function loadEvents() {
    try {
        console.log('Caricamento eventi da /api/events');
        const response = await fetch('/api/events', {
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('gt')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Errore caricamento eventi');
        }

        events = await response.json();
        console.log('Eventi caricati:', events.length);
    } catch (err) {
        console.error('Errore caricamento eventi:', err);
        alert('Errore caricamento eventi: ' + err.message);
    }
}

function generateCalendar(month, year) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay();
    const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

    calendarMonth.textContent = `${monthNames[month]} ${year}`;
    calendarGrid.innerHTML = `
        <div class="calendar-day">Dom</div>
        <div class="calendar-day">Lun</div>
        <div class="calendar-day">Mar</div>
        <div class="calendar-day">Mer</div>
        <div class="calendar-day">Gio</div>
        <div class="calendar-day">Ven</div>
        <div class="calendar-day">Sab</div>
    `;

    for (let i = 0; i < startDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-date empty';
        calendarGrid.appendChild(emptyDay);
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        const isToday = date.toDateString() === new Date().toDateString();
        const hasEvent = events.some(event => new Date(event.date).toDateString() === date.toDateString());

        const day = document.createElement('div');
        day.className = `calendar-date ${isToday ? 'today' : ''} ${hasEvent ? 'event' : ''}`;
        day.textContent = i;
        day.addEventListener('click', () => {
            eventDateInput.value = date.toISOString().split('T')[0];
            toggleModal(eventModal, true);
        });
        calendarGrid.appendChild(day);
    }

    eventsList.innerHTML = '<h3>Eventi</h3>';
    events.forEach(event => {
        const eventItem = document.createElement('div');
        eventItem.className = 'event-item';
        eventItem.setAttribute('data-id', event._id);
        eventItem.innerHTML = `
            <span>${event.title} - ${new Date(event.date).toLocaleDateString('it-IT')} ${event.time}</span>
            <button class="delete-event-btn"><i class="fas fa-trash"></i> Elimina</button>
        `;
        eventsList.appendChild(eventItem);

        eventItem.querySelector('.delete-event-btn').addEventListener('click', async () => {
            try {
                const response = await fetch(`/api/events/${event._id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${sessionStorage.getItem('gt')}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Errore eliminazione evento');
                }

                events = events.filter(e => e._id !== event._id);
                generateCalendar(currentMonth, currentYear);
                alert('Evento eliminato!');
            } catch (err) {
                console.error('Errore eliminazione evento:', err);
                alert('Errore eliminazione evento: ' + err.message);
            }
        });
    });
}

function toggleModal(modal, show) {
    if (modal) {
        modal.classList.toggle('active', show);
        overlay.classList.toggle('active', show);
    }
}

async function syncEmails() {
    try {
        console.log('Inizio sincronizzazione email da /api/emails/sync');
        const response = await fetch('/api/emails/sync', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('gt')}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Risposta /api/emails/sync:', { status: response.status, ok: response.ok });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Errore risposta /api/emails/sync:', errorData);
            throw new Error(errorData.message || 'Errore sincronizzazione email');
        }

        const data = await response.json();
        console.log('Email sincronizzate:', data.length);
        return data;
    } catch (err) {
        console.error('Errore sincronizzazione:', err);
        throw err;
    }
}

async function sendEmail(to, subject, body) {
    try {
        const response = await fetch('/api/emails/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('gt')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ to, subject, body })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Errore invio email');
        }

        return await response.json();
    } catch (err) {
        console.error('Errore invio email:', err);
        throw err;
    }
}

async function trashEmail(emailId) {
    try {
        const response = await fetch('/api/emails/trash', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('gt')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ emailId })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Errore spostamento email nel cestino');
        }

        return await response.json();
    } catch (err) {
        console.error('Errore spostamento email:', err);
        throw err;
    }
}

function attachEmailListeners() {
    const emailItems = document.querySelectorAll('.email-item');
    emailItems.forEach(item => {
        item.addEventListener('click', () => {
            try {
                currentEmail = item;
                const sender = item.getAttribute('data-sender') || 'Sconosciuto';
                const subject = item.getAttribute('data-subject') || '(senza oggetto)';
                const time = item.getAttribute('data-time') || 'N/D';
                let body = item.getAttribute('data-body') || '(Nessun contenuto)';

                body = body
                    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                    .replace(/style="[^"]*"/gi, '')
                    .replace(/\n{2,}/g, '\n\n')
                    .replace(/\( http:\/\/[^\)]+\)/g, '')
                    .replace(/http:\/\/[^\s]+/g, '')
                    .replace(/\s{2,}/g, ' ')
                    .trim();

                const unsubscribeMarker = body.toLowerCase().indexOf('unsubscribe');
                let mainContent = body;
                let footerContent = '';
                if (unsubscribeMarker !== -1) {
                    mainContent = body.substring(0, unsubscribeMarker).trim();
                    footerContent = body.substring(unsubscribeMarker).trim();
                }

                const sanitizedMainContent = window.sanitizeHtml(mainContent, {
                    allowedTags: ['p', 'br', 'strong', 'em', 'a', 'ul', 'li', 'div'],
                    allowedAttributes: { 'a': ['href', 'target', 'rel'] },
                    transformTags: {
                        'a': (tagName, attribs) => ({
                            tagName: 'a',
                            attribs: {
                                href: attribs.href || '#',
                                target: '_blank',
                                rel: 'noopener noreferrer'
                            }
                        })
                    }
                });

                const sanitizedFooterContent = window.sanitizeHtml(footerContent, {
                    allowedTags: ['p', 'a'],
                    allowedAttributes: { 'a': ['href', 'target', 'rel'] },
                    transformTags: {
                        'a': (tagName, attribs) => ({
                            tagName: 'a',
                            attribs: {
                                href: attribs.href || '#',
                                target: '_blank',
                                rel: 'noopener noreferrer'
                            }
                        })
                    }
                });

                previewSender.textContent = sender;
                previewSubject.textContent = subject;
                previewTime.textContent = time;
                previewBody.innerHTML = `
                    <div class="email-content">${sanitizedMainContent || '<p>(Nessun contenuto)</p>'}</div>
                    ${sanitizedFooterContent ? `<div class="email-footer">${sanitizedFooterContent}</div>` : ''}
                `;

                toggleModal(emailPreviewModal, true);
            } catch (err) {
                console.error('Errore apertura anteprima email:', err);
                alert('Errore apertura anteprima email: ' + err.message);
            }
        });
    });
}

function toggleEmailCountVisibility(show) {
    emailCounts.forEach(count => {
        count.style.display = show ? 'inline-block' : 'none';
    });
}

function updateEmailCounts() {
    navItems.forEach(item => {
        const category = item.getAttribute('data-category');
        let count = 0;

        if (category === 'inbox') {
            count = document.querySelectorAll('.email-item:not([data-category*="sent"]):not([data-category*="trash"])').length;
        } else if (category === 'calendar') {
            count = events.length;
        } else {
            count = document.querySelectorAll(`.email-item[data-category*="${category}"]`).length;
        }

        const countElement = item.querySelector('.email-count');
        if (countElement) countElement.textContent = count;
    });
}

// Event listeners
emailLimitSelect.addEventListener('change', async () => {
    try {
        emailLimit = emailLimitSelect.value === 'all' ? null : parseInt(emailLimitSelect.value);
        await loadEmailsToPage();
        await categorizeEmails();
        filterEmails(currentCategory, searchInput.value.toLowerCase());
    } catch (err) {
        console.error('Errore cambiamento limite email:', err);
        alert('Errore cambio limite email: ' + err.message);
    }
});

searchInput.addEventListener('input', () => {
    filterEmails(currentCategory, searchInput.value.toLowerCase());
});

navItems.forEach(item => {
    item.addEventListener('click', () => {
        const category = item.getAttribute('data-category');
        filterEmails(category, searchInput.value.toLowerCase());
    });
});

[composeBtn, settingsBtn].forEach(btn => {
    btn.addEventListener('click', () => toggleModal(btn === composeBtn ? composeModal : settingsModal, true));
});

closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        [composeModal, settingsModal, eventModal, emailPreviewModal].forEach(modal => toggleModal(modal, false));
    });
});

saveBtn.addEventListener('click', () => {
    localStorage.setItem('darkTheme', darkThemeCheckbox.checked);
    toggleModal(settingsModal, false);
});

logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('gt');
    localStorage.removeItem('user');
    window.location.href = '/';
});

saveAccountBtn.addEventListener('click', () => {
    if (!accountNameInput.value || !accountEmailInput.value) {
        alert('Compila tutti i campi account!');
        return;
    }
    localStorage.setItem('user', JSON.stringify({
        name: accountNameInput.value,
        email: accountEmailInput.value
    }));
    toggleModal(settingsModal, false);
    alert('Modifiche account salvate!');
});

addEventBtn.addEventListener('click', async () => {
    const title = eventTitleInput.value.trim();
    const date = eventDateInput.value;
    const time = eventTimeInput.value;

    if (!title || !date || !time) {
        alert('Compila tutti i campi!');
        return;
    }

    try {
        const response = await fetch('/api/events', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('gt')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, date, time })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Errore salvataggio evento');
        }

        const newEvent = await response.json();
        events.push(newEvent);
        generateCalendar(currentMonth, currentYear);
        toggleModal(eventModal, false);
        alert('Evento aggiunto!');
        eventTitleInput.value = '';
        eventDateInput.value = '';
        eventTimeInput.value = '';
    } catch (err) {
        console.error('Errore salvataggio evento:', err);
        alert('Errore salvataggio evento: ' + err.message);
    }
});

darkThemeCheckbox.addEventListener('change', () => {
    document.body.classList.toggle('dark', darkThemeCheckbox.checked);
    localStorage.setItem('darkTheme', darkThemeCheckbox.checked);
});

showEmailCountCheckbox.addEventListener('change', () => {
    toggleEmailCountVisibility(showEmailCountCheckbox.checked);
});

syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true;
    syncBtn.textContent = 'Sincronizzazione...';
    try {
        await syncEmails();
        await loadEmailsToPage();
        await categorizeEmails();
        updateEmailCounts();
        filterEmails(currentCategory, searchInput.value.toLowerCase());
        alert('Email sincronizzate!');
    } catch (err) {
        console.error('Errore sincronizzazione:', err);
        alert('Errore sincronizzazione: ' + err.message);
    } finally {
        syncBtn.disabled = false;
        syncBtn.textContent = 'Sincronizza';
    }
});

sendBtn.addEventListener('click', async () => {
    const to = composeInput.value.trim();
    const subject = composeSubject.value.trim();
    const body = composeText.value.trim();

    if (!to || !subject || !body) {
        alert('Compila tutti i campi!');
        return;
    }

    try {
        await sendEmail(to, subject, body);
        toggleModal(composeModal, false);
        alert('Email inviata!');
        composeInput.value = '';
        composeSubject.value = '';
        composeText.value = '';
        await syncEmails();
        await loadEmailsToPage();
        await categorizeEmails();
    } catch (err) {
        console.error('Errore invio email:', err);
        alert('Errore invio email: ' + err.message);
    }
});

deleteBtn.addEventListener('click', async () => {
    if (currentEmail) {
        const emailId = currentEmail.getAttribute('data-id');
        let categories = currentEmail.getAttribute('data-category').split(' ');
        if (!categories.includes('trash')) {
            try {
                await trashEmail(emailId);
                categories = ['trash'];
                currentEmail.setAttribute('data-category', categories.join(' '));
                updateEmailCounts();
                filterEmails(currentCategory, searchInput.value.toLowerCase());
                toggleModal(emailPreviewModal, false);
                alert('Email spostata nel cestino!');
            } catch (err) {
                console.error('Errore eliminazione:', err);
                alert('Errore spostamento nel cestino: ' + err.message);
            }
        }
    }
});

replyBtn.addEventListener('click', () => {
    if (currentEmail) {
        composeInput.value = currentEmail.getAttribute('data-sender');
        composeSubject.value = `Re: ${currentEmail.getAttribute('data-subject')}`;
        composeText.value = '';
        toggleModal(emailPreviewModal, false);
        toggleModal(composeModal, true);
    }
});

aiReplyBtn.addEventListener('click', async () => {
    if (!currentEmail) return alert('Nessun email selezionata');
    const body = currentEmail.getAttribute('data-body');
    if (!body) return alert('Nessun contenuto disponibile');

    aiReplyBtn.textContent = 'AI in corso...';
    aiReplyBtn.disabled = true;

    try {
        const response = await fetch('/api/ai/reply', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('gt')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ body })
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('Errore risposta /api/ai/reply:', data);
            throw new Error(data.message || 'Errore generazione risposta AI');
        }

        toggleModal(composeModal, true);
        composeText.value = data.reply;
        composeInput.value = currentEmail.getAttribute('data-sender');
        composeSubject.value = `Re: ${currentEmail.getAttribute('data-subject')}`;
        toggleModal(emailPreviewModal, false);
    } catch (err) {
        console.error('Errore AI reply:', err.message);
        alert('Errore generazione risposta AI: ' + err.message);
    } finally {
        aiReplyBtn.textContent = 'Rispondi con AI';
        aiReplyBtn.disabled = false;
    }
});

prevBtn.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    generateCalendar(currentMonth, currentYear);
});

nextBtn.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    generateCalendar(currentMonth, currentYear);
});