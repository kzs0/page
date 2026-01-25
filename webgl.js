/**
 * Subtle WebGL background effect
 * Creates an elegant particle field with noise-based movement
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
        this.particleCount = this.isMobile() ? 80 : 150;

        this.init();
    }

    isMobile() {
        return window.innerWidth < 768;
    }

    init() {
        this.resize();
        this.createShaders();
        this.createParticles();
        this.bindEvents();
        this.animate();
    }

    createShaders() {
        const gl = this.gl;

        // Vertex shader
        const vertexSource = `
            attribute vec2 a_position;
            attribute float a_size;
            attribute float a_alpha;

            uniform vec2 u_resolution;
            uniform float u_time;
            uniform vec2 u_mouse;

            varying float v_alpha;

            void main() {
                vec2 pos = a_position;

                // Subtle mouse influence
                vec2 mouseInfluence = u_mouse - pos;
                float dist = length(mouseInfluence);
                float influence = smoothstep(0.4, 0.0, dist) * 0.03;
                pos += normalize(mouseInfluence) * influence;

                // Convert to clip space
                vec2 clipSpace = (pos * 2.0) - 1.0;

                gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
                gl_PointSize = a_size;
                v_alpha = a_alpha;
            }
        `;

        // Fragment shader
        const fragmentSource = `
            precision mediump float;

            varying float v_alpha;

            void main() {
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);

                // Soft circular gradient
                float alpha = smoothstep(0.5, 0.1, dist) * v_alpha;

                // Subtle blue-white tint
                vec3 color = mix(
                    vec3(0.4, 0.5, 0.7),
                    vec3(0.9, 0.92, 0.95),
                    smoothstep(0.3, 0.0, dist)
                );

                gl_FragColor = vec4(color, alpha * 0.15);
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
            resolution: gl.getUniformLocation(this.program, 'u_resolution'),
            time: gl.getUniformLocation(this.program, 'u_time'),
            mouse: gl.getUniformLocation(this.program, 'u_mouse')
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
            this.particles.push({
                x: Math.random(),
                y: Math.random(),
                baseX: Math.random(),
                baseY: Math.random(),
                size: Math.random() * 3 + 1,
                alpha: Math.random() * 0.5 + 0.2,
                speed: Math.random() * 0.0003 + 0.0001,
                offset: Math.random() * Math.PI * 2
            });
        }

        // Create buffers
        this.positionBuffer = gl.createBuffer();
        this.sizeBuffer = gl.createBuffer();
        this.alphaBuffer = gl.createBuffer();
    }

    bindEvents() {
        window.addEventListener('resize', () => this.resize());

        document.addEventListener('mousemove', (e) => {
            this.targetMouse.x = e.clientX / window.innerWidth;
            this.targetMouse.y = e.clientY / window.innerHeight;
        });

        document.addEventListener('mouseleave', () => {
            this.targetMouse.x = 0.5;
            this.targetMouse.y = 0.5;
        });
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

    // Simple noise function
    noise(x, y, t) {
        const n = Math.sin(x * 12.9898 + y * 78.233 + t) * 43758.5453;
        return n - Math.floor(n);
    }

    updateParticles() {
        const time = this.time;

        for (let p of this.particles) {
            // Smooth noise-based movement
            const noiseX = Math.sin(time * p.speed * 10 + p.offset) * 0.02;
            const noiseY = Math.cos(time * p.speed * 8 + p.offset * 1.5) * 0.02;

            // Gentle drift
            p.x = p.baseX + noiseX + Math.sin(time * 0.0001 + p.offset) * 0.05;
            p.y = p.baseY + noiseY + Math.cos(time * 0.00008 + p.offset) * 0.05;

            // Keep in bounds with wrapping
            if (p.x < -0.1) p.x = 1.1;
            if (p.x > 1.1) p.x = -0.1;
            if (p.y < -0.1) p.y = 1.1;
            if (p.y > 1.1) p.y = -0.1;

            // Subtle pulsing
            p.currentAlpha = p.alpha * (0.7 + Math.sin(time * 0.001 + p.offset) * 0.3);
        }
    }

    render() {
        const gl = this.gl;

        // Clear
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Enable blending
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // Update uniforms
        gl.uniform2f(this.locations.resolution, this.canvas.width, this.canvas.height);
        gl.uniform1f(this.locations.time, this.time);
        gl.uniform2f(this.locations.mouse, this.mouse.x, this.mouse.y);

        // Prepare data
        const positions = [];
        const sizes = [];
        const alphas = [];

        for (let p of this.particles) {
            positions.push(p.x, p.y);
            sizes.push(p.size * (window.devicePixelRatio || 1));
            alphas.push(p.currentAlpha || p.alpha);
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

        // Draw
        gl.drawArrays(gl.POINTS, 0, this.particleCount);
    }

    animate() {
        this.time++;

        // Smooth mouse interpolation
        this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.05;
        this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.05;

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
