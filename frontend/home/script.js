// frontend/home/script.js
// Variabili
const navItems = document.querySelectorAll('.email-nav li');
const emailList = document.querySelector('#emailList');
const emailListContainer = document.querySelector('.email-list-container'); // Aggiunto per gestire lo scorrimento
const emailHeader = document.querySelector('.email-header'); // Aggiunto per il blur
const calendarSection = document.querySelector('#calendarSection');
const composeModal = document.querySelector('#composeModal');
const settingsModal = document.querySelector('#settingsModal');
const eventModal = document.querySelector('#eventModal');
const emailPreviewModal = document.querySelector('#emailPreviewModal');
const composeBtn = document.querySelector('.compose-btn');
const settingsBtn = document.querySelector('.settings-btn');
const syncBtn = document.querySelector('#sync-button');
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

let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();
let currentCategory = 'inbox';
let events = [];
let currentEmail = null;
let emailLimit = 50; // Valore predefinito aggiornato

// Inizializzazione
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Verifica token nell'URL
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        if (token) {
            sessionStorage.setItem('gt', token);
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Verifica autenticazione
        const storedToken = sessionStorage.getItem('gt');
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        if (!storedToken || !user.email) {
            window.location.href = '/';
            return;
        }

        // Imposta dati utente
        accountNameInput.value = user.name || '';
        accountEmailInput.value = user.email;

        // Carica dati iniziali
        await loadEmailsToPage();
        // Sincronizzazione automatica al caricamento se non ci sono email
        if (document.querySelectorAll('.email-item').length === 0) {
            console.log('Nessuna email trovata, avvio sincronizzazione automatica');
            syncBtn.disabled = true;
            syncBtn.textContent = 'Sincronizzazione...';
            try {
                await syncEmails();
                await loadEmailsToPage();
            } catch (err) {
                console.error('Errore sincronizzazione automatica:', err);
                alert('Errore sincronizzazione automatica: ' + err.message);
            } finally {
                syncBtn.disabled = false;
                syncBtn.textContent = 'Sincronizza';
            }
        }

        updateEmailCounts();
        toggleEmailCountVisibility(showEmailCountCheckbox.checked);
        filterEmails('inbox');
        generateCalendar(currentMonth, currentYear);

        // Applica tema scuro se salvato
        if (localStorage.getItem('darkTheme') === 'true') {
            darkThemeCheckbox.checked = true;
            document.body.classList.add('dark');
        }

        // Aggiungi listener per effetto blur durante lo scorrimento
        if (emailListContainer && emailHeader) {
            emailListContainer.addEventListener('scroll', () => {
                const emailItems = document.querySelectorAll('.email-item');
                const headerBottom = emailHeader.getBoundingClientRect().bottom;

                emailItems.forEach(item => {
                    const itemTop = item.getBoundingClientRect().top;
                    if (itemTop < headerBottom + 20) {
                        item.classList.add('blur');
                    } else {
                        item.classList.remove('blur');
                    }
                });
            });
        }
    } catch (err) {
        console.error('Errore inizializzazione:', err);
        window.location.href = '/';
    }
});

// Funzioni principali
async function loadEmailsToPage() {
    try {
        const query = emailLimit === null ? '' : `?limit=${emailLimit}`;
        const response = await fetch(`/api/emails${query}`, {
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('gt')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Errore caricamento email');
        }

        const emails = await response.json();
        console.log('Emails caricate:', emails);
        renderEmailList(emails);
    } catch (err) {
        console.error('Errore caricamento email:', err);
        throw err; // Propaga l'errore per gestirlo nel chiamante
    }
}

function renderEmailList(emails) {
    // Svuota il contenitore delle email, ma lascia l'header
    emailList.innerHTML = `
        <div class="email-header">
            <div>Mittente</div>
            <div>Oggetto</div>
            <div>Data</div>
        </div>
        <div class="email-list-container"></div>
    `;

    const emailListContainer = emailList.querySelector('.email-list-container');

    console.log('Rendering emails:', emails);

    emails.forEach(email => {
        const emailItem = document.createElement('div');
        emailItem.className = 'email-item';
        emailItem.setAttribute('data-id', email.id);
        emailItem.setAttribute('data-sender', email.from || 'Sconosciuto');
        emailItem.setAttribute('data-subject', email.subject || '(senza oggetto)');
        emailItem.setAttribute('data-body', email.body || '(Nessun contenuto)');
        emailItem.setAttribute('data-time', new Date(email.date).toLocaleString('it-IT'));
        emailItem.setAttribute('data-category', email.categories.join(' '));

        emailItem.innerHTML = `
            <div class="email-sender">${email.from || 'Sconosciuto'}</div>
            <div class="email-subject">${email.subject || '(senza oggetto)'}</div>
            <div class="email-time">${new Date(email.date).toLocaleString('it-IT')}</div>
            <div class="email-preview">${email.body.substring(0, 100)}${email.body.length > 100 ? '...' : ''}</div>
        `;

        emailListContainer.appendChild(emailItem);
    });

    attachEmailListeners();
}

function filterEmails(category, searchTerm = '') {
    currentCategory = category;

    console.log('Filtrando per categoria:', category);

    // Aggiorna stato attivo della navigazione
    navItems.forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-category') === category);
    });

    // Mostra/nascondi sezione calendario
    emailList.style.display = category === 'calendar' ? 'none' : 'block';
    calendarSection.style.display = category === 'calendar' ? 'block' : 'none';

    // Filtra email solo se non siamo nella sezione calendario
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

            console.log('Email corrisponde al filtro?', matchesCategory && matchesSearch);

            item.style.display = matchesCategory && matchesSearch ? 'grid' : 'none';
        });
    }

    updateEmailCounts();
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

        item.querySelector('.email-count').textContent = count;
    });
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
        eventItem.textContent = `${event.title} - ${new Date(event.date).toLocaleDateString('it-IT')} ${event.time}`;
        eventsList.appendChild(eventItem);
    });
}

