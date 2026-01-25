/**
 * 3D Torus WebGL Background
 * Spinning torus with network traffic visualization (TPU cluster style)
 */

class TorusBackground {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl', { antialias: true, alpha: true }) ||
                  canvas.getContext('experimental-webgl', { antialias: true, alpha: true });

        if (!this.gl) {
            console.warn('WebGL not supported');
            return;
        }

        // Torus parameters
        this.torusR = 1.0;        // Major radius
        this.torusr = 0.35;       // Minor radius
        this.segments = 64;       // Segments around torus
        this.tubes = 32;          // Tubes in cross-section

        // Animation state
        this.time = 0;
        this.rotationX = 0;
        this.rotationY = 0;
        this.rotationZ = 0;

        // Mouse interaction
        this.mouse = { x: 0.5, y: 0.5 };
        this.targetMouse = { x: 0.5, y: 0.5 };

        // Speed tracking
        this.scrollY = 0;
        this.lastScrollY = 0;
        this.scrollVelocity = 0;
        this.mouseVelocity = 0;
        this.lastMouseX = 0.5;
        this.lastMouseY = 0.5;
        this.speedMultiplier = 1;
        this.targetSpeedMultiplier = 1;

        // Network traffic particles
        this.trafficParticles = [];
        this.particleCount = this.isMobile() ? 80 : 150;

