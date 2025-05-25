// script.js
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

let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();
let currentCategory = "inbox";
let events = [];
let currentEmail = null;
let emailLimit = null;

document.addEventListener("DOMContentLoaded", async () => {
    try {
        toggleLoading(true);
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get("token");
        const error = urlParams.get("error");
        if (error) {
            let errorMessage = "Errore durante il login. Riprova.";
            if (error === "auth_required") errorMessage = "Autenticazione richiesta. Effettua il login.";
            else if (error === "auth_failed") errorMessage = "Autenticazione fallita. Verifica le credenziali e riprova.";
            else if (error === "init_failed") errorMessage = "Errore di inizializzazione. Riprova più tardi.";
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
        accountNameInput.value = user.name || "";
        accountEmailInput.value = user.email;
        await loadEmailsToPage();
        await categorizeEmails();
        if (!document.querySelectorAll(".email-item").length) {
            syncBtn.disabled = true;
            syncBtn.innerHTML = '<i class="fas fa-sync fa-spin"></i>';
            try {
                await syncEmails();
                await loadEmailsToPage();
                await categorizeEmails();
            } finally {
                syncBtn.disabled = false;
                syncBtn.innerHTML = '<i class="fas fa-sync"></i>';
            }
        }
        updateEmailCounts();
        showEmailCountCheckbox.checked = true;
        toggleEmailCountVisibility(true);
        filterEmails("inbox");
        await loadEvents();
        generateCalendar(currentMonth, currentYear);
        if (localStorage.getItem("darkTheme") === "true") {
            darkThemeCheckbox.checked = true;
            document.body.classList.add("dark");
        }
        setInterval(async () => {
            await syncEmails();
            await loadEmailsToPage();
            await categorizeEmails();
            updateEmailCounts();
            filterEmails(currentCategory, searchInput.value.toLowerCase());
        }, 5 * 60 * 1000);
    } catch (err) {
        alert("Errore inizializzazione: " + err.message);
    } finally {
        toggleLoading(false);
    }
});

function toggleLoading(show) {
    if (loadingOverlay) loadingOverlay.style.display = show ? "flex" : "none";
}

async function loadEmailsToPage() {
    const query = emailLimit === null ? "" : `?limit=${emailLimit}`;
    const response = await fetch(`/api/emails${query}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem("gt")}`, "Content-Type": "application/json" }
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Errore caricamento email");
    }
    const emails = await response.json();
    renderEmails(emails);
    attachEmailListeners();
}

async function categorizeEmails() {
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
}

