document.addEventListener('DOMContentLoaded', function() {
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const downloadButton = document.getElementById('download-cv');
    
    // Experience date calculations with improved formatting
    const experienceDates = document.querySelectorAll('.experience-date');
    
    experienceDates.forEach(date => {
        const start = new Date(date.dataset.start);
        const end = date.dataset.end === 'Present' ? new Date() : new Date(date.dataset.end);
        
        const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        const years = Math.floor(months / 12);
        const remainingMonths = months % 12;
        
        let duration = '';
        if (years > 0) {
            duration += `${years} year${years > 1 ? 's' : ''}`;
            if (remainingMonths > 0) {
                duration += ` ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
            }
        } else {
            duration = `${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
        }
        
        date.setAttribute('title', `Duration: ${duration}`);
    });

    // Scroll progress indicator
    const scrollProgress = document.createElement('div');
    scrollProgress.className = 'scroll-progress';
    document.body.appendChild(scrollProgress);

    window.addEventListener('scroll', () => {
        const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (window.scrollY / windowHeight) * 100;
        scrollProgress.style.width = `${scrolled}%`;
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Skills animation on scroll
    const skills = document.querySelectorAll('.skills li');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('skill-animate');
            }
        });
    }, { threshold: 0.5 });

    skills.forEach(skill => observer.observe(skill));

    // Dark mode toggle with localStorage
    if (darkModeToggle) {
        if (localStorage.getItem('darkMode') === 'true') {
            document.body.classList.add('dark-mode');
        }

        darkModeToggle.addEventListener('click', function() {
            const isDark = document.body.classList.toggle('dark-mode');
            localStorage.setItem('darkMode', isDark);
        });
    }

    // Download functionality with error handling
    if (downloadButton) {
        downloadButton.addEventListener('click', function() {
            try {
                const link = document.createElement('a');
                link.href = 'CV_2025_Ahmed_Radhi_Applied_Mathematics_and_Statistics.pdf';
                link.download = 'Ahmed_Radhi_CV.pdf';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (error) {
                console.error('Download failed:', error);
                alert('Download failed. Please try again later.');
            }
        });
    }
});
