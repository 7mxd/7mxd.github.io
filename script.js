/**
 * Data loading and rendering functions
 */

// SVG icons used in the site
const ICONS = {
    email: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M0 3v18h24v-18h-24zm21.518 2l-9.518 7.713-9.518-7.713h19.036zm-19.518 14v-11.817l10 8.104 10-8.104v11.817h-20z"/>
    </svg>`,
    phone: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 22.621l-3.521-6.795c-.008.004-1.974.97-2.064 1.011-2.24 1.086-6.799-7.82-4.609-8.994l2.083-1.026-3.493-6.817-2.106 1.039c-7.202 3.755 4.233 25.982 11.6 22.615.121-.055 2.102-1.029 2.11-1.033z"/>
    </svg>`,
    location: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-4.198 0-8 3.403-8 7.602 0 4.198 3.469 9.21 8 16.398 4.531-7.188 8-12.2 8-16.398 0-4.199-3.801-7.602-8-7.602zm0 11c-1.657 0-3-1.343-3-3s1.343-3 3-3 3 1.343 3 3-1.343 3-3 3z"/>
    </svg>`,
    linkedin: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
    </svg>`
};

// Cache for loaded data
let siteData = {};

/**
 * Fetch JSON data from a file
 */
async function fetchData(filename) {
    try {
        const response = await fetch(`data/${filename}`);
        if (!response.ok) throw new Error(`Failed to load ${filename}`);
        return await response.json();
    } catch (error) {
        console.error(`Error loading ${filename}:`, error);
        return null;
    }
}

/**
 * Load all site data
 */
async function loadAllData() {
    const [profile, summary, education, experience, skills, settings] = await Promise.all([
        fetchData('profile.json'),
        fetchData('summary.json'),
        fetchData('education.json'),
        fetchData('experience.json'),
        fetchData('skills.json'),
        fetchData('settings.json')
    ]);

    siteData = { profile, summary, education, experience, skills, settings };
    return siteData;
}

/**
 * Render the header/profile section
 */
function renderProfile(profile) {
    const container = document.getElementById('header-section');
    if (!container || !profile) return;

    container.innerHTML = `
        <img src="${profile.photo}" alt="${profile.name}, ${profile.title}" class="profile-picture" loading="lazy">
        <h1>${profile.name}</h1>
        <h2 class="subtitle">${profile.title}</h2>
        <div class="contact-info">
            <a href="mailto:${profile.contact.email}" class="contact-item">
                ${ICONS.email}
                ${profile.contact.email}
            </a>
            <a href="tel:${profile.contact.phone.replace(/\s/g, '')}" class="contact-item">
                ${ICONS.phone}
                ${profile.contact.phone}
            </a>
            <span class="contact-item">
                ${ICONS.location}
                ${profile.contact.location}
            </span>
            <a href="${profile.contact.linkedin.url}" target="_blank" rel="noopener" class="contact-item">
                ${ICONS.linkedin}
                ${profile.contact.linkedin.label}
            </a>
        </div>
    `;
}

/**
 * Render the summary section
 */
function renderSummary(summary) {
    const container = document.getElementById('summary-content');
    if (!container || !summary) return;

    container.textContent = summary.content;
}

/**
 * Render the education section
 */
