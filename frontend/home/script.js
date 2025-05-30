const navItems = document.querySelectorAll(".email-nav li");
const emailListContainer = document.querySelector(".email-list-container");
const emailHeader = document.querySelector(".email-header");
const calendarSection = document.querySelector("#calendarSection");
const composeModal = document.querySelector("#composeModal");
const settingsModal = document.querySelector("#settingsModal");
const eventModal = document.querySelector("#eventModal");
const emailPreviewModal = document.querySelector("#emailPreviewModal");
const composeBtn = document.querySelector(".compose-btn");
const settingsBtn = document.querySelector(".settings-btn");
const syncBtn = document.querySelector(".sync-btn");
const sendBtn = document.querySelector(".send-btn");
const overlay = document.querySelector("#overlay");
const closeButtons = document.querySelectorAll(".close-btn");
const saveBtn = document.querySelector(".save-btn");
const calendarGrid = document.querySelector("#calendarGrid");
const calendarMonth = document.querySelector("#calendarMonth");
const prevBtn = document.querySelector(".calendar-nav.prev");
const nextBtn = document.querySelector(".calendar-nav.next");
const eventsList = document.querySelector("#eventsList");
const searchInput = document.querySelector("#searchInput");
const addEventBtn = document.querySelector(".add-event-btn");
const eventTitleInput = document.querySelector("#eventTitle");
const eventDateInput = document.querySelector("#eventDate");
const eventTimeInput = document.querySelector("#eventTime");
const logoutBtn = document.querySelector(".logout-btn");
const saveAccountBtn = document.querySelector(".save-account-btn");
const previewSender = document.querySelector("#previewSender");
const previewSubject = document.querySelector("#previewSubject");
const previewBody = document.querySelector("#previewBody");
const previewTime = document.querySelector("#previewTime");
const deleteBtn = document.querySelector(".delete-btn");
const replyBtn = document.querySelector(".reply-btn");
const aiReplyBtn = document.querySelector(".ai-reply-btn");
const notificationsCheckbox = document.querySelector("#notifications");
const darkThemeCheckbox = document.querySelector("#darkTheme");
const showEmailCountCheckbox = document.querySelector("#showEmailCount");
const emailCounts = document.querySelectorAll(".email-count");
const composeInput = document.querySelector(".compose-input");
const composeSubject = document.querySelector(".compose-subject");
const composeText = document.querySelector(".compose-text");
const accountNameInput = document.querySelector("#accountName");
const accountEmailInput = document.querySelector("#accountEmail");
const emailLimitSelect = document.querySelector("#emailLimit");
const loadingOverlay = document.querySelector("#loadingOverlay");
const sidebarItems = document.querySelectorAll(".sidebar-item");
const sidebarContacts = document.querySelectorAll(".sidebar-section li[data-email]");
const sidebarFavorites = document.querySelectorAll(".sidebar-section li[data-email-id]");
const chatInput = document.querySelector("#chatInput");
const chatSendBtn = document.querySelector(".chat-send-btn");
const chatClearBtn = document.querySelector(".chat-clear-btn");
const chatMessages = document.querySelector("#chatMessages");
const suggestionItems = document.querySelectorAll(".suggestion-item");

let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();
let currentCategory = "inbox";
let events = [];
let currentEmail = null;
let emailLimit = 10;
let currentFilter = { type: "category", value: "" };

// Definizione di tutte le funzioni prima delle chiamate

function toggleLoading(show) {
    if (loadingOverlay) {
        loadingOverlay.style.display = show ? "flex" : "none";
    }
}