        this.init();
    }

    isMobile() {
        return window.innerWidth < 768;
    }

    init() {
        this.resize();
        this.createTorusGeometry();
        this.createTrafficParticles();
        this.createShaders();
        this.bindEvents();
        this.animate();
    }

    createTorusGeometry() {
        const vertices = [];
        const indices = [];

        // Generate torus vertices
        for (let i = 0; i <= this.segments; i++) {
            const u = (i / this.segments) * Math.PI * 2;
            for (let j = 0; j <= this.tubes; j++) {
                const v = (j / this.tubes) * Math.PI * 2;

                const x = (this.torusR + this.torusr * Math.cos(v)) * Math.cos(u);
                const y = (this.torusR + this.torusr * Math.cos(v)) * Math.sin(u);
                const z = this.torusr * Math.sin(v);

                vertices.push(x, y, z);
            }
        }

        // Generate indices for wireframe lines
        for (let i = 0; i < this.segments; i++) {
            for (let j = 0; j < this.tubes; j++) {
                const a = i * (this.tubes + 1) + j;
                const b = a + this.tubes + 1;
                const c = a + 1;
                const d = b + 1;

                // Horizontal lines (around torus)
                indices.push(a, b);
                // Vertical lines (around tube)
                indices.push(a, c);
            }
        }

        this.torusVertices = new Float32Array(vertices);
        this.torusIndices = new Uint16Array(indices);
        this.vertexCount = vertices.length / 3;
        this.indexCount = indices.length;
    }

    createTrafficParticles() {
        this.trafficParticles = [];

        for (let i = 0; i < this.particleCount; i++) {
            this.trafficParticles.push({
                // Position on torus (u = around torus, v = around tube)
                u: Math.random() * Math.PI * 2,
                v: Math.random() * Math.PI * 2,
                // Movement direction
                dirU: (Math.random() > 0.5 ? 1 : -1) * (0.01 + Math.random() * 0.03),
                dirV: (Math.random() > 0.5 ? 1 : -1) * (0.005 + Math.random() * 0.015),
                // Trail length
                trailLength: 3 + Math.floor(Math.random() * 8),
                // Color hue (cyan to blue to purple range)
                hue: 0.5 + Math.random() * 0.3,
                // Alpha
                alpha: 0.6 + Math.random() * 0.4,
                // Size
                size: 1.5 + Math.random() * 2.5,
                // Speed variation
                speedVar: 0.5 + Math.random() * 1.0,
                // Phase offset for pulsing
                phase: Math.random() * Math.PI * 2
            });
        }
    }

    getTorusPoint(u, v, morphTime) {
        // Morphing effect - varies the radii over time
        const morphR = this.torusR + Math.sin(morphTime * 0.5 + u * 2) * 0.08 +
                       Math.sin(morphTime * 0.3 + v * 3) * 0.05;
        const morphr = this.torusr + Math.sin(morphTime * 0.7 + u * 3) * 0.03 +
                       Math.cos(morphTime * 0.4 + v * 2) * 0.02;

        const x = (morphR + morphr * Math.cos(v)) * Math.cos(u);
        const y = (morphR + morphr * Math.cos(v)) * Math.sin(u);
        const z = morphr * Math.sin(v);

        return { x, y, z };
    }

    createShaders() {
        const gl = this.gl;

        // Vertex shader for torus wireframe
        const torusVertexSource = `
            attribute vec3 a_position;
            uniform mat4 u_modelView;
            uniform mat4 u_projection;
            uniform float u_time;
            uniform float u_morph;

            varying float v_depth;
            varying float v_glow;

            void main() {
                // Apply morphing to vertices
                vec3 pos = a_position;
                float u = atan(pos.y, pos.x);
                float morphOffset = sin(u_time * 0.5 + u * 2.0) * 0.08 * u_morph;
                pos *= 1.0 + morphOffset;

                vec4 viewPos = u_modelView * vec4(pos, 1.0);
                gl_Position = u_projection * viewPos;

                // Depth for fading and glow
                v_depth = -viewPos.z;
                v_glow = sin(u_time * 2.0 + pos.x * 3.0 + pos.y * 3.0) * 0.5 + 0.5;
            }
        `;

        const torusFragmentSource = `
            precision mediump float;
            uniform float u_alpha;
            uniform vec3 u_color;
            varying float v_depth;
            varying float v_glow;

            void main() {
                float depthFade = smoothstep(4.0, 1.5, v_depth);
                float alpha = u_alpha * depthFade * (0.15 + v_glow * 0.1);
                vec3 color = u_color + vec3(v_glow * 0.1, v_glow * 0.15, v_glow * 0.2);
                gl_FragColor = vec4(color, alpha);
            }
        `;

        // Vertex shader for traffic particles
        const particleVertexSource = `
            attribute vec3 a_position;
            attribute float a_alpha;
            attribute float a_size;
            attribute float a_hue;

            uniform mat4 u_modelView;
            uniform mat4 u_projection;
            uniform float u_time;

            varying float v_alpha;
            varying float v_hue;
            varying float v_depth;

            void main() {
                vec4 viewPos = u_modelView * vec4(a_position, 1.0);
                gl_Position = u_projection * viewPos;
                gl_PointSize = a_size * (3.0 / -viewPos.z) * 40.0;

                v_alpha = a_alpha;
                v_hue = a_hue;
                v_depth = -viewPos.z;
            }
        `;

        const particleFragmentSource = `
            precision mediump float;
            varying float v_alpha;
            varying float v_hue;
            varying float v_depth;

            vec3 hsv2rgb(vec3 c) {
                vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }

            void main() {
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);

                // Soft glowing point
                float alpha = smoothstep(0.5, 0.0, dist) * v_alpha;
                float glow = smoothstep(0.5, 0.1, dist);

                // Depth fade
                float depthFade = smoothstep(4.0, 1.5, v_depth);

                vec3 color = hsv2rgb(vec3(v_hue, 0.7, 1.0));
                color = mix(color, vec3(1.0), glow * 0.4);

                gl_FragColor = vec4(color, alpha * depthFade);
            }
        `;

        // Compile torus program
        this.torusProgram = this.createProgram(torusVertexSource, torusFragmentSource);
        this.torusLocations = {
            position: gl.getAttribLocation(this.torusProgram, 'a_position'),
            modelView: gl.getUniformLocation(this.torusProgram, 'u_modelView'),
            projection: gl.getUniformLocation(this.torusProgram, 'u_projection'),
            time: gl.getUniformLocation(this.torusProgram, 'u_time'),
            morph: gl.getUniformLocation(this.torusProgram, 'u_morph'),
            alpha: gl.getUniformLocation(this.torusProgram, 'u_alpha'),
            color: gl.getUniformLocation(this.torusProgram, 'u_color')
        };

        // Compile particle program
        this.particleProgram = this.createProgram(particleVertexSource, particleFragmentSource);
        this.particleLocations = {
            position: gl.getAttribLocation(this.particleProgram, 'a_position'),
            alpha: gl.getAttribLocation(this.particleProgram, 'a_alpha'),
            size: gl.getAttribLocation(this.particleProgram, 'a_size'),
            hue: gl.getAttribLocation(this.particleProgram, 'a_hue'),
            modelView: gl.getUniformLocation(this.particleProgram, 'u_modelView'),
            projection: gl.getUniformLocation(this.particleProgram, 'u_projection'),
            time: gl.getUniformLocation(this.particleProgram, 'u_time')
        };

        // Create buffers
        this.torusVertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.torusVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.torusVertices, gl.STATIC_DRAW);

        this.torusIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.torusIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.torusIndices, gl.STATIC_DRAW);

        this.particlePositionBuffer = gl.createBuffer();
        this.particleAlphaBuffer = gl.createBuffer();
        this.particleSizeBuffer = gl.createBuffer();
        this.particleHueBuffer = gl.createBuffer();
    }

    createProgram(vertexSource, fragmentSource) {
        const gl = this.gl;

        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link failed:', gl.getProgramInfoLog(program));
            return null;
        }

        return program;
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

        window.addEventListener('scroll', () => {
            this.scrollY = window.scrollY;
        }, { passive: true });

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

        this.aspect = this.canvas.width / this.canvas.height;
    }

    updateVelocity() {
        const scrollDelta = Math.abs(this.scrollY - this.lastScrollY);
        this.scrollVelocity = scrollDelta * 0.1;
        this.lastScrollY = this.scrollY;

        const mouseDeltaX = Math.abs(this.mouse.x - this.lastMouseX);
        const mouseDeltaY = Math.abs(this.mouse.y - this.lastMouseY);
        this.mouseVelocity = (mouseDeltaX + mouseDeltaY) * 5;
        this.lastMouseX = this.mouse.x;
        this.lastMouseY = this.mouse.y;

        const combinedVelocity = this.scrollVelocity + this.mouseVelocity;
        this.targetSpeedMultiplier = 1 + Math.min(combinedVelocity * 3, 4);

        this.speedMultiplier += (this.targetSpeedMultiplier - this.speedMultiplier) * 0.08;
        this.targetSpeedMultiplier += (1 - this.targetSpeedMultiplier) * 0.02;
    }

    updateTrafficParticles() {
        const speed = this.speedMultiplier;
        const morphTime = this.time * 0.01;

        for (let p of this.trafficParticles) {
            // Move particle along torus surface
            p.u += p.dirU * speed * p.speedVar;
            p.v += p.dirV * speed * p.speedVar;

            // Wrap around
            if (p.u > Math.PI * 2) p.u -= Math.PI * 2;
            if (p.u < 0) p.u += Math.PI * 2;
            if (p.v > Math.PI * 2) p.v -= Math.PI * 2;
            if (p.v < 0) p.v += Math.PI * 2;

            // Occasionally change direction (simulate routing)
            if (Math.random() < 0.001 * speed) {
                p.dirU = (Math.random() > 0.5 ? 1 : -1) * (0.01 + Math.random() * 0.03);
            }
            if (Math.random() < 0.002 * speed) {
                p.dirV = (Math.random() > 0.5 ? 1 : -1) * (0.005 + Math.random() * 0.015);
            }

            // Get 3D position
            const pos = this.getTorusPoint(p.u, p.v, morphTime);
            p.x = pos.x;
            p.y = pos.y;
            p.z = pos.z;

            // Pulse alpha
            p.currentAlpha = p.alpha * (0.6 + Math.sin(this.time * 0.05 + p.phase) * 0.4);
            p.currentAlpha *= (0.7 + speed * 0.3);
        }
    }

    mat4Multiply(a, b) {
        const result = new Float32Array(16);
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                result[i * 4 + j] =
                    a[i * 4 + 0] * b[0 * 4 + j] +
                    a[i * 4 + 1] * b[1 * 4 + j] +
                    a[i * 4 + 2] * b[2 * 4 + j] +
                    a[i * 4 + 3] * b[3 * 4 + j];
            }
        }
        return result;
    }

    mat4Perspective(fov, aspect, near, far) {
        const f = 1.0 / Math.tan(fov / 2);
        return new Float32Array([
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (far + near) / (near - far), -1,
            0, 0, (2 * far * near) / (near - far), 0
        ]);
    }

    mat4RotateX(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return new Float32Array([
            1, 0, 0, 0,
            0, c, s, 0,
            0, -s, c, 0,
            0, 0, 0, 1
        ]);
    }

    mat4RotateY(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return new Float32Array([
            c, 0, -s, 0,
            0, 1, 0, 0,
            s, 0, c, 0,
            0, 0, 0, 1
        ]);
    }

    mat4RotateZ(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return new Float32Array([
            c, s, 0, 0,
            -s, c, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);
    }

    mat4Translate(x, y, z) {
        return new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            x, y, z, 1
        ]);
    }

    getModelViewMatrix() {
        const speed = this.speedMultiplier;

        // Base rotation speeds
        this.rotationX += 0.003 * speed;
        this.rotationY += 0.005 * speed;
        this.rotationZ += 0.002 * speed;

        // Mouse influence on rotation
        const mouseInfluenceX = (this.mouse.y - 0.5) * 0.5;
        const mouseInfluenceY = (this.mouse.x - 0.5) * 0.5;

        // Create transformation matrices
        const translate = this.mat4Translate(0, 0, -3.0);
        const rotX = this.mat4RotateX(this.rotationX + mouseInfluenceX);
        const rotY = this.mat4RotateY(this.rotationY + mouseInfluenceY);
        const rotZ = this.mat4RotateZ(this.rotationZ);

        // Combine transformations
        let modelView = this.mat4Multiply(translate, rotZ);
        modelView = this.mat4Multiply(modelView, rotY);
        modelView = this.mat4Multiply(modelView, rotX);

        return modelView;
    }

    render() {
        const gl = this.gl;

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.disable(gl.DEPTH_TEST);

        const projection = this.mat4Perspective(Math.PI / 4, this.aspect, 0.1, 100);
        const modelView = this.getModelViewMatrix();
        const morphTime = this.time * 0.01;

        // Render torus wireframe
        gl.useProgram(this.torusProgram);

        gl.uniformMatrix4fv(this.torusLocations.projection, false, projection);
        gl.uniformMatrix4fv(this.torusLocations.modelView, false, modelView);
        gl.uniform1f(this.torusLocations.time, this.time * 0.01);
        gl.uniform1f(this.torusLocations.morph, this.speedMultiplier);
        gl.uniform1f(this.torusLocations.alpha, 0.4 + this.speedMultiplier * 0.1);
        gl.uniform3f(this.torusLocations.color, 0.2, 0.4, 0.8);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.torusVertexBuffer);
        gl.enableVertexAttribArray(this.torusLocations.position);
        gl.vertexAttribPointer(this.torusLocations.position, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.torusIndexBuffer);
        gl.drawElements(gl.LINES, this.indexCount, gl.UNSIGNED_SHORT, 0);

        // Render traffic particles
        gl.useProgram(this.particleProgram);

        gl.uniformMatrix4fv(this.particleLocations.projection, false, projection);
        gl.uniformMatrix4fv(this.particleLocations.modelView, false, modelView);
        gl.uniform1f(this.particleLocations.time, this.time * 0.01);

        // Prepare particle data with trails
        const positions = [];
        const alphas = [];
        const sizes = [];
        const hues = [];

        for (let p of this.trafficParticles) {
            // Main particle
            positions.push(p.x, p.y, p.z);
            alphas.push(p.currentAlpha);
            sizes.push(p.size);
            hues.push(p.hue);

            // Trail particles
            for (let t = 1; t < p.trailLength; t++) {
                const trailU = p.u - p.dirU * t * 2;
                const trailV = p.v - p.dirV * t * 2;
                const trailPos = this.getTorusPoint(trailU, trailV, morphTime);

                positions.push(trailPos.x, trailPos.y, trailPos.z);
                alphas.push(p.currentAlpha * (1 - t / p.trailLength) * 0.6);
                sizes.push(p.size * (1 - t / p.trailLength * 0.5));
                hues.push(p.hue + t * 0.02);
            }
        }

        // Update particle buffers
        gl.bindBuffer(gl.ARRAY_BUFFER, this.particlePositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.particleLocations.position);
        gl.vertexAttribPointer(this.particleLocations.position, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.particleAlphaBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(alphas), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.particleLocations.alpha);
        gl.vertexAttribPointer(this.particleLocations.alpha, 1, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.particleSizeBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sizes), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.particleLocations.size);
        gl.vertexAttribPointer(this.particleLocations.size, 1, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.particleHueBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(hues), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.particleLocations.hue);
        gl.vertexAttribPointer(this.particleLocations.hue, 1, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.POINTS, 0, positions.length / 3);
    }

    animate() {
        this.time++;

        // Smooth mouse interpolation
        this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.08;
        this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.08;

        this.updateVelocity();
        this.updateTrafficParticles();
        this.render();

        requestAnimationFrame(() => this.animate());
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('webgl-canvas');
    if (canvas) {
        new TorusBackground(canvas);
    }
});