function renderEducation(education) {
    const container = document.getElementById('education-grid');
    if (!container || !education) return;

    container.innerHTML = education.items.map(item => `
        <div class="education-card">
            <div class="education-content">
                <div class="institution-header">
                    <img src="${item.logo}" alt="${item.institution}" class="institution-logo">
                    <div class="institution">${item.institution}</div>
                </div>
                <h3>${item.degree}</h3>
                <div class="education-details">
                    <span class="experience-date" data-start="${item.startDate}" data-end="${item.endDate}">${item.displayDate}</span>
                    <span class="grade">${item.grade}</span>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Render the experience section
 */
function renderExperience(experience) {
    const container = document.getElementById('experience-container');
    if (!container || !experience) return;

    container.innerHTML = experience.items.map(company => {
        const logoHasThemes = company.logo.light && company.logo.dark;
        const logoAttrs = logoHasThemes
            ? `src="${company.logo.default}" data-light-src="${company.logo.light}" data-dark-src="${company.logo.dark}"`
            : `src="${company.logo.default}"`;

        const rolesHtml = company.roles.map(role => `
            <div class="role-item">
                <div class="role-content">
                    <h4>${role.title}</h4>
                    <span class="experience-date" data-start="${role.startDate}" data-end="${role.endDate}">${role.displayDate}</span>
                    <ul class="role-description">
                        ${role.responsibilities.map(r => `<li>${r}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `).join('');

        return `
            <div class="company-block">
                <div class="company-header">
                    <div class="company-info">
                        <img ${logoAttrs} alt="${company.company}" class="company-logo">
                        <h3>${company.company}</h3>
                    </div>
                    <span class="company-location">${company.location}</span>
                </div>
                <div class="role-timeline">
                    ${rolesHtml}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Render the skills section
 */
function renderSkills(skills) {
    const container = document.getElementById('skills-grid');
    if (!container || !skills) return;

    const delays = [0.2, 0.4, 0.6, 0.8];

    container.innerHTML = skills.categories.map((category, index) => {
        let contentHtml = '';

        if (category.type === 'list') {
            contentHtml = `
                <ul class="skill-list">
                    ${category.items.map(item => `<li>${item}</li>`).join('')}
                </ul>
            `;
        } else if (category.type === 'tags') {
            contentHtml = `
                <div class="skill-item-container">
                    ${category.items.map(item => `<span class="skill-item">${item}</span>`).join('')}
                </div>
            `;
        } else if (category.type === 'proficiency') {
            contentHtml = category.items.map(item => `
                <div class="language-item">
                    <span class="language-name">${item.name}</span>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${item.level}%;" data-percent="${item.level}%"></div>
                    </div>
                    <span class="proficiency-level">${item.label}</span>
                </div>
            `).join('');
        }

        return `
            <div class="skill-card" data-delay="${delays[index] || 0.2}">
                <div class="skill-card-header">
                    <h3>${category.name}</h3>
                </div>
                <div class="skill-card-content">
                    ${contentHtml}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Update CV download links from settings
 */
function updateCVLinks(settings) {
    if (!settings || !settings.cv) return;

    const downloadButtons = document.querySelectorAll('.download-button');
    downloadButtons.forEach(btn => {
        btn.href = settings.cv.path;
        btn.download = settings.cv.downloadName;
    });
}

/**
 * Handles CV download with error handling
 */
function setupDownloadButton() {
    const downloadBtns = document.querySelectorAll('.download-button');
    if (!downloadBtns.length) return;

    downloadBtns.forEach(downloadBtn => {
        downloadBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const cvPath = siteData.settings?.cv?.path || 'assets/CV_2025_Ahmed_Radhi_Applied_Mathematics_and_Statistics.pdf';
            const downloadName = siteData.settings?.cv?.downloadName || 'Ahmed_Radhi_CV.pdf';

            try {
                const response = await fetch(cvPath);
                if (!response.ok) throw new Error('CV file not found');

                const link = document.createElement('a');
                link.href = cvPath;
                link.download = downloadName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (error) {
                console.error('Download failed:', error);
                alert('Sorry, the CV could not be downloaded at this time.');
            }
        });
    });
}

/**
 * Manages theme toggling with state persistence
 */
function updateLogosForTheme(theme) {
    const logos = document.querySelectorAll('.company-logo[data-light-src][data-dark-src]');
    logos.forEach(logo => {
        logo.src = theme === 'dark' ?
            logo.getAttribute('data-dark-src') :
            logo.getAttribute('data-light-src');
    });
}

function setupThemeToggle() {
    const themeToggles = document.querySelectorAll('.theme-toggle');
    if (!themeToggles.length) return;

    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

    const themeState = {
        current: localStorage.getItem('theme') ||
                (prefersDarkScheme.matches ? 'dark' : 'light'),

        setTheme(theme) {
            this.current = theme;
            document.body.classList.toggle('dark-mode', theme === 'dark');
            localStorage.setItem('theme', theme);
            updateLogosForTheme(theme);
        },

        toggle() {
            this.setTheme(this.current === 'dark' ? 'light' : 'dark');
        }
    };

    themeState.setTheme(themeState.current);

    themeToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            themeState.toggle();
            const navLinks = document.querySelector('.nav-links');
            const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
            if (navLinks && navLinks.classList.contains('active') && mobileMenuToggle) {
                mobileMenuToggle.click();
            }
        });
    });

    prefersDarkScheme.addEventListener('change', e => {
        if (!localStorage.getItem('theme')) {
            themeState.setTheme(e.matches ? 'dark' : 'light');
        }
    });

    // Return themeState so we can apply theme after content loads
    return themeState;
}

