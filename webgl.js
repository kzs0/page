/**
 * Enhanced WebGL background effect
 * Flowing cloud-like animation that responds to scroll and mouse movement
 */

class WebGLBackground {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (!this.gl) {
            console.warn('WebGL not supported');
            return;
        }

        this.mouse = { x: 0.5, y: 0.5 };
        this.targetMouse = { x: 0.5, y: 0.5 };
        this.time = 0;
        this.particles = [];
        this.particleCount = this.isMobile() ? 100 : 200;

        // Movement tracking for speed boost
        this.scrollY = 0;
        this.lastScrollY = 0;
        this.scrollVelocity = 0;
        this.mouseVelocity = 0;
        this.lastMouseX = 0.5;
        this.lastMouseY = 0.5;
        this.speedMultiplier = 1;
        this.targetSpeedMultiplier = 1;

        this.init();
    }

    isMobile() {
        return window.innerWidth < 768;
    }

    init() {
        this.resize();
        this.createShaders();
        this.createParticles();
        this.createFlowField();
        this.bindEvents();
        this.animate();
    }

    createShaders() {
        const gl = this.gl;

        // Vertex shader for particles
        const vertexSource = `
            attribute vec2 a_position;
            attribute float a_size;
            attribute float a_alpha;
            attribute float a_hue;

            uniform vec2 u_resolution;
            uniform float u_time;
            uniform vec2 u_mouse;
            uniform float u_speed;

            varying float v_alpha;
            varying float v_hue;

            void main() {
                vec2 pos = a_position;

                // Enhanced mouse influence with speed
                vec2 mouseInfluence = u_mouse - pos;
                float dist = length(mouseInfluence);
                float influence = smoothstep(0.5, 0.0, dist) * 0.08 * u_speed;
                pos -= normalize(mouseInfluence) * influence;

                // Convert to clip space
                vec2 clipSpace = (pos * 2.0) - 1.0;

                gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
                gl_PointSize = a_size * (0.8 + u_speed * 0.4);
                v_alpha = a_alpha;
                v_hue = a_hue;
            }
        `;

        // Fragment shader with gradient coloring
        const fragmentSource = `
            precision mediump float;

            varying float v_alpha;
            varying float v_hue;

            vec3 hsv2rgb(vec3 c) {
                vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }

            void main() {
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);

                // Soft glow effect
                float alpha = smoothstep(0.5, 0.0, dist) * v_alpha;
                float glow = smoothstep(0.5, 0.2, dist) * 0.5;

                // Dynamic color based on hue
                vec3 color = hsv2rgb(vec3(v_hue, 0.3, 0.95));
                color = mix(color, vec3(1.0), glow * 0.3);

                gl_FragColor = vec4(color, alpha * 0.35);
            }
        `;

        // Compile shaders
        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);

        // Create program
        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            console.error('Program link failed:', gl.getProgramInfoLog(this.program));
            return;
        }

        gl.useProgram(this.program);

        // Get locations
        this.locations = {
            position: gl.getAttribLocation(this.program, 'a_position'),
            size: gl.getAttribLocation(this.program, 'a_size'),
            alpha: gl.getAttribLocation(this.program, 'a_alpha'),
            hue: gl.getAttribLocation(this.program, 'a_hue'),
            resolution: gl.getUniformLocation(this.program, 'u_resolution'),
            time: gl.getUniformLocation(this.program, 'u_time'),
            mouse: gl.getUniformLocation(this.program, 'u_mouse'),
            speed: gl.getUniformLocation(this.program, 'u_speed')
        };
    }

    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile failed:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    createParticles() {
        const gl = this.gl;

        for (let i = 0; i < this.particleCount; i++) {
            const baseHue = 0.55 + Math.random() * 0.15; // Blue to cyan range
            this.particles.push({
                x: Math.random(),
                y: Math.random(),
                baseX: Math.random(),
                baseY: Math.random(),
                size: Math.random() * 4 + 2,
                alpha: Math.random() * 0.6 + 0.3,
                speed: Math.random() * 0.0005 + 0.0002,
                offset: Math.random() * Math.PI * 2,
                noiseOffset: Math.random() * 1000,
                hue: baseHue,
                baseHue: baseHue
            });
        }

        // Create buffers
        this.positionBuffer = gl.createBuffer();
        this.sizeBuffer = gl.createBuffer();
        this.alphaBuffer = gl.createBuffer();
        this.hueBuffer = gl.createBuffer();
    }

    createFlowField() {
        // Flow field for organic movement
        this.flowFieldSize = 20;
        this.flowField = [];
        for (let i = 0; i < this.flowFieldSize * this.flowFieldSize; i++) {
            this.flowField.push({
                angle: Math.random() * Math.PI * 2,
                strength: Math.random() * 0.5 + 0.5
            });
        }
    }

    getFlowAt(x, y, time) {
        const gridX = Math.floor(x * (this.flowFieldSize - 1));
        const gridY = Math.floor(y * (this.flowFieldSize - 1));
        const idx = gridY * this.flowFieldSize + gridX;

        if (idx >= 0 && idx < this.flowField.length) {
            const flow = this.flowField[idx];
            // Animate the flow angle over time
            const animatedAngle = flow.angle + Math.sin(time * 0.0003 + idx * 0.1) * 0.5;
            return {
                x: Math.cos(animatedAngle) * flow.strength,
                y: Math.sin(animatedAngle) * flow.strength
            };
        }
        return { x: 0, y: 0 };
    }

    // Simplex-like noise for organic movement
    noise(x, y, t) {
        const n1 = Math.sin(x * 12.9898 + y * 78.233 + t * 0.5) * 43758.5453;
        const n2 = Math.sin(x * 39.346 + y * 11.135 + t * 0.3) * 27934.4328;
        return ((n1 - Math.floor(n1)) + (n2 - Math.floor(n2))) * 0.5;
    }

    bindEvents() {
        window.addEventListener('resize', () => this.resize());

        // Mouse tracking
        document.addEventListener('mousemove', (e) => {
            this.targetMouse.x = e.clientX / window.innerWidth;
            this.targetMouse.y = e.clientY / window.innerHeight;
        });

        document.addEventListener('mouseleave', () => {
            this.targetMouse.x = 0.5;
            this.targetMouse.y = 0.5;
        });

        // Scroll tracking
        window.addEventListener('scroll', () => {
            this.scrollY = window.scrollY;
        }, { passive: true });

        // Touch tracking for mobile
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                this.targetMouse.x = e.touches[0].clientX / window.innerWidth;
                this.targetMouse.y = e.touches[0].clientY / window.innerHeight;
            }
        }, { passive: true });
    }

    resize() {
        const dpr = Math.min(window.devicePixelRatio, 2);
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.canvas.style.width = window.innerWidth + 'px';
        this.canvas.style.height = window.innerHeight + 'px';

        if (this.gl) {
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    updateVelocity() {
        // Calculate scroll velocity
        const scrollDelta = Math.abs(this.scrollY - this.lastScrollY);
        this.scrollVelocity = scrollDelta * 0.1;
        this.lastScrollY = this.scrollY;

        // Calculate mouse velocity
        const mouseDeltaX = Math.abs(this.mouse.x - this.lastMouseX);
        const mouseDeltaY = Math.abs(this.mouse.y - this.lastMouseY);
        this.mouseVelocity = (mouseDeltaX + mouseDeltaY) * 5;
        this.lastMouseX = this.mouse.x;
        this.lastMouseY = this.mouse.y;

        // Combined velocity for speed multiplier
        const combinedVelocity = this.scrollVelocity + this.mouseVelocity;
        this.targetSpeedMultiplier = 1 + Math.min(combinedVelocity * 3, 4);

        // Smooth interpolation of speed multiplier
        this.speedMultiplier += (this.targetSpeedMultiplier - this.speedMultiplier) * 0.08;

        // Decay back to normal
        this.targetSpeedMultiplier += (1 - this.targetSpeedMultiplier) * 0.02;
    }

    updateParticles() {
        const time = this.time;
        const speed = this.speedMultiplier;

        for (let p of this.particles) {
            // Get flow field influence
            const flow = this.getFlowAt(p.x, p.y, time);

            // Organic noise-based movement enhanced by speed
            const noiseVal = this.noise(p.x * 3, p.y * 3, time * 0.001);
            const noiseX = Math.sin(time * p.speed * 15 * speed + p.offset + noiseVal * 6.28) * 0.025;
            const noiseY = Math.cos(time * p.speed * 12 * speed + p.offset * 1.3 + noiseVal * 3.14) * 0.025;

            // Flow field contribution
            const flowX = flow.x * 0.0008 * speed;
            const flowY = flow.y * 0.0008 * speed;

            // Gentle drift with flow
            const driftX = Math.sin(time * 0.0002 * speed + p.offset) * 0.06;
            const driftY = Math.cos(time * 0.00015 * speed + p.offset) * 0.06;

            // Update position
            p.x = p.baseX + noiseX + driftX + flowX;
            p.y = p.baseY + noiseY + driftY + flowY;

            // Slowly update base position for continuous movement
            p.baseX += (Math.random() - 0.5) * 0.0002 * speed;
            p.baseY += (Math.random() - 0.5) * 0.0002 * speed;

            // Wrap around edges smoothly
            if (p.x < -0.1) { p.x = 1.1; p.baseX = 1.1; }
            if (p.x > 1.1) { p.x = -0.1; p.baseX = -0.1; }
            if (p.y < -0.1) { p.y = 1.1; p.baseY = 1.1; }
            if (p.y > 1.1) { p.y = -0.1; p.baseY = -0.1; }

            // Dynamic pulsing alpha enhanced by speed
            const pulseSpeed = 0.002 * speed;
            p.currentAlpha = p.alpha * (0.6 + Math.sin(time * pulseSpeed + p.offset) * 0.4);

            // Speed boost makes particles brighter
            p.currentAlpha *= (0.7 + speed * 0.3);

            // Shift hue slightly based on speed and position
            p.currentHue = p.baseHue + Math.sin(time * 0.0005 + p.x * 2) * 0.05 * speed;
        }
    }

    render() {
        const gl = this.gl;

        // Clear with slight trail effect
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Enable blending for glow effect
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

        // Update uniforms
        gl.uniform2f(this.locations.resolution, this.canvas.width, this.canvas.height);
        gl.uniform1f(this.locations.time, this.time);
        gl.uniform2f(this.locations.mouse, this.mouse.x, this.mouse.y);
        gl.uniform1f(this.locations.speed, this.speedMultiplier);

        // Prepare data
        const positions = [];
        const sizes = [];
        const alphas = [];
        const hues = [];

        for (let p of this.particles) {
            positions.push(p.x, p.y);
            sizes.push(p.size * (window.devicePixelRatio || 1));
            alphas.push(p.currentAlpha || p.alpha);
            hues.push(p.currentHue || p.hue);
        }

        // Update position buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.locations.position);
        gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 0, 0);

        // Update size buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sizes), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.locations.size);
        gl.vertexAttribPointer(this.locations.size, 1, gl.FLOAT, false, 0, 0);

        // Update alpha buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.alphaBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(alphas), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.locations.alpha);
        gl.vertexAttribPointer(this.locations.alpha, 1, gl.FLOAT, false, 0, 0);

        // Update hue buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.hueBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(hues), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.locations.hue);
        gl.vertexAttribPointer(this.locations.hue, 1, gl.FLOAT, false, 0, 0);

        // Draw particles
        gl.drawArrays(gl.POINTS, 0, this.particleCount);
    }

    animate() {
        this.time++;

        // Smooth mouse interpolation
        this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.08;
        this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.08;

        // Update velocity tracking
        this.updateVelocity();

        this.updateParticles();
        this.render();

        requestAnimationFrame(() => this.animate());
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('webgl-canvas');
    if (canvas) {
        new WebGLBackground(canvas);
    }
});