async function loadEmailsToPage() {
    try {
        const query = `?limit=${emailLimit}`;
        const response = await fetch(`/api/emails${query}`, {
            headers: { Authorization: `Bearer ${sessionStorage.getItem("gt")}`, "Content-Type": "application/json" }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Errore caricamento email");
        }
        const emails = await response.json();
        if (!emails || !Array.isArray(emails)) {
            console.error("Dati email non validi:", emails);
            throw new Error("Dati email non validi");
        }
        await renderEmails(emails);
    } catch (err) {
        console.error("Errore in loadEmailsToPage:", err);
        emailListContainer.innerHTML = "<p>Errore nel caricamento delle email. Riprova.</p>";
        throw err;
    }
}

async function categorizeEmails() {
    try {
        const emailItems = document.querySelectorAll(".email-item");
        const emailsToCategorize = Array.from(emailItems).map(item => ({
            id: item.getAttribute("data-id"),
            subject: item.getAttribute("data-subject") || "",
            body: item.getAttribute("data-body") || "",
            from: item.getAttribute("data-sender") || "",
            userEmail: item.getAttribute("data-user-email") || "",
            gmailLabelIds: JSON.parse(item.getAttribute("data-labels") || "[]")
        }));
        if (emailsToCategorize.length === 0) return;
        const batchSize = 10;
        for (let i = 0; i < emailsToCategorize.length; i += batchSize) {
            const batch = emailsToCategorize.slice(i, i + batchSize);
            const response = await fetch("/api/ai/categorize", {
                method: "POST",
                headers: { Authorization: `Bearer ${sessionStorage.getItem("gt")}`, "Content-Type": "application/json" },
                body: JSON.stringify({ emails: batch })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Errore categorizzazione email");
            }
            const categorizedEmails = await response.json();
            await fetch("/api/emails/update-categories", {
                method: "POST",
                headers: { Authorization: `Bearer ${sessionStorage.getItem("gt")}`, "Content-Type": "application/json" },
                body: JSON.stringify({ emails: categorizedEmails })
            });
        }
        await loadEmailsToPage();
    } catch (err) {
        console.error("Errore in categorizeEmails:", err);
    }
}

async function getProfilePicture(emailAddress) {
    try {
        if (!emailAddress) {
            console.warn('Email non fornito per getProfilePicture');
            return '/img/default.jpg';
        }
        const response = await fetch(`/api/user/profile-picture?email=${encodeURIComponent(emailAddress)}`, {
            headers: { Authorization: `Bearer ${sessionStorage.getItem("gt")}`, "Content-Type": "application/json" }
        });
        if (!response.ok) {
            const errorData = await response.json();
            console.error(`Errore recupero foto profilo per ${emailAddress}:`, errorData.message);
            return '/img/default.jpg';
        }
        const data = await response.json();
        if (!data.photoUrl) {
            console.log(`Nessuna foto profilo disponibile per ${emailAddress}`);
            return '/img/default.jpg';
        }
        return data.photoUrl;
    } catch (err) {
        console.error(`Errore recupero foto profilo per ${emailAddress}:`, err.message);
        return '/img/default.jpg';
    }
}

async function renderEmails(emails) {
    try {
        emailListContainer.innerHTML = '';
        if (!emails || emails.length === 0) {
            emailListContainer.innerHTML = "<p>Nessuna email trovata.</p>";
            return;
        }
        for (const email of emails) {
            const label = email.categories && email.categories.length > 0 ? email.categories[0] : 'Tutte le email';
            const bgColor = email.backgroundColor || '#2563eb';
            const textColor = email.textColor || '#ffffff';
            const profilePicture = await getProfilePicture(email.from);
            const previewText = (email.body || "(Nessun contenuto)").substring(0, 50) + (email.body.length > 50 ? '...' : '');
            const subjectText = (email.subject || "(senza oggetto)").substring(0, 25) + (email.subject.length > 25 ? '...' : '');
            const emailDate = new Date(email.date);
            // Formato uniforme: "DD/MM/YYYY HH:MM"
            const formattedTime = emailDate.toLocaleString('it-IT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).replace(',', ''); // Rimuove la virgola tra data e ora
            const emailElement = document.createElement('div');
            emailElement.className = 'email-item';
            emailElement.dataset.id = email.id;
            emailElement.dataset.categories = email.categories ? email.categories.join(" ") : "";
            emailElement.dataset.sender = email.from || "Sconosciuto";
            emailElement.dataset.subject = email.subject || "(senza oggetto)";
            emailElement.dataset.body = email.body || "";
            emailElement.dataset.time = email.date || new Date().toISOString();
            emailElement.dataset.labels = JSON.stringify(email.gmailLabelIds || []);
            emailElement.dataset.userEmail = email.userEmail || "";
            emailElement.dataset.attachments = JSON.stringify(email.attachments || []);
            emailElement.innerHTML = `
                <div class="email-label" style="background-color: ${bgColor}; color: ${textColor};">${label}</div>
                <div class="email-profile">
                    <img src="${profilePicture}" alt="Avatar" class="profile-picture">
                </div>
                <div class="email-sender">${email.from || "Sconosciuto"}</div>
                <div class="email-subject">${subjectText}</div>
                <div class="email-preview">${previewText}</div>
                <div class="email-time">${formattedTime}</div>
            `;
            emailListContainer.appendChild(emailElement);
        }
        filterEmails(currentCategory, searchInput.value.toLowerCase(), currentFilter.type, currentFilter.value);
        await attachEmailListeners();
    } catch (err) {
        console.error("Errore in renderEmails:", err);
        emailListContainer.innerHTML = "<p>Errore nel rendering delle email.</p>";
    }
}

function filterEmails(category, searchTerm = "", filterType = "category", filterValue = "") {
    try {
        currentCategory = category;
        currentFilter = { type: filterType, value: filterValue };
        navItems.forEach(item => {
            item.classList.toggle("active", item.getAttribute("data-category") === category && filterType === "category");
        });
        sidebarItems.forEach(item => {
            item.classList.toggle("active", item.getAttribute("data-category") === filterValue && filterType === "category");
        });
        sidebarContacts.forEach(item => {
            item.classList.toggle("active", filterType === "contact" && item.getAttribute("data-email") === filterValue);
        });
        sidebarFavorites.forEach(item => {
            item.classList.toggle("active", filterType === "favorite" && item.getAttribute("data-email-id") === filterValue);
        });
        emailListContainer.style.display = category === "calendar" ? "none" : "block";
        calendarSection.style.display = category === "calendar" ? "block" : "none";
        if (category !== "calendar") {
            document.querySelectorAll(".email-item").forEach(item => {
                const categories = item.getAttribute("data-categories").split(" ").filter(c => c);
                const categoryMap = {
                    inbox: 'Tutte le email',
                    sent: 'Inviate',
                    important: 'Importanti',
                    meetings: 'Riunioni',
                    calendar: 'Calendario',
                    spam: 'Spam',
                    trash: 'Cestino',
                    promotions: 'Promozioni',
                    toreply: 'Da rispondere',
                    draft: 'Bozze'
                };
                const mappedCategory = categoryMap[category] || category;
                let matchesFilter = false;
                if (filterType === "category") {
                    matchesFilter = category === "inbox" || categories.includes(mappedCategory);
                } else if (filterType === "contact") {
                    matchesFilter = item.getAttribute("data-sender").toLowerCase().includes(filterValue.toLowerCase());
                } else if (filterType === "favorite") {
                    matchesFilter = item.getAttribute("data-id") === filterValue;
                }
                const matchesSearch = !searchTerm ||
                    item.getAttribute("data-sender").toLowerCase().includes(searchTerm) ||
                    item.getAttribute("data-subject").toLowerCase().includes(searchTerm) ||
                    item.getAttribute("data-body").toLowerCase().includes(searchTerm);
                item.style.display = matchesFilter && matchesSearch ? "grid" : "none";
            });
        }
        updateEmailCounts();
    } catch (err) {
        console.error("Errore in filterEmails:", err);
    }
}

async function loadEvents() {
    try {
        const response = await fetch("/api/events", {
            headers: { Authorization: `Bearer ${sessionStorage.getItem("gt")}`, "Content-Type": "application/json" }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Errore caricamento eventi");
        }
        events = await response.json();
    } catch (err) {
        console.error("Errore in loadEvents:", err);
    }
}

function generateCalendar() {
    try {
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
        const monthNames = [
            "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
            "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
        ];
        calendarMonth.textContent = `${monthNames[currentMonth]} ${currentYear}`;
        calendarGrid.innerHTML = `
            <div class="calendar-day">Lun</div>
            <div class="calendar-day">Mar</div>
            <div class="calendar-day">Mer</div>
            <div class="calendar-day">Gio</div>
            <div class="calendar-day">Ven</div>
            <div class="calendar-day">Sab</div>
            <div class="calendar-day">Dom</div>
        `;
        for (let i = 0; i < startDay; i++) {
            const emptyDay = document.createElement("div");
            emptyDay.className = "calendar-date empty";
            calendarGrid.appendChild(emptyDay);
        }
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(currentYear, currentMonth, i);
            const isToday = date.toDateString() === new Date().toDateString();
            const hasEvent = events.some(event => new Date(event.date).toDateString() === date.toDateString());
            const dayElement = document.createElement("div");
            dayElement.className = `calendar-date ${isToday ? "today" : ""} ${hasEvent ? "event" : ""}`;
            dayElement.textContent = i;
            dayElement.addEventListener("click", () => {
                eventDateInput.value = date.toISOString().split("T")[0];
                toggleModal(eventModal, true);
            });
            calendarGrid.appendChild(dayElement);
        }
        const totalCells = startDay + daysInMonth;
        const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let i = 0; i < remainingCells; i++) {
            const emptyDay = document.createElement("div");
            emptyDay.className = "calendar-date empty";
            calendarGrid.appendChild(emptyDay);
        }
        eventsList.innerHTML = "<h3>Eventi</h3>";
        events.forEach(event => {
            const eventItem = document.createElement("div");
            eventItem.className = "event-item";
            eventItem.setAttribute("data-id", event._id);
            eventItem.innerHTML = `
                <span>${event.title} - ${new Date(event.date).toLocaleDateString('it-IT')} ${event.time}</span>
                <button class="delete-event-btn"><i class="fas fa-trash"></i> Elimina</button>
            `;
            eventsList.appendChild(eventItem);
            eventItem.querySelector(".delete-event-btn").addEventListener("click", async () => {
                try {
                    const response = await fetch(`/api/events/${event._id}`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${sessionStorage.getItem("gt")}`, "Content-Type": "application/json" }
                    });
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || "Errore eliminazione evento");
                    }
                    events = events.filter(e => e._id !== event._id);
                    generateCalendar();
                    alert("Evento eliminato!");
                } catch (err) {
                    console.error("Errore eliminazione evento:", err);
                    alert("Errore eliminazione evento: " + err.message);
                }
            });
        });
    } catch (err) {
        console.error("Errore in generateCalendar:", err);
        eventsList.innerHTML = "<p>Errore nel rendering del calendario.</p>";
    }
}

function toggleModal(modal, show) {
    try {
        if (modal) {
            modal.classList.toggle("active", show);
            overlay.classList.toggle("active", show);
        }
    } catch (err) {
        console.error("Errore in toggleModal:", err);
    }
}

async function syncEmails() {
    try {
        const response = await fetch("/api/emails/sync", {
            method: "POST",
            headers: { Authorization: `Bearer ${sessionStorage.getItem("gt")}`, "Content-Type": "application/json" }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Errore sincronizzazione email");
        }
        return await response.json();
    } catch (err) {
        console.error("Errore in syncEmails:", err);
        throw err;
    }
}

async function sendEmail(to, subject, body) {
    try {
        const response = await fetch("/api/emails/send", {
            method: "POST",
            headers: { Authorization: `Bearer ${sessionStorage.getItem("gt")}`, "Content-Type": "application/json" },
            body: JSON.stringify({ to, subject, body })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Errore invio email");
        }
        return await response.json();
    } catch (err) {
        console.error("Errore in sendEmail:", err);
        throw err;
    }
}

async function trashEmail(emailId) {
    try {
        const response = await fetch("/api/emails/trash", {
            method: "POST",
            headers: { Authorization: `Bearer ${sessionStorage.getItem("gt")}`, "Content-Type": "application/json" },
            body: JSON.stringify({ emailId })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Errore spostamento email nel cestino");
        }
        return await response.json();
    } catch (err) {
        console.error("Errore in trashEmail:", err);
        throw err;
    }
}

async function attachEmailListeners() {
    try {
        document.querySelectorAll(".email-item").forEach(item => {
            item.removeEventListener('click', handleEmailClick);
            item.addEventListener('click', handleEmailClick);
        });
    } catch (err) {
        console.error("Errore in attachEmailListeners:", err);
    }
}

function sanitizeContent(content) {
    try {
        if (typeof sanitizeHtml !== 'undefined') {
            return sanitizeHtml(content, {
                allowedTags: ['p', 'br', 'strong', 'em', 'a', 'ul', 'li', 'div'],
                allowedAttributes: {
                    'a': ['href', 'target', 'rel']
                }
            });
        }
        return content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<[^>]+>/g, '');
    } catch (err) {
        console.error("Errore sanitizzazione:", err);
        return content;
    }
}

async function handleEmailClick(event) {
    try {
        const item = event.currentTarget;
        currentEmail = item;
        const sender = item.getAttribute("data-sender") || "Sconosciuto";
        const subject = item.getAttribute("data-subject") || "(senza oggetto)";
        const time = item.getAttribute("data-time") || "N/D";
        let body = item.getAttribute("data-body") || "(Nessun contenuto)";
        const attachments = JSON.parse(item.getAttribute("data-attachments") || "[]");
        body = body.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
            .replace(/style="[^"]*"/gi, "")
            .replace(/\n{2,}/g, "\n\n")
            .replace(/\( http:\/\/[^\)]+\)/g, "")
            .replace(/http:\/\/[^\s]+/g, "")
            .replace(/\s{2,}/g, " ")
            .trim();
        const unsubscribeMarker = body.toLowerCase().indexOf("unsubscribe");
        let mainContent = body;
        let footerContent = "";
        if (unsubscribeMarker !== -1) {
            mainContent = body.substring(0, unsubscribeMarker).trim();
            footerContent = body.substring(unsubscribeMarker).trim();
        }
        const sanitizedMainContent = sanitizeContent(mainContent);
        const sanitizedFooterContent = sanitizeContent(footerContent);
        let attachmentsHtml = '';
        if (attachments.length > 0) {
            attachmentsHtml = '<div class="email-attachments">';
            for (const attachment of attachments) {
                const isImage = attachment.mimeType && attachment.mimeType.startsWith('image/');
                const extension = attachment.filename ? attachment.filename.split('.').pop().toLowerCase() : 'default';
                const iconPath = extension === 'figma' ? `/img/extensions/figma.png` : `/img/extensions/${extension}.svg`;
                const attachmentUrl = `/api/emails/${item.getAttribute("data-id")}/attachments/${attachment.attachmentId}`;
                try {
                    const response = await fetch(attachmentUrl, {
                        method: 'HEAD',
                        headers: { Authorization: `Bearer ${sessionStorage.getItem("gt")}` }
                    });
                    if (!response.ok) {
                        attachmentsHtml += `
                            <div class="attachment-item">
                                <img src="${iconPath}" alt="${extension} icon" class="attachment-img" onerror="this.src='/img/extensions/default.svg'">
                                <span>${attachment.filename} (Non disponibile)</span>
                            </div>
                        `;
                        continue;
                    }
                } catch (err) {
                    attachmentsHtml += `
                        <div class="attachment-item">
                            <img src="${iconPath}" alt="${extension} icon" class="attachment-icon" onerror="this.src='/img/extensions/default.svg'">
                            <span>${attachment.filename} (Errore)</span>
                        </div>
                    `;
                    continue;
                }
                attachmentsHtml += `
                    <div class="attachment-item">
                        ${isImage ? `<img src="${attachmentUrl}" alt="${attachment.filename}" class="attachment-preview-img">` : ''}
                        <div class="attachment-info">
                            <img src="${iconPath}" alt="${extension} icon" class="attachment-icon" onerror="this.src='/img/extensions/default.svg'">
                            <a href="${attachmentUrl}" download="${attachment.filename}">
                                ${attachment.filename} (${attachment.size ? (attachment.size / 1024).toFixed(2) : '0'} KB)
                            </a>
                            ${isImage ? `<button class="view-attachment-btn" data-attachment-url="${attachmentUrl}">Visualizza</button>` : ''}
                        </div>
                    </div>
                `;
            }
            attachmentsHtml += '</div>';
        }
        const previewHeader = emailPreviewModal.querySelector('.email-preview-header h3');
        previewHeader.textContent = subject.substring(0, 50) + (subject.length > 50 ? '...' : '');
        previewSender.textContent = sender;
        previewTime.textContent = time ? new Date(time).toLocaleString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) : 'N/D';
        previewBody.innerHTML = `
            <div class="email-content-body">${sanitizedMainContent || "<p>(Nessun contenuto)</p>"}</div>
            ${sanitizedFooterContent ? `<div class="email-footer">${sanitizedFooterContent}</div>` : ''}
            ${attachmentsHtml}
        `;
        toggleModal(emailPreviewModal, true);
        document.querySelectorAll('.view-attachment-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const attachmentUrl = btn.getAttribute("data-attachment-url");
                try {
                    window.open(attachmentUrl, '_blank');
                } catch (err) {
                    console.error('Errore apertura allegato:', err);
                    alert('Impossibile aprire allegato. Riprova o contatta il supporto.');
                }
            });
        });
    } catch (err) {
        console.error("Errore in handleEmailClick:", err);
        alert("Errore durante l'apertura dell'email: " + err.message);
    }
}

function toggleEmailCountVisibility(show) {
    try {
        emailCounts.forEach(count => {
            count.style.display = show ? "inline-block" : "none";
        });
    } catch (err) {
        console.error("Errore in toggleEmailCountVisibility: ", err);
    }
}

function updateEmailCounts() {
    try {
        navItems.forEach(item => {
            const category = item.getAttribute("data-category");
            let count = 0;
            if (category === "inbox") {
                count = document.querySelectorAll('.email-item').length;
            } else if (category === "calendar") {
                count = events.length;
            } else {
                const categoryMap = {
                    sent: 'Inviate',
                    important: 'Importanti',
                    meetings: 'Riunioni',
                    spam: 'Spam',
                    trash: 'Cestino',
                    promotions: 'Promozioni',
                    toreply: 'Da rispondere',
                    draft: 'Bozze'
                };
                const mappedCategory = categoryMap[category] || category;
                count = document.querySelectorAll(`.email-item[data-categories~="${mappedCategory}"]`).length;
            }
            const countElement = item.querySelector(".email-count");
            if (countElement) countElement.textContent = count;
        });
    } catch (err) {
        console.error("Errore in updateEmailCounts:", err);
    }
}

function attachNavListeners() {
    try {
        navItems.forEach(item => {
            item.removeEventListener("click", handleNavClick);
            item.addEventListener('click', handleNavClick);
        });
    } catch (err) {
        console.error("Errore in attachNavListeners:", err);
    }
}

function handleNavClick(event) {
    try {
        const category = event.currentTarget.getAttribute("data-category");
        filterEmails(category, searchInput.value.toLowerCase(), "category", "");
    } catch (err) {
        console.error("Errore cambio categoria:", err);
    }
}

function attachSidebarListeners() {
    try {
        sidebarItems.forEach(item => {
            item.addEventListener("click", () => {
                const category = item.getAttribute("data-category");
                filterEmails("inbox", searchInput.value.toLowerCase(), "category", category);
            });
        });
        sidebarContacts.forEach(item => {
            item.addEventListener("click", () => {
                const email = item.getAttribute("data-email");
                filterEmails("inbox", searchInput.value.toLowerCase(), "contact", email);
            });
        });
        sidebarFavorites.forEach(item => {
            item.addEventListener("click", () => {
                const emailId = item.getAttribute("data-email-id");
                filterEmails("inbox", searchInput.value.toLowerCase(), "favorite", emailId);
            });
        });
    } catch (err) {
        console.error("Errore in attachSidebarListeners:", err);
    }
}

function attachChatListeners() {
    try {
        chatSendBtn.addEventListener("click", () => {
            const message = chatInput.value.trim();
            if (message) {
                const messageElement = document.createElement("div");
                messageElement.className = "chat-message user";
                messageElement.textContent = message;
                chatMessages.appendChild(messageElement);
                chatInput.value = "";
                chatMessages.scrollTop = chatMessages.scrollHeight;
                setTimeout(() => {
                    const botResponse = document.createElement("div");
                    botResponse.className = "chat-message bot";
                    botResponse.textContent = "Grazie per il messaggio! Come posso aiutarti ulteriormente?";
                    chatMessages.appendChild(botResponse);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }, 500);
            }
        });
        chatClearBtn.addEventListener("click", () => {
            chatMessages.innerHTML = '<div class="chat-message bot">Ciao! Come posso aiutarti oggi?</div>';
            chatInput.value = "";
        });
        suggestionItems.forEach(item => {
            item.addEventListener("click", () => {
                chatInput.value = item.textContent;
                chatInput.focus();
            });
        });
    } catch (err) {
        console.error("Errore in attachChatListeners:", err);
    }
}

// Inizializzazione della pagina
document.addEventListener("DOMContentLoaded", async () => {
    try {
        toggleLoading(true);
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get("token");
        const error = urlParams.get("error");
        if (error) {
            let errorMessage = "Errore durante il login. Riprova.";
            if (error === "auth_required") {
                errorMessage = "Autenticazione richiesta. Effettua il login.";
            } else if (error === "auth_failed") {
                errorMessage = "Autenticazione fallita. Verifica le credenziali e riprova.";
            } else if (error === "init_failed") {
                errorMessage = "Errore di inizializzazione. Riprova più tardi.";
            }
            alert(errorMessage);
            window.location.href = "/";
            return;
        }
        if (token) {
            sessionStorage.setItem("gt", token);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        const storedToken = sessionStorage.getItem("gt");
        let user = {};
        try {
            user = JSON.parse(localStorage.getItem("user") || "{}");
        } catch (err) {
            user = {};
        }
        if (!storedToken) {
            alert("Sessione scaduta. Effettua nuovamente il login.");
            window.location.href = "/?error=auth_required";
            return;
        }
        if (!user.email) {
            const response = await fetch("/api/user", {
                headers: { Authorization: `Bearer ${storedToken}`, "Content-Type": "application/json" }
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Impossibile recuperare i dati utente");
            }
            user = await response.json();
            localStorage.setItem("user", JSON.stringify(user));
        }
        if (accountNameInput && accountEmailInput) {
            accountNameInput.value = user.name || "";
            accountEmailInput.value = user.email;
        } else {
            console.warn("Input elements #accountName or #accountEmail not found in DOM");
        }
        await loadEmailsToPage();
        await categorizeEmails();
        updateEmailCounts();
        showEmailCountCheckbox.checked = true;
        toggleEmailCountVisibility(true);
        filterEmails("inbox");
        await loadEvents();
        generateCalendar();
        if (localStorage.getItem("darkTheme") === "true") {
            darkThemeCheckbox.checked = true;
            document.body.classList.add("dark");
        }
        attachSidebarListeners();
        attachChatListeners();
        attachNavListeners();
        setInterval(async () => {
            try {
                await syncEmails();
                await loadEmailsToPage();
                await categorizeEmails();
                updateEmailCounts();
                filterEmails(currentCategory, searchInput.value.toLowerCase(), currentFilter.type, currentFilter.value);
            } catch (err) {
                console.error("Errore sincronizzazione automatica:", err);
            }
        }, 5 * 60 * 1000);
    } catch (err) {
        console.error("Errore inizializzazione:", err);
        alert("Errore inizializzazione: " + err.message);
    } finally {
        toggleLoading(false);
    }
});

// Gestione degli eventi dei pulsanti
emailLimitSelect.addEventListener("change", async () => {
    try {
        emailLimit = parseInt(emailLimitSelect.value);
        await loadEmailsToPage();
        await categorizeEmails();
        filterEmails(currentCategory, searchInput.value.toLowerCase(), currentFilter.type, currentFilter.value);
    } catch (err) {
        console.error("Errore cambio limite email:", err);
        alert("Errore cambio limite email: " + err.message);
    }
});

searchInput.addEventListener("input", () => {
    try {
        filterEmails(currentCategory, searchInput.value.toLowerCase(), currentFilter.type, currentFilter.value);
    } catch (err) {
        console.error("Errore ricerca:", err);
    }
});

[composeBtn, settingsBtn].forEach(btn => {
    btn.addEventListener("click", () => {
        try {
            toggleModal(btn === composeBtn ? composeModal : settingsModal, true);
        } catch (err) {
            console.error("Errore apertura modale:", err);
        }
    });
});

closeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        try {
            [composeModal, settingsModal, eventModal, emailPreviewModal].forEach(modal => {
                toggleModal(modal, false);
            });
        } catch (err) {
            console.error("Errore chiusura modale:", err);
        }
    });
});

saveBtn.addEventListener("click", () => {
    try {
        localStorage.setItem("darkTheme", darkThemeCheckbox.checked);
        toggleModal(settingsModal, false);
    } catch (err) {
        console.error("Errore salvataggio impostazioni:", err);
    }
});

logoutBtn.addEventListener("click", () => {
    try {
        sessionStorage.removeItem("gt");
        localStorage.removeItem("user");
        window.location.href = "/";
    } catch (err) {
        console.error("Errore logout:", err);
    }
});

saveAccountBtn.addEventListener("click", async () => {
    try {
        if (!accountNameInput || !accountEmailInput) {
            throw new Error("Input elements for account non trovati");
        }
        const name = accountNameInput.value.trim();
        const email = accountEmailInput.value.trim();
        if (!email) {
            alert("L'email è obbligatoria!");
            return;
        }
        const user = { name, email };
        localStorage.setItem("user", JSON.stringify(user));
        alert("Dati account aggiornati!");
        toggleModal(settingsModal, false);
    } catch (err) {
        console.error("Errore salvataggio account:", err);
        alert("Errore salvataggio account: " + err.message);
    }
});

addEventBtn.addEventListener("click", async () => {
    try {
        const title = eventTitleInput.value.trim();
        const date = eventDateInput.value;
        const time = eventTimeInput.value;
        if (!title || !date || !time) {
            alert("Compila tutti i campi!");
            return;
        }
        const response = await fetch("/api/events", {
            method: "POST",
            headers: { Authorization: `Bearer ${sessionStorage.getItem("gt")}`, "Content-Type": "application/json" },
            body: JSON.stringify({ title, date, time })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Errore salvataggio evento");
        }
        const newEvent = await response.json();
        events.push(newEvent);
        generateCalendar();
        toggleModal(eventModal, false);
        alert("Evento aggiunto!");
        eventTitleInput.value = "";
        eventDateInput.value = "";
        eventTimeInput.value = "";
    } catch (err) {
        console.error("Errore aggiunta evento:", err);
        alert("Errore aggiunta evento: " + err.message);
    }
});

darkThemeCheckbox.addEventListener("change", () => {
    try {
        document.body.classList.toggle("dark", darkThemeCheckbox.checked);
        localStorage.setItem("darkTheme", darkThemeCheckbox.checked);
    } catch (err) {
        console.error("Errore cambio tema:", err);
    }
});

showEmailCountCheckbox.addEventListener("change", () => {
    try {
        toggleEmailCountVisibility(showEmailCountCheckbox.checked);
    } catch (err) {
        console.error("Errore toggleEmailCountCheckbox:", err);
    }
});

[prevBtn, nextBtn].forEach(btn => {
    btn.addEventListener("click", () => {
        try {
            if (btn.classList.contains("prev")) {
                currentMonth--;
                if (currentMonth < 0) {
                    currentMonth = 11;
                    currentYear--;
                }
            } else {
                currentMonth++;
                if (currentMonth > 11) {
                    currentMonth = 0;
                    currentYear++;
                }
            }
            generateCalendar();
        } catch (err) {
            console.error("Errore cambio mese calendario:", err);
        }
    });
});

sendBtn.addEventListener("click", async () => {
    try {
        const to = composeInput.value.trim();
        const subject = composeSubject.value.trim();
        const body = composeText.value.trim();
        if (!to || !subject || !body) {
            alert("Compila tutti i campi!");
            return;
        }
        await sendEmail(to, subject, body);
        alert("Email inviata!");
        toggleModal(composeModal, false);
        composeInput.value = "";
        composeSubject.value = "";
        composeText.value = "";
        await loadEmailsToPage();
        filterEmails(currentCategory, searchInput.value.toLowerCase(), currentFilter.type, currentFilter.value);
    } catch (err) {
        console.error("Errore invio email:", err);
        alert("Errore invio email: " + err.message);
    }
});

deleteBtn.addEventListener("click", async () => {
    try {
        if (!currentEmail) {
            alert("Nessuna email selezionata!");
            return;
        }
        const emailId = currentEmail.getAttribute("data-id");
        await trashEmail(emailId);
        alert("Email spostata nel cestino!");
        toggleModal(emailPreviewModal, false);
        await loadEmailsToPage();
        filterEmails(currentCategory, searchInput.value.toLowerCase(), currentFilter.type, currentFilter.value);
    } catch (err) {
        console.error("Errore eliminazione email:", err);
        alert("Errore spostamento email nel cestino: " + err.message);
    }
});

replyBtn.addEventListener("click", () => {
    try {
        if (!currentEmail) {
            alert("Nessuna email selezionata!");
            return;
        }
        const to = currentEmail.getAttribute("data-sender");
        const subject = `Re: ${currentEmail.getAttribute("data-subject")}`;
        composeInput.value = to;
        composeSubject.value = subject;
        composeText.value = "";
        toggleModal(emailPreviewModal, false);
        toggleModal(composeModal, true);
    } catch (err) {
        console.error("Errore risposta email:", err);
        alert("Errore apertura risposta: " + err.message);
    }
});

aiReplyBtn.addEventListener("click", async () => {
    try {
        if (!currentEmail) {
            alert("Nessuna email selezionata!");
            return;
        }
        const emailId = currentEmail.getAttribute("data-id");
        const response = await fetch(`/api/emails/${emailId}/ai-reply`, {
            method: "POST",
            headers: { Authorization: `Bearer ${sessionStorage.getItem("gt")}`, "Content-Type": "application/json" }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Errore generazione risposta AI");
        }
        const aiReply = await response.json();
        composeInput.value = currentEmail.getAttribute("data-sender");
        composeSubject.value = `Re: ${currentEmail.getAttribute("data-subject")}`;
        composeText.value = aiReply.message || "Risposta generata dall'AI.";
        toggleModal(emailPreviewModal, false);
        toggleModal(composeModal, true);
    } catch (err) {
        console.error("Errore risposta AI:", err);
        alert("Errore generazione risposta AI: " + err.message);
    }
});

syncBtn.addEventListener("click", async () => {
    try {
        toggleLoading(true);
        await syncEmails();
        await loadEmailsToPage();
        await categorizeEmails();
        updateEmailCounts();
        filterEmails(currentCategory, searchInput.value.toLowerCase(), currentFilter.type, currentFilter.value);
        alert("Email sincronizzate!");
    } catch (err) {
        console.error("Errore sincronizzazione manuale:", err);
        alert("Errore sincronizzazione email: " + err.message);
    } finally {
        toggleLoading(false);
    }
});