// Debounce function for scroll/resize events
function debounce(func, wait = 100) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Setup scroll progress bar
 */
function setupScrollProgress() {
    const progressBar = document.querySelector('.scroll-progress');
    if (!progressBar) return;

    const updateProgress = () => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
        progressBar.style.width = `${progress}%`;
    };

    updateProgress();
    let ticking = false;
    const onScroll = () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                updateProgress();
                ticking = false;
            });
            ticking = true;
        }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateProgress);
}

/**
 * Setup animations for dynamically loaded content
 */
function setupAnimations() {
    const roleItems = document.querySelectorAll('.role-item');
    if (roleItems.length) {
        roleItems.forEach((item, index) => {
            item.classList.add('animate');
            item.style.animationDelay = `${index * 0.2}s`;

            const listItems = item.querySelectorAll('.role-description li');
            listItems.forEach((li, i) => {
                li.style.animationDelay = `${(index * 0.2) + ((i + 1) * 0.1)}s`;
            });
        });
    }

    try {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.animationPlayState = 'running';
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.company-block, .section').forEach(block => {
            observer.observe(block);
        });
    } catch (error) {
        console.error('Intersection Observer failed:', error);
    }
}

/**
 * Calculate and display experience duration
 */
function setupExperienceDurations() {
    document.querySelectorAll('.experience-date').forEach(dateSpan => {
        const startStr = dateSpan.getAttribute('data-start');
        const endStr = dateSpan.getAttribute('data-end');

        if (!startStr || !endStr) return;

        const startParts = startStr.includes('-') ? startStr.split('-') : [startStr, '01'];
        const startDate = new Date(startParts[0], startParts[1] - 1);

        let endDate;
        if (endStr === 'Present') {
            endDate = new Date();
        } else if (endStr.includes('-')) {
            const [year, month] = endStr.split('-');
            endDate = new Date(year, month - 1);
        } else {
            endDate = new Date(endStr, 0);
        }

        const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                      (endDate.getMonth() - startDate.getMonth());

        const duration = months < 12 ?
            `${months} months` :
            `${Math.floor(months/12)} year${Math.floor(months/12) !== 1 ? 's' : ''}${months%12 ? ` ${months%12} months` : ''}`;

        dateSpan.setAttribute('title', `Duration: ${duration}`);
    });
}

/**
 * Initialize skill cards and handle animations
 */
function initializeSkillCards() {
    const skillCards = document.querySelectorAll('.skill-card');

    skillCards.forEach(card => {
        const delay = parseFloat(card.getAttribute('data-delay')) || 0;
        setTimeout(() => {
            card.style.animation = `fadeInUp 0.6s ease forwards`;
        }, delay * 1000);
    });

    const progressBars = document.querySelectorAll('.progress-bar');
    const progressObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const bar = entry.target;
                const percent = bar.getAttribute('data-percent');
                bar.style.width = '0%';
                setTimeout(() => {
                    bar.style.width = percent;
                }, 300);
            }
        });
    }, { threshold: 0.5 });

    progressBars.forEach(bar => {
        bar.style.width = '0%';
        progressObserver.observe(bar);
    });
}