function toggleModal(modal, show) {
    modal.classList.toggle('active', show);
    overlay.classList.toggle('active', show);
}

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
            const errorData = await response.json();
            throw new Error(errorData.message || 'Errore sincronizzazione email');
        }

        return await response.json();
    } catch (err) {
        console.error('Errore sincronizzazione:', err);
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
    if (!emailItems.length) {
        console.warn('Nessun elemento .email-item trovato');
        return;
    }

    emailItems.forEach(item => {
        item.addEventListener('click', () => {
            try {
                if (!window.sanitizeHtml) {
                    throw new Error('sanitizeHtml non è disponibile');
                }

                currentEmail = item;
                const sender = item.getAttribute('data-sender') || 'Sconosciuto';
                const subject = item.getAttribute('data-subject') || '(senza oggetto)';
                const time = item.getAttribute('data-time') || 'N/D';
                let body = item.getAttribute('data-body') || '(Nessun contenuto)';

                // Pulizia del testo
                body = body
                    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Rimuove tag <style>
                    .replace(/style="[^"]*"/gi, '') // Rimuove attributi style inline
                    .replace(/\n{2,}/g, '\n\n') // Riduce multiple linee vuote
                    .replace(/\( http:\/\/[^\)]+\)/g, '') // Rimuove link tra parentesi
                    .replace(/http:\/\/[^\s]+/g, '') // Rimuove altri link non desiderati
                    .replace(/\s{2,}/g, ' ') // Riduce spazi multipli
                    .trim();

                // Separazione del contenuto principale dal footer
                const unsubscribeMarker = body.toLowerCase().indexOf('unsubscribe');
                let mainContent = body;
                let footerContent = '';
                if (unsubscribeMarker !== -1) {
                    mainContent = body.substring(0, unsubscribeMarker).trim();
                    footerContent = body.substring(unsubscribeMarker).trim();
                }

                // Sanitizzazione HTML
                const sanitizedMainContent = sanitizeHtml(mainContent, {
                    allowedTags: ['p', 'br', 'strong', 'em', 'a', 'ul', 'li', 'div'],
                    allowedAttributes: {
                        'a': ['href', 'target', 'rel']
                    },
                    transformTags: {
                        'a': (tagName, attribs) => {
                            return {
                                tagName: 'a',
                                attribs: {
                                    href: attribs.href || '#',
                                    target: '_blank',
                                    rel: 'noopener noreferrer'
                                }
                            };
                        }
                    },
                    nonTextTags: ['style', 'script', 'textarea', 'noscript', 'pre', 'table']
                });

                const sanitizedFooterContent = sanitizeHtml(footerContent, {
                    allowedTags: ['p', 'a'],
                    allowedAttributes: {
                        'a': ['href', 'target', 'rel']
                    },
                    transformTags: {
                        'a': (tagName, attribs) => {
                            return {
                                tagName: 'a',
                                attribs: {
                                    href: attribs.href || '#',
                                    target: '_blank',
                                    rel: 'noopener noreferrer'
                                }
                            };
                        }
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
                console.log('Anteprima email aperta:', { sender, subject });
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

// Event listeners
emailLimitSelect.addEventListener('change', async () => {
    try {
        emailLimit = emailLimitSelect.value === 'all' ? null : parseInt(emailLimitSelect.value);
        await loadEmailsToPage();
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
    alert('Impostazioni salvate!');
});

logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('gt');
    localStorage.removeItem('user');
    window.location.href = '/';
});

saveAccountBtn.addEventListener('click', () => {
    localStorage.setItem('user', JSON.stringify({
        name: accountNameInput.value,
        email: accountEmailInput.value
    }));
    toggleModal(settingsModal, false);
    alert('Modifiche account salvate!');
});

addEventBtn.addEventListener('click', () => {
    const title = eventTitleInput.value;
    const date = new Date(eventDateInput.value);
    const time = eventTimeInput.value;

    if (title && date && time) {
        events.push({ date, title, time });
        generateCalendar(currentMonth, currentYear);
        toggleModal(eventModal, false);
        alert('Evento aggiunto!');
        eventTitleInput.value = '';
        eventDateInput.value = '';
        eventTimeInput.value = '';
    } else {
        alert('Compila tutti i campi!');
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

aiReplyBtn.addEventListener('click', () => {
    if (currentEmail) {
        composeInput.value = currentEmail.getAttribute('data-sender');
        composeSubject.value = `Re: ${currentEmail.getAttribute('data-subject')}`;
        composeText.value = `Ciao ${currentEmail.getAttribute('data-sender')},\n\nGrazie per il tuo messaggio. Ti risponderò al più presto.\n\nCordiali saluti,\n${accountNameInput.value || 'Il tuo nome'}`;
        toggleModal(emailPreviewModal, false);
        toggleModal(composeModal, true);
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