document.addEventListener('DOMContentLoaded', () => {
    // Add this at the beginning of your DOMContentLoaded event listener
    setupMobileNavigation();
    setupSmoothScrolling();

    // Add animation delays to role items
    const roleItems = document.querySelectorAll('.role-item');
    roleItems.forEach((item, index) => {
        item.style.animationDelay = `${index * 0.2}s`;
        
        // Add delays to list items within each role
        const listItems = item.querySelectorAll('.role-description li');
        listItems.forEach((li, i) => {
            li.style.animationDelay = `${(index * 0.2) + ((i + 1) * 0.1)}s`;
        });
    });

    // Intersection Observer for scroll animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animationPlayState = 'running';
            }
        });
    }, {
        threshold: 0.1
    });

    // Observe all company blocks
    document.querySelectorAll('.company-block').forEach(block => {
        observer.observe(block);
    });

    // Calculate and display experience duration
    document.querySelectorAll('.role-date').forEach(dateSpan => {
        const dates = dateSpan.textContent.split(' - ');
        const startDate = new Date(dates[0]);
        const endDate = dates[1] === 'Present' ? new Date() : new Date(dates[1]);
        
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
        console.log('Toggle menu clicked'); // Debug log
        mobileMenuToggle.classList.toggle('active');
        navLinks.classList.toggle('active');
        backdrop.classList.toggle('active');
        body.classList.toggle('menu-open');
    }

    // Add click event listeners
    mobileMenuToggle?.addEventListener('click', toggleMenu);
    backdrop?.addEventListener('click', toggleMenu);

    // Close menu when clicking a link
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            if (navLinks.classList.contains('active')) {
                toggleMenu();
            }
        });
    });

    // Close menu when screen is resized beyond mobile breakpoint
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768 && navLinks.classList.contains('active')) {
            toggleMenu();
        }
    });
}

// Function to handle smooth scrolling
function setupSmoothScrolling() {
    // Get navbar height for offset calculations
    const navbar = document.querySelector('.navbar');
    const navbarHeight = navbar ? navbar.offsetHeight : 0;
    
    // Smooth scroll functionality
    document.querySelectorAll('.nav-links a, a[href^="#"]').forEach(anchor => {
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

    // Add scroll event listener with throttling
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