/**
 * Setup mobile navigation
 */
function setupMobileNavigation() {
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const body = document.body;

    const backdrop = document.createElement('div');
    backdrop.className = 'nav-backdrop';
    document.body.appendChild(backdrop);

    function toggleMenu() {
        const isOpening = !navLinks.classList.contains('active');

        mobileMenuToggle.classList.toggle('active');
        navLinks.classList.toggle('active');
        backdrop.classList.toggle('active');
        body.classList.toggle('menu-open');

        const lines = mobileMenuToggle.querySelectorAll('.hamburger-line');
        if (isOpening) {
            lines[0].style.transform = 'translateY(7px) rotate(45deg)';
            lines[1].style.opacity = '0';
            lines[2].style.transform = 'translateY(-7px) rotate(-45deg)';
        } else {
            lines[0].style.transform = '';
            lines[1].style.opacity = '';
            lines[2].style.transform = '';
        }
    }

    mobileMenuToggle?.addEventListener('click', toggleMenu);
    backdrop?.addEventListener('click', toggleMenu);

    document.querySelectorAll('.nav-links a, .nav-links button, .nav-buttons a, .nav-buttons button').forEach(link => {
        link.addEventListener('click', () => {
            if (navLinks.classList.contains('active')) {
                toggleMenu();
            }
        });
    });

    const resizeHandler = debounce(() => {
        if (window.innerWidth > 768 && navLinks.classList.contains('active')) {
            toggleMenu();
        }
    }, 100);

    window.addEventListener('resize', resizeHandler);
}

/**
 * Setup smooth scrolling
 */
function setupSmoothScrolling() {
    const navbar = document.querySelector('.navbar');
    const navbarHeight = navbar ? navbar.offsetHeight : 0;

    document.querySelectorAll('.nav-links a[href^="#"]:not([href="#"])').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - navbarHeight;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });

                const navLinks = document.querySelector('.nav-links');
                if (navLinks.classList.contains('active')) {
                    document.querySelector('.mobile-menu-toggle').click();
                }
            }
        });
    });

    const sections = document.querySelectorAll('.section');
    const navLinksElements = document.querySelectorAll('.nav-links a');

    function updateActiveLink() {
        const fromTop = window.scrollY + navbarHeight + 10;

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            const sectionId = section.getAttribute('id');

            if (fromTop >= sectionTop && fromTop < sectionTop + sectionHeight) {
                navLinksElements.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }

    let isScrolling = false;
    window.addEventListener('scroll', () => {
        if (!isScrolling) {
            window.requestAnimationFrame(() => {
                updateActiveLink();
                isScrolling = false;
            });
            isScrolling = true;
        }
    });

    updateActiveLink();
}

/**
 * Main initialization
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Setup theme toggle first (before content loads)
    const themeState = setupThemeToggle();

    // Setup navigation and UI (these don't depend on data)
    setupMobileNavigation();
    setupSmoothScrolling();
    setupScrollProgress();
    setupDownloadButton();

    // Load and render all data
    try {
        await loadAllData();

        // Render all sections
        renderProfile(siteData.profile);
        renderSummary(siteData.summary);
        renderEducation(siteData.education);
        renderExperience(siteData.experience);
        renderSkills(siteData.skills);
        updateCVLinks(siteData.settings);

        // Apply theme to newly rendered logos
        if (themeState) {
            updateLogosForTheme(themeState.current);
        }

        // Setup animations and interactions for dynamic content
        setupAnimations();
        setupExperienceDurations();
        initializeSkillCards();

    } catch (error) {
        console.error('Failed to load site data:', error);
    }
});
