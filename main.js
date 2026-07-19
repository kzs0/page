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
        if (!layer || layer.destroyed) return;

        layer.destroyed = true;
        window.cancelAnimationFrame(layer.readyFrame);
        window.clearTimeout(layer.revealTimer);
        window.clearTimeout(layer.destroyTimer);
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

        const next = {
            element: layer,
            effect,
            bounds: nextBounds,
            destroyed: false,
            readyFrame: null,
            revealTimer: null,
            destroyTimer: null
        };

        active = next;
        renderBounds = nextBounds;

        const revealWhenReady = (attempt = 0) => {
            if (next.destroyed) return;

            const p5Instance = effect.p5;
            const p5Ready = p5Instance &&
                typeof p5Instance === 'object' &&
                typeof p5Instance.pixelDensity === 'function';

            if (!p5Ready) {
                if (attempt < 120) {
                    next.readyFrame = window.requestAnimationFrame(() => revealWhenReady(attempt + 1));
                    return;
                }

                if (active === next) {
                    active = previous || null;
                    renderBounds = previous?.bounds || null;
                }
                destroyLayer(next);
                return;
            }

            // Vanta exposes a boolean p5 placeholder before the actual p5
            // instance is ready. Waiting for the instance makes this density
            // correction reliable in Safari as well as Chromium.
            p5Instance.pixelDensity(1);
            effect.resize();
            window.removeEventListener('resize', effect.resize);

            next.revealTimer = window.setTimeout(() => {
                if (next.destroyed) return;

                layer.classList.add('is-visible');
                background.classList.add('has-live-effect');

                if (previous) {
                    previous.element.classList.remove('is-visible');
                    previous.destroyTimer = window.setTimeout(() => destroyLayer(previous), 950);
                }
            }, 200);
        };

        revealWhenReady();
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