async function getProfilePicture(emailAddress) {
    try {
        const response = await fetch(`/api/user/profile-picture?email=${encodeURIComponent(emailAddress)}`, {
            headers: { Authorization: `Bearer ${sessionStorage.getItem("gt")}`, "Content-Type": "application/json" }
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.photoUrl || null;
    } catch (err) {
        console.error("Errore recupero foto profilo:", err);
        return null;
    }
}

async function renderEmails(emails) {
    const emailList = document.querySelector('.email-list-container');
    emailList.innerHTML = '';
    for (const email of emails) {
        const label = email.categories[0] || 'Posta in arrivo';
        const bgColor = email.backgroundColor || '#ddd';
        const textColor = email.textColor || '#000';
        const profilePicture = await getProfilePicture(email.from);
        const emailElement = document.createElement('div');
        emailElement.className = 'email-item';
        emailElement.dataset.id = email.id;
        emailElement.dataset.categories = email.categories.join(" ");
        emailElement.dataset.sender = email.from;
        emailElement.dataset.subject = email.subject || "(senza oggetto)";
        emailElement.dataset.body = email.body || "";
        emailElement.dataset.time = email.date;
        emailElement.dataset.labels = JSON.stringify(email.gmailLabelIds || []);
        emailElement.dataset.userEmail = email.userEmail || "";
        emailElement.dataset.attachments = JSON.stringify(email.attachments || []);
        emailElement.innerHTML = `
            <div class="email-label" style="background-color: ${bgColor}; color: ${textColor};">${label}</div>
            <div class="email-profile">
                <img src="${profilePicture || '/img/default-avatar.png'}" alt="Avatar" class="profile-picture">
            </div>
            <div class="email-sender">${email.from}</div>
            <div class="email-subject">${email.subject || "(senza oggetto)"}</div>
            <div class="email-preview">${sanitizeHtml(email.body.substring(0, 150))}...</div>
            <div class="email-time">${new Date(email.date).toLocaleString()}</div>
            ${email.attachments && email.attachments.length ? '<div class="email-attachments"><i class="fas fa-paperclip"></i></div>' : '<div class="email-attachments"></div>'}
        `;
        emailList.appendChild(emailElement);
    }
}

function filterEmails(category, searchTerm = "") {
    currentCategory = category;
    navItems.forEach(item => {
        item.classList.toggle("active", item.getAttribute("data-category") === category);
    });
    emailListContainer.style.display = category === "calendar" ? "none" : "block";
    calendarSection.style.display = category === "calendar" ? "block" : "none";
    if (category !== "calendar") {
        document.querySelectorAll(".email-item").forEach(item => {
            const categories = item.getAttribute("data-categories").split(" ").filter(c => c);
            const categoryMap = {
                inbox: 'Posta in arrivo',
                sent: 'Inviate',
                important: 'Importanti',
                meetings: 'Riunioni',
                calendar: 'Calendario',
                spam: 'Spam',
                trash: 'Cestino',
                promotions: 'Promozioni',
                toreply: 'Da rispondere'
            };
            const mappedCategory = categoryMap[category] || category;
            const matchesCategory = category === "inbox" || categories.includes(mappedCategory);
            const matchesSearch = !searchTerm ||
                item.getAttribute("data-sender").toLowerCase().includes(searchTerm) ||
                item.getAttribute("data-subject").toLowerCase().includes(searchTerm) ||
                item.getAttribute("data-body").toLowerCase().includes(searchTerm);
            item.style.display = matchesCategory && matchesSearch ? "grid" : "none";
        });
    }
    updateEmailCounts();
}

async function loadEvents() {
    const response = await fetch("/api/events", {
        headers: { Authorization: `Bearer ${sessionStorage.getItem("gt")}`, "Content-Type": "application/json" }
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Errore caricamento eventi");
    }
    events = await response.json();
}

function generateCalendar(month, year) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay();
    const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
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
        const emptyDay = document.createElement("div");
        emptyDay.className = "calendar-date empty";
        calendarGrid.appendChild(emptyDay);
    }
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        const isToday = date.toDateString() === new Date().toDateString();
        const hasEvent = events.some(event => new Date(event.date).toDateString() === date.toDateString());
        const day = document.createElement("div");
        day.className = `calendar-date ${isToday ? "today" : ""} ${hasEvent ? "event" : ""}`;
        day.textContent = i;
        day.addEventListener("click", () => {
            eventDateInput.value = date.toISOString().split("T")[0];
            toggleModal(eventModal, true);
        });
        calendarGrid.appendChild(day);
    }
    eventsList.innerHTML = "<h3>Eventi</h3>";
    events.forEach(event => {
        const eventItem = document.createElement("div");
        eventItem.className = "event-item";
        eventItem.setAttribute("data-id", event._id);
        eventItem.innerHTML = `
            <span>${event.title} - ${new Date(event.date).toLocaleDateString("it-IT")} ${event.time}</span>
            <button class="delete-event-btn"><i class="fas fa-trash"></i> Elimina</button>
        `;
        eventsList.appendChild(eventItem);
        eventItem.querySelector(".delete-event-btn").addEventListener("click", async () => {
            const response = await fetch(`/api/events/${event._id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${sessionStorage.getItem("gt")}`, "Content-Type": "application/json" }
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Errore eliminazione evento");
            }
            events = events.filter(e => e._id !== event._id);
            generateCalendar(currentMonth, currentYear);
            alert("Evento eliminato!");
        });
    });
}

function toggleModal(modal, show) {
    if (modal) {
        modal.classList.toggle("active", show);
        overlay.classList.toggle("active", show);
    }
}

async function syncEmails() {
    const response = await fetch("/api/emails/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionStorage.getItem("gt")}`, "Content-Type": "application/json" }
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Errore sincronizzazione email");
    }
    return await response.json();
}

async function sendEmail(to, subject, body) {
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
}

async function trashEmail(emailId) {
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
}

