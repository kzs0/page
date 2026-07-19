/**
 * Main JavaScript for the background and light site interactions.
 */

const initTopologyBackground = () => {
    const background = document.querySelector('#vanta-bg');

    if (!background || !window.VANTA?.TOPOLOGY || !window.p5) {
        return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let active = null;
    let renderBounds = null;
    let resizeTimer = null;

    const getRenderBounds = () => {
        const availableWidth = Math.max(
            window.screen?.availWidth || 0,
            window.screen?.width || 0,
            window.innerWidth
        );
        const availableHeight = Math.max(
            window.screen?.availHeight || 0,
            window.screen?.height || 0,
            window.innerHeight
        );
        const overscan = window.innerWidth <= 768 ? 1.12 : 1.16;

        return {
            width: Math.ceil(availableWidth * overscan),
            height: Math.ceil(availableHeight * overscan)
        };
    };

    const destroyLayer = (layer) => {
        if (!layer) return;

        window.removeEventListener('resize', layer.effect.resize);
        layer.effect.destroy();
        layer.element.remove();
    };

    const buildLayer = () => {
        const nextBounds = getRenderBounds();
        const layer = document.createElement('div');
        const previous = active;

        layer.className = 'vanta-surface';
        layer.style.width = `${nextBounds.width}px`;
        layer.style.height = `${nextBounds.height}px`;
        background.appendChild(layer);

        const effect = window.VANTA.TOPOLOGY({
            el: layer,
            mouseControls: false,
            touchControls: false,
            gyroControls: false,
            minHeight: nextBounds.height,
            minWidth: nextBounds.width,
            scale: 1,
            scaleMobile: 1,
            color: 0x3b82f6,
            backgroundColor: 0x0a0a0b
        });

        // Vanta normally resizes its canvas on every viewport change. This
        // surface is larger than the available display, so the browser can
        // crop it without asking p5 to recreate the canvas.
        window.removeEventListener('resize', effect.resize);

        if (effect.p5?.pixelDensity) {
            // The topology is an ambient texture, so a single device pixel is
            // enough even on Retina screens and avoids an oversized backing
            // canvas on mobile.
            effect.p5.pixelDensity(1);
            effect.resize();
            window.removeEventListener('resize', effect.resize);
        }

        active = { element: layer, effect };
        renderBounds = nextBounds;

        window.requestAnimationFrame(() => {
            layer.classList.add('is-visible');
            background.classList.add('has-live-effect');
        });

        if (previous) {
            previous.element.classList.remove('is-visible');
            window.setTimeout(() => destroyLayer(previous), 950);
        }
    };

    const checkBuffer = () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
            if (!renderBounds || reduceMotion.matches) return;

            const needsLargerSurface =
                window.innerWidth > renderBounds.width * 0.92 ||
                window.innerHeight > renderBounds.height * 0.92;

            if (needsLargerSurface) {
                buildLayer();
            }
        }, 500);
    };

    const syncMotionPreference = () => {
        if (reduceMotion.matches) {
            destroyLayer(active);
            active = null;
            renderBounds = null;
            background.classList.remove('has-live-effect');
            return;
        }

        if (!active) {
            buildLayer();
        }
    };

    const teardown = () => {
        window.clearTimeout(resizeTimer);
        window.removeEventListener('resize', checkBuffer);
        reduceMotion.removeEventListener?.('change', syncMotionPreference);
        destroyLayer(active);
        active = null;
        renderBounds = null;
        background.classList.remove('has-live-effect');
    };

    syncMotionPreference();
    window.addEventListener('resize', checkBuffer, { passive: true });
    reduceMotion.addEventListener?.('change', syncMotionPreference);

    window.addEventListener('pagehide', (event) => {
        if (!event.persisted) {
            teardown();
        }
    });
};

document.addEventListener('DOMContentLoaded', () => {
    initTopologyBackground();

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
