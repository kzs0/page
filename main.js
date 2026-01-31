/**
 * Main JavaScript for site interactivity
 */

document.addEventListener('DOMContentLoaded', () => {
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.querySelector(anchor.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Intersection Observer for fade-in animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe sections for animation
    document.querySelectorAll('.work, .connect').forEach(section => {
        observer.observe(section);
    });

    // Add nav background on scroll
    // Optimized to only update when crossing threshold, not on every scroll
    const nav = document.querySelector('.nav');
    let navScrolled = false;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        const shouldBeScrolled = currentScroll > 100;

        // Only update styles when state changes to avoid constant repaints
        if (shouldBeScrolled !== navScrolled) {
            navScrolled = shouldBeScrolled;
            if (shouldBeScrolled) {
                nav.style.background = 'rgba(10, 10, 11, 0.9)';
                nav.style.backdropFilter = 'blur(10px)';
                nav.style.webkitBackdropFilter = 'blur(10px)';
            } else {
                nav.style.background = 'linear-gradient(to bottom, rgba(10, 10, 11, 1) 0%, transparent 100%)';
                nav.style.backdropFilter = 'none';
                nav.style.webkitBackdropFilter = 'none';
            }
        }
    }, { passive: true });

    // Prefetch blog page on hover
    const blogLink = document.querySelector('a[href="/blog"]');
    if (blogLink) {
        blogLink.addEventListener('mouseenter', () => {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = '/blog/';
            document.head.appendChild(link);
        }, { once: true });
    }
});