async function attachEmailListeners() {
    document.querySelectorAll(".email-item").forEach(item => {
        item.addEventListener("click", async () => {
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
            const sanitizedMainContent = window.sanitizeHtml(mainContent, {
                allowedTags: ["p", "br", "strong", "em", "a", "ul", "li", "div"],
                allowedAttributes: { a: ["href", "target", "rel"] },
                transformTags: { a: (tagName, attribs) => ({ tagName: "a", attribs: { href: attribs.href || "#", target: "_blank", rel: "noopener noreferrer" } }) }
            });
            const sanitizedFooterContent = window.sanitizeHtml(footerContent, {
                allowedTags: ["p", "a"],
                allowedAttributes: { a: ["href", "target", "rel"] },
                transformTags: { a: (tagName, attribs) => ({ tagName: "a", attribs: { href: attribs.href || "#", target: "_blank", rel: "noopener noreferrer" } }) }
            });
            let attachmentsHtml = '';
            if (attachments.length > 0) {
                attachmentsHtml = '<div class="email-attachments">';
                for (const attachment of attachments) {
                    const isImage = attachment.mimeType.startsWith('image/');
                    const extension = attachment.filename.split('.').pop().toLowerCase();
                    const iconPath = extension === 'figma' ? `/img/extensions/figma.png` : `/img/extensions/${extension}.svg`;
                    const attachmentUrl = `/api/emails/${item.getAttribute("data-id")}/attachments/${attachment.attachmentId}`;
                    try {
                        // Verifica preventiva dell'accessibilità dell'allegato
                        const response = await fetch(attachmentUrl, {
                            method: 'HEAD',
                            headers: { Authorization: `Bearer ${sessionStorage.getItem("gt")}` }
                        });
                        if (!response.ok) {
                            console.error(`Allegato non disponibile: ${attachment.filename}`);
                            attachmentsHtml += `
                                <div class="attachment-item">
                                    <img src="${iconPath}" alt="${extension} icon" class="attachment-icon" onerror="this.src='/img/extensions/default.svg'">
                                    <span>${attachment.filename} (Non disponibile)</span>
                                </div>
                            `;
                            continue;
                        }
                    } catch (err) {
                        console.error(`Errore verifica allegato ${attachment.filename}:`, err);
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
                            ${isImage ? `<img src="${attachmentUrl}" alt="${attachment.filename}" class="attachment-preview">` : ''}
                            <div class="attachment-info">
                                <img src="${iconPath}" alt="${extension} icon" class="attachment-icon" onerror="this.src='/img/extensions/default.svg'">
                                <a href="${attachmentUrl}" download="${attachment.filename}">
                                    ${attachment.filename} (${(attachment.size / 1024).toFixed(2)} KB)
                                </a>
                                ${isImage ? `<button class="view-attachment-btn" data-attachment-url="${attachmentUrl}">Visualizza</button>` : ''}
                            </div>
                        </div>
                    `;
                }
                attachmentsHtml += '</div>';
            }
            previewSender.textContent = sender;
            previewSubject.textContent = subject;
            previewTime.textContent = new Date(time).toLocaleString();
            previewBody.innerHTML = `
                <div class="email-content">${sanitizedMainContent || "<p>(Nessun contenuto)</p>"}</div>
                ${sanitizedFooterContent ? `<div class="email-footer">${sanitizedFooterContent}</div>` : ""}
                ${attachmentsHtml}
            `;
            toggleModal(emailPreviewModal, true);

            // Aggiungi listener per i pulsanti di visualizzazione degli allegati
            document.querySelectorAll('.view-attachment-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const attachmentUrl = btn.getAttribute('data-attachment-url');
                    try {
                        window.open(attachmentUrl, '_blank');
                    } catch (err) {
                        console.error('Errore apertura allegato:', err);
                        alert('Impossibile aprire l\'allegato. Riprova o contatta il supporto.');
                    }
                });
            });
        });
    });
}

function toggleEmailCountVisibility(show) {
    emailCounts.forEach(count => {
        count.style.display = show ? "inline-block" : "none";
    });
}

function updateEmailCounts() {
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
                calendar: 'Calendario',
                spam: 'Spam',
                trash: 'Cestino',
                promotions: 'Promozioni',
                toreply: 'Da rispondere'
            };
            count = document.querySelectorAll(`.email-item[data-categories~="${categoryMap[category]}"]`).length;
        }
        const countElement = item.querySelector(".email-count");
        if (countElement) countElement.textContent = count;
    });
}

emailLimitSelect.addEventListener("change", async () => {
    emailLimit = emailLimitSelect.value === "all" ? null : parseInt(emailLimitSelect.value);
    await loadEmailsToPage();
    await categorizeEmails();
    filterEmails(currentCategory, searchInput.value.toLowerCase());
});

searchInput.addEventListener("input", () => {
    filterEmails(currentCategory, searchInput.value.toLowerCase());
});

navItems.forEach(item => {
    item.addEventListener("click", () => {
        const category = item.getAttribute("data-category");
        filterEmails(category, searchInput.value.toLowerCase());
    });
});

[composeBtn, settingsBtn].forEach(btn => {
    btn.addEventListener("click", () => toggleModal(btn === composeBtn ? composeModal : settingsModal, true));
});

closeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        [composeModal, settingsModal, eventModal, emailPreviewModal].forEach(modal => toggleModal(modal, false));
    });
});

saveBtn.addEventListener("click", () => {
    localStorage.setItem("darkTheme", darkThemeCheckbox.checked);
    toggleModal(settingsModal, false);
});

logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem("gt");
    localStorage.removeItem("user");
    window.location.href = "/";
});

saveAccountBtn.addEventListener("click", () => {
    if (!accountNameInput.value || !accountEmailInput.value) {
        alert("Compila tutti i campi account!");
        return;
    }
    localStorage.setItem("user", JSON.stringify({
        name: accountNameInput.value,
        email: accountEmailInput.value
    }));
    toggleModal(settingsModal, false);
    alert("Modifiche account salvate!");
});

addEventBtn.addEventListener("click", async () => {
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
    generateCalendar(currentMonth, currentYear);
    toggleModal(eventModal, false);
    alert("Evento aggiunto!");
    eventTitleInput.value = "";
    eventDateInput.value = "";
    eventTimeInput.value = "";
});

darkThemeCheckbox.addEventListener("change", () => {
    document.body.classList.toggle("dark", darkThemeCheckbox.checked);
    localStorage.setItem("darkTheme", darkThemeCheckbox.checked);
});

showEmailCountCheckbox.addEventListener("change", () => {
    toggleEmailCountVisibility(showEmailCountCheckbox.checked);
});

syncBtn.addEventListener("click", async () => {
    syncBtn.disabled = true;
    syncBtn.innerHTML = '<i class="fas fa-sync fa-spin"></i>';
    try {
        await syncEmails();
        await loadEmailsToPage();
        await categorizeEmails();
        updateEmailCounts();
        filterEmails(currentCategory, searchInput.value.toLowerCase());
        alert("Email sincronizzate!");
    } catch (err) {
        alert("Errore sincronizzazione: " + err.message);
    } finally {
        syncBtn.disabled = false;
        syncBtn.innerHTML = '<i class="fas fa-sync"></i>';
    }
});

sendBtn.addEventListener("click", async () => {
    const to = composeInput.value.trim();
    const subject = composeSubject.value.trim();
    const body = composeText.value.trim();
    if (!to || !subject || !body) {
        alert("Compila tutti i campi!");
        return;
    }
    await sendEmail(to, subject, body);
    toggleModal(composeModal, false);
    alert("Email inviata!");
    composeInput.value = "";
    composeSubject.value = "";
    composeText.value = "";
    await syncEmails();
    await loadEmailsToPage();
    await categorizeEmails();
});

deleteBtn.addEventListener("click", async () => {
    if (currentEmail) {
        const emailId = currentEmail.getAttribute("data-id");
        await trashEmail(emailId);
        currentEmail.setAttribute("data-categories", "Cestino");
        updateEmailCounts();
        filterEmails(currentCategory, searchInput.value.toLowerCase());
        toggleModal(emailPreviewModal, false);
        alert("Email spostata nel cestino!");
    }
});

replyBtn.addEventListener("click", () => {
    if (currentEmail) {
        composeInput.value = currentEmail.getAttribute("data-sender");
        composeSubject.value = `Re: ${currentEmail.getAttribute("data-subject")}`;
        composeText.value = "";
        toggleModal(emailPreviewModal, false);
        toggleModal(composeModal, true);
    }
});

aiReplyBtn.addEventListener("click", async () => {
    if (!currentEmail) return alert("Nessun email selezionata");
    const body = currentEmail.getAttribute("data-body");
    if (!body) return alert("Nessun contenuto disponibile");
    aiReplyBtn.textContent = "AI in corso...";
    aiReplyBtn.disabled = true;
    try {
        const response = await fetch("/api/ai/gemini-reply", {
            method: "POST",
            headers: { Authorization: `Bearer ${sessionStorage.getItem("gt")}`, "Content-Type": "application/json" },
            body: JSON.stringify({ email: { id: currentEmail.getAttribute("data-id"), subject: currentEmail.getAttribute("data-subject"), body } })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Errore generazione risposta AI");
        toggleModal(composeModal, true);
        composeText.value = data.reply;
        composeInput.value = currentEmail.getAttribute("data-sender");
        composeSubject.value = `Re: ${currentEmail.getAttribute("data-subject")}`;
        toggleModal(emailPreviewModal, false);
    } catch (err) {
        alert(`Errore generazione risposta AI: ${err.message}`);
    } finally {
        aiReplyBtn.textContent = "Rispondi con AI";
        aiReplyBtn.disabled = false;
    }
});

prevBtn.addEventListener("click", () => {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    generateCalendar(currentMonth, currentYear);
});

nextBtn.addEventListener("click", () => {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    generateCalendar(currentMonth, currentYear);
});