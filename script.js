/**
 * Handles CV download with error handling
 */
function setupDownloadButton() {
    const downloadBtn = document.querySelector('.download-button');
    if (!downloadBtn) return;

    downloadBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            // Check if file exists
            const response = await fetch('assets/CV_2025_Ahmed_Radhi_Applied_Mathematics_and_Statistics.pdf');
            if (!response.ok) throw new Error('CV file not found');
            
            const link = document.createElement('a');
            link.href = 'assets/CV_2025_Ahmed_Radhi_Applied_Mathematics_and_Statistics.pdf';
            link.download = 'Ahmed_Radhi_CV.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Download failed:', error);
            alert('Sorry, the CV could not be downloaded at this time.');
        }
    });
}

/**
 * Manages theme toggling with state persistence
 */
function setupThemeToggle() {
    const themeToggle = document.querySelector('.theme-toggle');
    if (!themeToggle) return;

    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Theme state management
    const themeState = {
        current: localStorage.getItem('theme') || 
                (prefersDarkScheme.matches ? 'dark' : 'light'),
        
        setTheme(theme) {
            this.current = theme;
            document.body.classList.toggle('dark-mode', theme === 'dark');
            localStorage.setItem('theme', theme);
        },
        
        toggle() {
            this.setTheme(this.current === 'dark' ? 'light' : 'dark');
        }
    };

    // Apply initial theme
    themeState.setTheme(themeState.current);
    
    // Toggle theme on button click
    themeToggle.addEventListener('click', () => themeState.toggle());
    
    // Watch for system theme changes
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

document.addEventListener('DOMContentLoaded', () => {
    // Initialize modules
    setupDownloadButton();
    setupThemeToggle();

    // Setup navigation with null checks
    const mobileNav = document.querySelector('.mobile-menu-toggle');
    if (mobileNav) {
        setupMobileNavigation();
        setupSmoothScrolling();
    }

    // Animation setup with null checks
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

    // Intersection Observer with error handling
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

    // Calculate and display experience duration
    document.querySelectorAll('.experience-date').forEach(dateSpan => {
        const startStr = dateSpan.getAttribute('data-start');
        const endStr = dateSpan.getAttribute('data-end');
        
        // Parse start date (format: YYYY or YYYY-MM)
        const startParts = startStr.includes('-') ? startStr.split('-') : [startStr, '01'];
        const startDate = new Date(startParts[0], startParts[1] - 1);
        
        // Parse end date (format: YYYY or YYYY-MM or 'Present')
        let endDate;
        if (endStr === 'Present') {
            endDate = new Date();
        } else if (endStr.includes('-')) {
            const [year, month] = endStr.split('-');
            endDate = new Date(year, month - 1);
        } else {
            endDate = new Date(endStr, 0);
        }
        
        // Calculate months difference
        const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                      (endDate.getMonth() - startDate.getMonth());
        
        const duration = months < 12 ? 
            `${months} months` : 
            `${Math.floor(months/12)} year${Math.floor(months/12) !== 1 ? 's' : ''}${months%12 ? ` ${months%12} months` : ''}`;
        
        dateSpan.setAttribute('title', `Duration: ${duration}`);
    });
    
    // Skills section animations
    initializeSkillCards();
});

// Function to initialize skill cards and handle animations
function initializeSkillCards() {
    const skillCards = document.querySelectorAll('.skill-card');
    
    // Animate skill cards on page load with delay
    skillCards.forEach(card => {
        const delay = parseFloat(card.getAttribute('data-delay')) || 0;
        setTimeout(() => {
            card.style.animation = `fadeInUp 0.6s ease forwards`;
        }, delay * 1000);
    });
    
    // Add intersection observer for progress bars
    const progressBars = document.querySelectorAll('.progress-bar');
    const progressObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const bar = entry.target;
                const percent = bar.getAttribute('data-percent');
                // Set initial width to 0% and animate to the target percent
                bar.style.width = '0%';
                setTimeout(() => {
                    bar.style.width = percent;
                }, 300); // Small delay for visual effect
            }
        });
    }, { threshold: 0.5 });
    
    progressBars.forEach(bar => {
        // Initially set width to 0%
        bar.style.width = '0%';
        progressObserver.observe(bar);
    });
}

// Add this function to handle mobile navigation
function setupMobileNavigation() {
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const body = document.body;

    // Create backdrop element
    const backdrop = document.createElement('div');
    backdrop.className = 'nav-backdrop';
    document.body.appendChild(backdrop);

    function toggleMenu() {
        const isOpening = !navLinks.classList.contains('active');
        
        // Toggle classes
        mobileMenuToggle.classList.toggle('active');
        navLinks.classList.toggle('active');
        backdrop.classList.toggle('active');
        body.classList.toggle('menu-open');

        // Animate hamburger icon
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

    // Add click event listeners
    mobileMenuToggle?.addEventListener('click', toggleMenu);
    backdrop?.addEventListener('click', toggleMenu);

    // Close menu when clicking a link or button
    document.querySelectorAll('.nav-links a, .nav-buttons a, .nav-buttons button').forEach(link => {
        link.addEventListener('click', () => {
            if (navLinks.classList.contains('active')) {
                toggleMenu();
            }
        });
    });

    // Close menu when screen is resized beyond mobile breakpoint
    const resizeHandler = debounce(() => {
        if (window.innerWidth > 768 && navLinks.classList.contains('active')) {
            toggleMenu();
        }
    }, 100);
    
    window.addEventListener('resize', resizeHandler);

    // Cleanup function to remove event listeners
    return () => {
        window.removeEventListener('resize', resizeHandler);
    };
}

// Function to handle smooth scrolling
function setupSmoothScrolling() {
    // Get navbar height for offset calculations
    const navbar = document.querySelector('.navbar');
    const navbarHeight = navbar ? navbar.offsetHeight : 0;
    
    // Smooth scroll functionality
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

                // Close mobile menu if open
                const navLinks = document.querySelector('.nav-links');
                if (navLinks.classList.contains('active')) {
                    document.querySelector('.mobile-menu-toggle').click();
                }
            }
        });
    });

    // Update active nav link on scroll
    const sections = document.querySelectorAll('.section');
    const navLinks = document.querySelectorAll('.nav-links a');

    function updateActiveLink() {
        const fromTop = window.scrollY + navbarHeight + 10; // Added small buffer

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            const sectionId = section.getAttribute('id');
            
            if (fromTop >= sectionTop && fromTop < sectionTop + sectionHeight) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }

    // Add scroll event listener with throttling (passive improves scrolling performance)
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
    
    // Initial call to set active link on page load
    updateActiveLink();
}
