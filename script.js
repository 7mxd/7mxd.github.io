/**
 * Data loading and rendering functions
 */

// A small greeting for anyone who opens the dev console.
// Matches the printed-terminal voice of the site.
(() => {
    const title = 'color: #b45742; font-weight: 700; font-family: "Courier Prime", monospace; font-size: 14px;';
    const body  = 'color: #555; font-family: "Courier Prime", monospace; font-size: 12.5px;';
    console.log(
        '%c$ cat welcome.txt%c\n\n' +
        'you found the dev console.\n' +
        'press ` anywhere on the page to open an interactive terminal.\n\n' +
        'this site is vanilla html + css + js, no framework, no build step.\n' +
        'source: https://github.com/7mxd/7mxd.github.io',
        title, body
    );
})();

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
    </svg>`,
    github: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
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
    const [profile, summary, education, experience, skills, settings, projects] = await Promise.all([
        fetchData('profile.json'),
        fetchData('summary.json'),
        fetchData('education.json'),
        fetchData('experience.json'),
        fetchData('skills.json'),
        fetchData('settings.json'),
        fetchData('projects.json')
    ]);

    siteData = { profile, summary, education, experience, skills, settings, projects };
    return siteData;
}

/**
 * Render the header/profile section with enhanced hero
 */
function renderProfile(profile) {
    const container = document.getElementById('header-section');
    if (!container || !profile) return;

    container.innerHTML = `
        <span class="header-preamble" aria-hidden="true">$ cat ~/about.md</span>
        <h1>${profile.name}</h1>
        <p class="subtitle">${profile.title}<span class="live-cursor" aria-hidden="true">_</span></p>
        <div class="contact-info" role="list" aria-label="Contact information">
            <a href="mailto:${profile.contact.email}" class="contact-item" role="listitem" aria-label="Email: ${profile.contact.email}">
                ${ICONS.email}
                <span>${profile.contact.email}</span>
            </a>
            <a href="tel:${profile.contact.phone.replace(/\s/g, '')}" class="contact-item" role="listitem" aria-label="Phone: ${profile.contact.phone}">
                ${ICONS.phone}
                <span>${profile.contact.phone}</span>
            </a>
            ${profile.contact.linkedin?.url ? `
            <a href="${profile.contact.linkedin.url}" target="_blank" rel="noopener noreferrer" class="contact-item" role="listitem" aria-label="LinkedIn profile (opens in new tab)">
                ${ICONS.linkedin}
                <span>${profile.contact.linkedin.label || 'LinkedIn'}</span>
            </a>
            ` : ''}
            ${profile.contact.github?.url ? `
            <a href="${profile.contact.github.url.startsWith('http') ? profile.contact.github.url : 'https://' + profile.contact.github.url}" target="_blank" rel="noopener noreferrer" class="contact-item" role="listitem" aria-label="GitHub profile (opens in new tab)">
                ${ICONS.github}
                <span>${profile.contact.github.label || 'GitHub'}</span>
            </a>
            ` : ''}
            <span class="contact-item" role="listitem" aria-label="Location: ${profile.contact.location}">
                ${ICONS.location}
                <span>${profile.contact.location}</span>
            </span>
        </div>
    `;
}

/**
 * Render the summary section
 */
function renderSummary(summary) {
    const container = document.getElementById('summary-content');
    if (!container) return;
    if (!summary || !summary.content) {
        hideParentSection(container);
        return;
    }
    container.textContent = summary.content;
}

/**
 * Hide the nearest enclosing <section> and its matching nav link.
 * Used when a data file is empty so we never render a lonely header.
 */
function hideParentSection(el) {
    const section = el.closest ? el.closest('section') : null;
    if (!section) return;
    section.style.display = 'none';
    const id = section.id;
    if (!id) return;
    document.querySelectorAll(`.nav-links a[href="#${id}"]`).forEach(link => {
        link.style.display = 'none';
    });
}

/**
 * Render the education section
 */
function renderEducation(education) {
    const container = document.getElementById('education-grid');
    if (!container) return;
    if (!education || !education.items || !education.items.length) {
        hideParentSection(container);
        return;
    }

    container.innerHTML = education.items.map(item => `
        <div class="education-card">
            <div class="education-content">
                <div class="institution-header">
                    <img src="${item.logo}" alt="${item.institution}" class="institution-logo" loading="lazy">
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
    if (!container) return;
    if (!experience || !experience.items || !experience.items.length) {
        hideParentSection(container);
        return;
    }

    container.innerHTML = experience.items.map(company => {
        const logoHasThemes = company.logo.light && company.logo.dark;
        const logoHtml = logoHasThemes
            ? `<img src="${company.logo.light}" alt="${company.company}" class="company-logo company-logo--light" loading="lazy">
               <img src="${company.logo.dark}" alt="" aria-hidden="true" class="company-logo company-logo--dark" loading="lazy">`
            : `<img src="${company.logo.default}" alt="${company.company}" class="company-logo" loading="lazy">`;

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
                        ${logoHtml}
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
    if (!container) return;
    if (!skills || !skills.categories || !skills.categories.length) {
        hideParentSection(container);
        return;
    }

    const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

    container.innerHTML = skills.categories.map(category => {
        let contentHtml = '';

        if (category.type === 'list') {
            contentHtml = `
                <ul class="skill-list">
                    ${category.items.map(item => `<li>${typeof item === 'string' ? item : item.name}</li>`).join('')}
                </ul>
            `;
        } else if (category.type === 'tags') {
            contentHtml = `
                <div class="skill-item-container">
                    ${category.items.map(item => `<span class="skill-item">${typeof item === 'string' ? item : item.name}</span>`).join('')}
                </div>
            `;
        } else if (category.type === 'languages') {
            const pills = category.items.map(item => {
                const name = escapeHtml(item.name || '');
                const level = escapeHtml(item.level || '');
                const ariaLabel = `${item.name || ''}${item.level ? ': ' + item.level : ''}`;
                return `<span class="skill-item skill-item--lang" aria-label="${escapeHtml(ariaLabel)}">
                    <span class="skill-item-lang-name">${name}</span>
                    ${level ? `<span class="skill-item-lang-level">${level}</span>` : ''}
                </span>`;
            }).join('');
            contentHtml = `<div class="skill-item-container">${pills}</div>`;
        }

        return `
            <div class="skill-card">
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
 * Project link icon SVGs
 */
const PROJECT_LINK_ICONS = {
    github: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>`,
    webapp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
        <circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
    </svg>`,
    ios: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>`,
    android: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
        <path d="M17.523 15.3414c-.5-1.5-2.058-2.316-3.558-1.816-1.5.5-2.316 2.058-1.816 3.558.5 1.5 2.058 2.316 3.558 1.816 1.5-.5 2.316-2.058 1.816-3.558zM7.523 15.3414c.5-1.5-.316-3.058-1.816-3.558-1.5-.5-3.058.316-3.558 1.816-.5 1.5.316 3.058 1.816 3.558 1.5.5 3.058-.316 3.558-1.816z"/>
        <path d="M1 13h2v-3H1v3zm20-3h-2v3h2v-3zM6.5 2L5 3.5l2 2C5.168 6.8 4 8.786 4 11h16c0-2.214-1.168-4.2-2.99-5.5l2-2L17.5 2l-2.3 2.3A7.474 7.474 0 0 0 12 3.5c-1.14 0-2.21.286-3.2.8L6.5 2z"/>
    </svg>`,
    link: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
        <polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line>
    </svg>`
};

/**
 * Render the projects section
 */
function renderProjects(projects) {
    const container = document.getElementById('projects-grid');
    if (!container) return;
    if (!projects || !projects.items || !projects.items.length) {
        hideParentSection(container);
        return;
    }

    container.innerHTML = projects.items.map(project => {
        const linksHtml = [];
        const links = project.links || {};

        if (links.github) {
            linksHtml.push(`<a href="${links.github}" target="_blank" rel="noopener noreferrer" class="project-link" aria-label="GitHub repository">${PROJECT_LINK_ICONS.github}<span>GitHub</span></a>`);
        }
        if (links.webapp) {
            linksHtml.push(`<a href="${links.webapp}" target="_blank" rel="noopener noreferrer" class="project-link" aria-label="Web app">${PROJECT_LINK_ICONS.webapp}<span>Web App</span></a>`);
        }
        if (links.ios) {
            linksHtml.push(`<a href="${links.ios}" target="_blank" rel="noopener noreferrer" class="project-link" aria-label="iOS app">${PROJECT_LINK_ICONS.ios}<span>iOS</span></a>`);
        }
        if (links.android) {
            linksHtml.push(`<a href="${links.android}" target="_blank" rel="noopener noreferrer" class="project-link" aria-label="Android app">${PROJECT_LINK_ICONS.android}<span>Android</span></a>`);
        }
        if (links.extra && links.extra.length) {
            links.extra.forEach(extra => {
                linksHtml.push(`<a href="${extra.url}" target="_blank" rel="noopener noreferrer" class="project-link" aria-label="${extra.label}">${PROJECT_LINK_ICONS.link}<span>${extra.label}</span></a>`);
            });
        }

        const tagsHtml = project.tags && project.tags.length
            ? `<div class="project-tags">${project.tags.map(tag => `<span class="project-tag">${tag}</span>`).join('')}</div>`
            : '';

        const imageHtml = project.image
            ? `<div class="project-image"><img src="${project.image}" alt="${project.title}" loading="lazy"></div>`
            : '';

        const ALLOWED_STATUSES = ['in-progress', 'shipped', 'research'];
        const safeStatus = ALLOWED_STATUSES.includes(project.status) ? project.status : null;
        const statusLabel = safeStatus ? safeStatus.replace('-', ' ') : '';
        const statusHtml = safeStatus
            ? `<span class="project-status project-status--${safeStatus}">${statusLabel}</span>`
            : '';

        const chartHtml = project.chart
            ? `<figure class="project-chart-figure">
                  ${project.chartCaption ? `<figcaption class="project-chart-caption">${project.chartCaption}</figcaption>` : ''}
                  <pre class="project-chart" aria-label="Benchmark chart">${
                      project.chart.replace(/([\u2580-\u2588]+)/g, '<span class="project-chart-bar">$1</span>')
                  }</pre>
              </figure>`
            : '';

        return `
            <article class="project-card">
                ${imageHtml}
                <div class="project-card-content">
                    <div class="project-card-header">
                        <h3>${project.title}</h3>
                        ${statusHtml}
                    </div>
                    <p class="project-description">${project.description}</p>
                    ${chartHtml}
                    ${tagsHtml}
                    ${linksHtml.length ? `<div class="project-links">${linksHtml.join('')}</div>` : ''}
                </div>
            </article>
        `;
    }).join('');
}

/**
 * Apply section visibility settings , hides disabled sections and their nav links
 */
function applySectionVisibility(settings) {
    const sections = settings?.sections;
    if (!sections) return;

    const sectionIds = ['summary', 'education', 'experience', 'skills', 'projects'];

    sectionIds.forEach(id => {
        const config = sections[id];
        const enabled = config ? config.enabled : true;

        // Hide/show the section
        const sectionEl = document.getElementById(id);
        if (sectionEl) {
            sectionEl.style.display = enabled ? '' : 'none';
        }

        // Hide/show the corresponding nav link
        document.querySelectorAll(`.nav-links a[href="#${id}"]`).forEach(link => {
            link.style.display = enabled ? '' : 'none';
        });
    });
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
                // Fallback: open the CV path directly in a new tab
                window.open(cvPath, '_blank');
            }
        });
    });
}

