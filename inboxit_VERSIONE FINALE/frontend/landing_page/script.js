const reviews = [
    { name: "Anna", role: "Marketing Lead", text: "Inboxit ha dimezzato il tempo che passo sulle email.", avatar: "img/avatar/anna.svg" },
    { name: "Marco", role: "CEO Startup", text: "Le risposte AI sono così naturali che i clienti pensano sia io!", avatar: "img/avatar/marco.svg" },
    { name: "Luca", role: "Sales Manager", text: "Inboxit ha reso le mie email di vendita un gioco da ragazzi.", avatar: "img/avatar/luca.svg" },
    { name: "Giulia", role: "Freelancer", text: "Finalmente una casella organizzata senza stress.", avatar: "img/avatar/giulia.svg" },
    { name: "Sofia", role: "Customer Support Lead", text: "Risposte rapide e sempre azzeccate.", avatar: "img/avatar/sofia.svg" },
    { name: "Davide", role: "Imprenditore", text: "Non credevo che un’AI potesse gestire le mie email così bene.", avatar: "img/avatar/davide.svg" },
    { name: "Elena", role: "Project Manager", text: "Inboxit tiene tutto in ordine.", avatar: "img/avatar/elena.svg" },
    { name: "Matteo", role: "Avvocato", text: "Risposte rapide e professionali.", avatar: "img/avatar/matteo.svg" },
    { name: "Chiara", role: "E-commerce Owner", text: "Le email dei clienti ora sono gestite in automatico.", avatar: "img/avatar/chiara.svg" },
    { name: "Alessandro", role: "Consulente", text: "Più tempo per i miei progetti grazie a Inboxit.", avatar: "img/avatar/alessandro.svg" }
];

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const offset = document.querySelector('.navbar').offsetHeight;
            window.scrollTo({
                top: target.offsetTop - offset,
                behavior: 'smooth'
            });
        }
    });
});

window.addEventListener('load', () => {
    window.scrollTo(0, 0);
    const hash = window.location.hash;
    if (hash) {
        const target = document.querySelector(hash);
        if (target) {
            const offset = document.querySelector('.navbar').offsetHeight;
            window.scrollTo({
                top: target.offsetTop - offset,
                behavior: 'smooth'
            });
        }
    }
    const stickyButton = document.querySelector('.adaptive-button');
    if (stickyButton) {
        stickyButton.classList.add('black');
    }
});

const animateElements = document.querySelectorAll('.animate-glide, .animate-fade, .animate-stagger');
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1 });
animateElements.forEach(el => observer.observe(el));

function openModal(id) {
    const modal = document.getElementById(`${id}-modal`);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    } else {
        console.error(`Modal with ID ${id}-modal not found`);
    }
}

function closeModal(id) {
    const modal = document.getElementById(`${id}-modal`);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    } else {
        console.error(`Modal with ID ${id}-modal not found`);
    }
}

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
});

document.querySelectorAll('.footer-links a, .badge, .close').forEach(item => {
    item.addEventListener('click', (e) => {
        const modalId = item.getAttribute('data-modal');
        if (modalId) {
            e.preventDefault();
            if (item.classList.contains('close')) {
                closeModal(modalId);
            } else {
                openModal(modalId);
            }
        }
    });
});

const carousel = document.querySelector('.story-carousel');
const totalStories = reviews.length;
let storyWidth;

if (carousel) {
    reviews.forEach(review => {
        const story = document.createElement('div');
        story.className = 'story animate-fade';
        story.innerHTML = `
            <img src="${review.avatar}" alt="${review.name}, ${review.role}" class="avatar" loading="lazy">
            <p><strong>${review.name}, ${review.role}</strong></p>
            <blockquote>“${review.text}”</blockquote>
        `;
        carousel.appendChild(story);
    });
    reviews.forEach(review => {
        const story = document.createElement('div');
        story.className = 'story animate-fade';
        story.innerHTML = `
            <img src="${review.avatar}" alt="${review.name}, ${review.role}" class="avatar" loading="lazy">
            <p><strong>${review.name}, ${review.role}</strong></p>
            <blockquote>“${review.text}”</blockquote>
        `;
        carousel.appendChild(story);
    });
    const firstStory = document.querySelector('.story');
    storyWidth = firstStory ? firstStory.offsetWidth + 24 : 274;
}

let carouselIndex = 0;
function moveCarousel(direction) {
    if (!carousel || !storyWidth) return;
    carouselIndex += direction;
    if (carouselIndex >= totalStories) {
        carouselIndex = 0;
        carousel.style.transition = 'none';
        carousel.scrollLeft = 0;
        setTimeout(() => {
            carousel.style.transition = 'scroll-left 0.5s ease';
        }, 50);
    } else if (carouselIndex < 0) {
        carouselIndex = totalStories - 1;
        carousel.style.transition = 'none';
        carousel.scrollLeft = carouselIndex * storyWidth;
        setTimeout(() => {
            carousel.style.transition = 'scroll-left 0.5s ease';
        }, 50);
    } else {
        carousel.style.transition = 'scroll-left 0.5s ease';
        carousel.scrollLeft = carouselIndex * storyWidth;
    }
}

const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('nav');

if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
        menuToggle.classList.toggle('active');
        nav.classList.toggle('active');
    });
}

const stickyButton = document.querySelector('.adaptive-button');
if (stickyButton) {
    const debounce = (func, wait) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    };
    window.addEventListener('scroll', debounce(() => {
        const sections = document.querySelectorAll('section, footer');
        let currentSection = null;
        sections.forEach(section => {
            const rect = section.getBoundingClientRect();
            if (rect.top <= window.innerHeight / 2 && rect.bottom >= window.innerHeight / 2) {
                currentSection = section;
            }
        });
        if (currentSection) {
            const bgStyle = window.getComputedStyle(currentSection).background;
            const bgColor = window.getComputedStyle(currentSection).backgroundColor;
            if (bgColor === 'rgb(255, 255, 255)' || bgStyle.includes('var(--bg-light)')) {
                stickyButton.classList.remove('white');
                stickyButton.classList.add('black');
            } else if (bgColor === 'rgb(0, 0, 0)' || bgStyle.includes('var(--bg-dark)') || bgStyle.includes('linear-gradient')) {
                stickyButton.classList.remove('black');
                stickyButton.classList.add('white');
            } else {
                stickyButton.classList.remove('white');
                stickyButton.classList.add('black');
            }
        }
    }, 10));
}

const tabs = document.querySelectorAll('.tab');
const forms = document.querySelectorAll('.contact-form');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        forms.forEach(f => f.classList.remove('active'));
        tab.classList.add('active');
        document.querySelector(`.${tab.dataset.tab}-form`).classList.add('active');
    });
});

const urlParams = new URLSearchParams(window.location.search);
const selectedPlan = urlParams.get('plan');
if (selectedPlan) {
    const planSelect = document.querySelector('select[name="plan"]');
    if (planSelect) {
        planSelect.value = selectedPlan;
    }
    const activationTab = document.querySelector('.tab[data-tab="activation"]');
    const feedbackForm = document.querySelector('.feedback-form');
    const activationForm = document.querySelector('.activation-form');
    if (activationTab && feedbackForm && activationForm) {
        tabs.forEach(t => t.classList.remove('active'));
        forms.forEach(f => f.classList.remove('active'));
        activationTab.classList.add('active');
        activationForm.classList.add('active');
    }
}