/**
 * Manages theme toggling with state persistence.
 * Theme-aware company logos are rendered as paired <img> elements
 * and switched via CSS on the body.dark-mode class, so no JS
 * src swap is needed here.
 */
function setupThemeToggle() {
    const themeToggles = document.querySelectorAll('.theme-toggle');
    if (!themeToggles.length) return;

    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

    const themeState = {
        current: localStorage.getItem('theme') ||
                (prefersDarkScheme.matches ? 'dark' : 'light'),

        setTheme(theme, announce = false) {
            this.current = theme;
            document.body.classList.toggle('dark-mode', theme === 'dark');
            localStorage.setItem('theme', theme);
            if (announce) {
                announceThemeChange(theme);
            }
        },

        toggle() {
            const newTheme = this.current === 'dark' ? 'light' : 'dark';
            this.setTheme(newTheme, true);
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
 * Calculate duration between two dates in years and months
 * @param {string} startStr - Start date (YYYY-MM or YYYY)
 * @param {string} endStr - End date (YYYY-MM, YYYY, "Present", or "Current")
 * @returns {string|null} Human-friendly duration string or null if invalid
 */
function calculateDuration(startStr, endStr) {
    if (!startStr || !endStr) return null;

    // Parse start date
    const startParts = startStr.includes('-') ? startStr.split('-') : [startStr, '01'];
    const startYear = parseInt(startParts[0], 10);
    const startMonth = parseInt(startParts[1], 10) - 1; // 0-indexed
    const startDate = new Date(startYear, startMonth, 1);

    // Parse end date
    let endDate;
    const endLower = endStr.toLowerCase();
    if (endLower === 'present' || endLower === 'current') {
        endDate = new Date();
    } else if (endStr.includes('-')) {
        const [year, month] = endStr.split('-');
        endDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    } else {
        endDate = new Date(parseInt(endStr, 10), 0, 1);
    }

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.warn('Invalid date format:', { startStr, endStr });
        return null;
    }

    // Check if end date is before start date
    if (endDate < startDate) {
        console.warn('End date is before start date:', { startStr, endStr });
        return null;
    }

    // Calculate total months (inclusive of the end month)
    let totalMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                      (endDate.getMonth() - startDate.getMonth()) + 1;

    // Handle edge case: same month
    if (totalMonths <= 0) totalMonths = 1;

    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;

    // Format the duration string
    if (years === 0) {
        if (months === 1) return '1 month';
        return `${months} months`;
    } else if (months === 0) {
        if (years === 1) return '1 year';
        return `${years} years`;
    } else {
        const yearStr = years === 1 ? '1 year' : `${years} years`;
        const monthStr = months === 1 ? '1 month' : `${months} months`;
        return `${yearStr} and ${monthStr}`;
    }
}

/**
 * Calculate and display experience/education duration on hover/tap
 */
function setupExperienceDurations() {
    document.querySelectorAll('.experience-date').forEach(dateSpan => {
        const startStr = dateSpan.getAttribute('data-start');
        const endStr = dateSpan.getAttribute('data-end');

        const duration = calculateDuration(startStr, endStr);

        if (duration) {
            // Store duration as data attribute
            dateSpan.setAttribute('data-duration', duration);
            dateSpan.setAttribute('aria-describedby', `duration-${Math.random().toString(36).substr(2, 9)}`);

            // Create tooltip element
            const tooltip = document.createElement('span');
            tooltip.className = 'duration-tooltip';
            tooltip.textContent = duration;
            tooltip.setAttribute('role', 'tooltip');
            tooltip.id = dateSpan.getAttribute('aria-describedby');
            dateSpan.appendChild(tooltip);

            // Add keyboard accessibility
            dateSpan.setAttribute('tabindex', '0');
            dateSpan.setAttribute('role', 'button');
            dateSpan.setAttribute('aria-label', `${dateSpan.textContent.trim()}, duration: ${duration}`);

            // Handle touch events for mobile
            let touchTimeout;
            dateSpan.addEventListener('touchstart', (e) => {
                e.preventDefault();
                // Toggle active state on tap
                const isActive = dateSpan.classList.contains('show-duration');

                // Close all other open tooltips
                document.querySelectorAll('.experience-date.show-duration').forEach(el => {
                    if (el !== dateSpan) el.classList.remove('show-duration');
                });

                dateSpan.classList.toggle('show-duration');

                // Auto-hide after 3 seconds
                clearTimeout(touchTimeout);
                if (!isActive) {
                    touchTimeout = setTimeout(() => {
                        dateSpan.classList.remove('show-duration');
                    }, 3000);
                }
            }, { passive: false });

            // Handle keyboard events
            dateSpan.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    dateSpan.classList.toggle('show-duration');
                }
                if (e.key === 'Escape') {
                    dateSpan.classList.remove('show-duration');
                }
            });
        }
    });

    // Close tooltips when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.experience-date')) {
            document.querySelectorAll('.experience-date.show-duration').forEach(el => {
                el.classList.remove('show-duration');
            });
        }
    });
}

/**
 * Setup mobile navigation with accessibility
 */
function setupMobileNavigation() {
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const body = document.body;

    const backdrop = document.createElement('div');
    backdrop.className = 'nav-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(backdrop);

    function toggleMenu() {
        const isOpening = !navLinks.classList.contains('active');

        mobileMenuToggle.classList.toggle('active');
        navLinks.classList.toggle('active');
        backdrop.classList.toggle('active');
        body.classList.toggle('menu-open');

        // Update ARIA attributes for accessibility
        mobileMenuToggle.setAttribute('aria-expanded', isOpening ? 'true' : 'false');
        navLinks.setAttribute('aria-hidden', isOpening ? 'false' : 'true');

        // Announce to screen readers
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'sr-only';
        announcement.textContent = isOpening ? 'Navigation menu opened' : 'Navigation menu closed';
        document.body.appendChild(announcement);
        setTimeout(() => announcement.remove(), 1000);

        const lines = mobileMenuToggle.querySelectorAll('.hamburger-line');
        if (isOpening) {
            lines[0].style.transform = 'translateY(7px) rotate(45deg)';
            lines[1].style.opacity = '0';
            lines[2].style.transform = 'translateY(-7px) rotate(-45deg)';
            // Focus first link when menu opens
            setTimeout(() => {
                const firstLink = navLinks.querySelector('a');
                if (firstLink) firstLink.focus();
            }, 300);
        } else {
            lines[0].style.transform = '';
            lines[1].style.opacity = '';
            lines[2].style.transform = '';
        }
    }

    mobileMenuToggle?.addEventListener('click', toggleMenu);
    backdrop?.addEventListener('click', toggleMenu);

    // Close menu with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navLinks.classList.contains('active')) {
            toggleMenu();
            mobileMenuToggle.focus();
        }
    });

    document.querySelectorAll('.nav-links a, .nav-links button').forEach(link => {
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

    /*
     * Active-nav highlighting via IntersectionObserver.
     * Previous implementation recomputed section positions on every scroll frame;
     * the observer fires only when a section enters or leaves a horizontal band
     * anchored to the sticky navbar, which costs nothing between events.
     */
    const sections = document.querySelectorAll('.section');
    const navLinksElements = document.querySelectorAll('.nav-links a');

    const setActive = (id) => {
        navLinksElements.forEach(link => {
            const isMatch = link.getAttribute('href') === `#${id}`;
            link.classList.toggle('active', isMatch);
            if (isMatch) {
                link.setAttribute('aria-current', 'location');
            } else {
                link.removeAttribute('aria-current');
            }
        });
    };

    if ('IntersectionObserver' in window && sections.length) {
        // Band: triggers when a section crosses the top nav area.
        const rootMargin = `-${navbarHeight + 8}px 0px -70% 0px`;
        const activeObserver = new IntersectionObserver((entries) => {
            // Prefer the most-recently-intersecting entry; multiple can fire at once.
            const visible = entries
                .filter(e => e.isIntersecting)
                .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
            if (visible && visible.target.id) {
                setActive(visible.target.id);
            }
        }, { rootMargin, threshold: 0 });

        sections.forEach(section => activeObserver.observe(section));
    }
}

/**
 * Setup keyboard navigation detection for skip link
 * Only shows skip link when user is actively using keyboard navigation
 */
function setupKeyboardDetection() {
    const html = document.documentElement;

    // Detect keyboard navigation (Tab key)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            html.classList.add('using-keyboard');
        }
    }, { capture: true });

    // Detect mouse/touch - disable keyboard mode
    document.addEventListener('mousedown', () => {
        html.classList.remove('using-keyboard');
    }, { capture: true });

    document.addEventListener('touchstart', () => {
        html.classList.remove('using-keyboard');
    }, { capture: true, passive: true });

    // Also handle pointer events for hybrid devices
    document.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'keyboard') {
            html.classList.remove('using-keyboard');
        }
    }, { capture: true });
}

/**
 * Main initialization
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Setup keyboard detection first (for skip link)
    setupKeyboardDetection();

    // Set footer year
    const footerYear = document.getElementById('footer-year');
    if (footerYear) footerYear.textContent = new Date().getFullYear();

    // Setup theme toggle first (before content loads)
    setupThemeToggle();

    // Setup navigation and UI (these don't depend on data)
    setupMobileNavigation();
    setupSmoothScrolling();
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
        renderProjects(siteData.projects);
        updateCVLinks(siteData.settings);
        applySectionVisibility(siteData.settings);

        // Setup interactions for dynamic content
        setupExperienceDurations();
        setupTerminal();

    } catch (error) {
        console.error('Failed to load site data:', error);
    }
});

/**
 * Interactive terminal Easter egg.
 * Toggle with backtick (`), escape to close, up/down for history.
 * Commands read from siteData so they stay in sync with the page content.
 */
function setupTerminal() {
    const term = document.getElementById('terminal');
    const log = document.getElementById('terminal-log');
    const input = document.getElementById('terminal-input');
    const form = document.getElementById('terminal-form');
    const trigger = document.getElementById('terminal-trigger');
    const closeBtn = document.getElementById('terminal-close');

    if (!term || !log || !input || !form || !trigger) return;

    const history = [];
    let historyIndex = -1;
    let lastFocused = null;

    const isOpen = () => !term.hidden;

    const escapeHtml = (s) => String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const write = (lines, cls) => {
        const arr = Array.isArray(lines) ? lines : [lines];
        arr.forEach(line => {
            const div = document.createElement('div');
            div.className = cls ? `term-line ${cls}` : 'term-line';
            div.innerHTML = line;
            log.appendChild(div);
        });
        log.scrollTop = log.scrollHeight;
    };

    const writeEcho = (cmd) => write(
        `<span class="term-prompt">&gt;</span> <span class="term-echo">${escapeHtml(cmd)}</span>`
    );

    const clearLog = () => { log.innerHTML = ''; };

    const openTerminal = () => {
        if (isOpen()) return;
        lastFocused = document.activeElement;
        term.hidden = false;
        if (!log.childElementCount) {
            write([
                'ahmed@7mxd ~ $ cat welcome.txt',
                '',
                'hello. this is a little interactive terminal.',
                'type <span class="term-link">help</span> for a list of commands.',
                'press <span class="term-link">escape</span> or the backtick key to close.',
                '',
            ]);
        }
        requestAnimationFrame(() => input.focus());
    };

    const closeTerminal = () => {
        if (!isOpen()) return;
        term.hidden = true;
        if (lastFocused && typeof lastFocused.focus === 'function') {
            lastFocused.focus();
        }
    };

    const toggleTerminal = () => (isOpen() ? closeTerminal() : openTerminal());

    const scrollToId = (id) => {
        const el = document.getElementById(id);
        if (!el) return false;
        const navbar = document.querySelector('.navbar');
        const offset = (navbar ? navbar.offsetHeight : 0) + 12;
        const top = el.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top, behavior: 'smooth' });
        return true;
    };

    const findProject = (slug) => {
        const projects = siteData.projects?.items || [];
        const target = slug.toLowerCase();
        return projects.find(p => {
            const byTitle = (p.title || '').toLowerCase().includes(target);
            const byFirstWord = (p.title || '').toLowerCase().split(/[\s:.,-]+/)[0] === target;
            return byTitle || byFirstWord;
        });
    };

    // Section anchors the user can cd/cat into
    const SECTION_ALIASES = {
        about: 'summary',
        'about.md': 'summary',
        summary: 'summary',
        whoami: 'summary',
        projects: 'projects',
        'projects/': 'projects',
        experience: 'experience',
        'experience.log': 'experience',
        skills: 'skills',
        'skills.txt': 'skills',
        education: 'education',
        'education.yaml': 'education',
    };

    const resolveSection = (arg) => SECTION_ALIASES[(arg || '').toLowerCase()];

    const HELP = [
        'commands:',
        '  <span class="term-link">whoami</span>                print name and role',
        '  <span class="term-link">ls</span>                    list top-level sections',
        '  <span class="term-link">ls projects/</span>           list projects by name',
        '  <span class="term-link">cat &lt;section&gt;</span>         jump to a section',
        '  <span class="term-link">cat projects/&lt;slug&gt;</span>  show a project inline',
        '  <span class="term-link">cd &lt;section&gt;</span>           alias of cat &lt;section&gt;',
        '  <span class="term-link">contact</span>               print contact info',
        '  <span class="term-link">theme [dark|light]</span>     change theme',
        '  <span class="term-link">download cv</span>            grab the CV pdf',
        '  <span class="term-link">clear</span>                 clear this log',
        '  <span class="term-link">exit</span>                  close this terminal',
    ];

    const printProject = (p) => {
        const lines = [];
        lines.push(`<strong>${escapeHtml(p.title)}</strong>`);
        if (p.status) lines.push(`status: ${escapeHtml(p.status)}`);
        lines.push('');
        lines.push(escapeHtml(p.description));
        const links = [];
        if (p.links?.github) links.push(`github: ${p.links.github}`);
        if (p.links?.ios) links.push(`ios:    ${p.links.ios}`);
        if (p.links?.webapp) links.push(`web:    ${p.links.webapp}`);
        (p.links?.extra || []).forEach(x => links.push(`${x.label}: ${x.url}`));
        if (links.length) {
            lines.push('');
            lines.push('links:');
            links.forEach(l => lines.push(`  ${escapeHtml(l)}`));
        }
        return lines;
    };

    const run = (raw) => {
        const cmd = raw.trim();
        if (!cmd) return;
        writeEcho(cmd);
        history.unshift(cmd);
        historyIndex = -1;

        const parts = cmd.split(/\s+/);
        const head = parts[0].toLowerCase();
        const rest = parts.slice(1).join(' ');

        switch (head) {
            case 'help':
            case '?':
                write(HELP);
                break;
            case 'whoami': {
                const p = siteData.profile;
                if (!p) { write('no profile loaded.', 'term-error'); break; }
                write([
                    escapeHtml(p.name),
                    escapeHtml(p.title),
                    escapeHtml(p.contact?.location || ''),
                ].filter(Boolean));
                break;
            }
            case 'ls': {
                if (!rest || rest === 'projects/' || rest === 'projects') {
                    if (rest.startsWith('projects')) {
                        const items = siteData.projects?.items || [];
                        if (!items.length) { write('projects/ is empty.'); break; }
                        write(items.map(p => '  ' + escapeHtml(p.title)));
                    } else {
                        write([
                            '  summary',
                            '  projects/',
                            '  experience.log',
                            '  skills.txt',
                            '  education.yaml',
                        ]);
                    }
                } else {
                    write(`ls: cannot access '${escapeHtml(rest)}': no such file or directory`, 'term-error');
                }
                break;
            }
            case 'cd':
            case 'cat': {
                if (!rest) { write(`${head}: missing argument. try "help".`, 'term-error'); break; }
                if (rest.toLowerCase().startsWith('projects/')) {
                    const slug = rest.slice('projects/'.length);
                    if (!slug) {
                        scrollToId('projects');
                        write('(jumped to projects section)');
                        setTimeout(closeTerminal, 400);
                        break;
                    }
                    const p = findProject(slug);
                    if (!p) { write(`no project matching '${escapeHtml(slug)}'.`, 'term-error'); break; }
                    write(printProject(p));
                    break;
                }
                const section = resolveSection(rest);
                if (section && scrollToId(section)) {
                    write(`(jumped to ${section})`);
                    setTimeout(closeTerminal, 400);
                } else {
                    write(`${head}: '${escapeHtml(rest)}': not found. try "ls".`, 'term-error');
                }
                break;
            }
            case 'theme': {
                const arg = (rest || '').toLowerCase();
                const body = document.body;
                if (arg === 'dark') {
                    body.classList.add('dark-mode');
                    localStorage.setItem('theme', 'dark');
                    write('theme: dark');
                } else if (arg === 'light') {
                    body.classList.remove('dark-mode');
                    localStorage.setItem('theme', 'light');
                    write('theme: light');
                } else if (!arg || arg === 'toggle') {
                    const isDark = body.classList.toggle('dark-mode');
                    localStorage.setItem('theme', isDark ? 'dark' : 'light');
                    write(`theme: ${isDark ? 'dark' : 'light'}`);
                } else {
                    write(`theme: expected dark | light | toggle.`, 'term-error');
                }
                break;
            }
            case 'contact': {
                const c = siteData.profile?.contact;
                if (!c) { write('no contact info.', 'term-error'); break; }
                write([
                    `email:    ${escapeHtml(c.email || '')}`,
                    `phone:    ${escapeHtml(c.phone || '')}`,
                    `location: ${escapeHtml(c.location || '')}`,
                    c.linkedin?.url ? `linkedin: ${escapeHtml(c.linkedin.url)}` : '',
                    c.github?.url ? `github:   ${escapeHtml(c.github.url)}` : '',
                ].filter(Boolean));
                break;
            }
            case 'download': {
                if ((rest || '').toLowerCase() === 'cv') {
                    const path = siteData.settings?.cv?.path || 'assets/ahmed_radhi_cv_2025.pdf';
                    const name = siteData.settings?.cv?.downloadName || 'Ahmed_Radhi_CV.pdf';
                    const a = document.createElement('a');
                    a.href = path;
                    a.download = name;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    write(`downloading ${escapeHtml(name)}...`);
                } else {
                    write(`download: usage: download cv`, 'term-error');
                }
                break;
            }
            case 'clear':
                clearLog();
                break;
            case 'exit':
            case 'close':
            case 'quit':
                closeTerminal();
                break;
            case 'pwd':
                write('/home/ahmed');
                break;
            default:
                write(`command not found: ${escapeHtml(head)}. try "help".`, 'term-error');
        }
    };

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const v = input.value;
        input.value = '';
        run(v);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') {
            if (history.length && historyIndex < history.length - 1) {
                historyIndex++;
                input.value = history[historyIndex];
                requestAnimationFrame(() => {
                    input.setSelectionRange(input.value.length, input.value.length);
                });
            }
            e.preventDefault();
        } else if (e.key === 'ArrowDown') {
            if (historyIndex > 0) {
                historyIndex--;
                input.value = history[historyIndex];
            } else {
                historyIndex = -1;
                input.value = '';
            }
            e.preventDefault();
        } else if (e.key === 'Tab') {
            // Simple command completion for the head word only.
            const words = input.value.split(/\s+/);
            if (words.length === 1) {
                const known = ['help', 'whoami', 'ls', 'cat', 'cd', 'contact', 'theme', 'download', 'clear', 'exit'];
                const match = known.find(k => k.startsWith(words[0].toLowerCase()));
                if (match && match !== words[0]) { input.value = match + ' '; }
                e.preventDefault();
            }
        }
    });

    // Global toggle shortcut: backtick. Ignored when typing in any other input.
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen()) {
            closeTerminal();
            return;
        }
        if (e.key !== '`') return;
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) {
            // Don't intercept backtick if the user is actually typing somewhere,
            // UNLESS it's our own input (where backtick closes).
            if (e.target.id !== 'terminal-input') return;
        }
        e.preventDefault();
        toggleTerminal();
    });

    trigger.addEventListener('click', toggleTerminal);
    closeBtn?.addEventListener('click', closeTerminal);
}

/**
 * Announce theme change to screen readers
 */
function announceThemeChange(theme) {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = `Theme changed to ${theme} mode`;
    document.body.appendChild(announcement);
    setTimeout(() => announcement.remove(), 1000);
}
