/**
 * Custom Topology Effect
 * A recreation of the Vanta.js topology effect without external dependencies
 */

(function() {
    'use strict';

    // Default configuration
    var defaults = {
        el: null,
        color: 0x3b82f6,
        backgroundColor: 0x0a0a0b,
        points: 12,
        maxDistance: 150,
        spacing: 120,
        showDots: false
    };

    // Convert hex number to CSS color
    function hexToRgb(hex) {
        var r = (hex >> 16) & 255;
        var g = (hex >> 8) & 255;
        var b = hex & 255;
        return { r: r, g: g, b: b };
    }

    function rgbToCss(rgb, alpha) {
        if (alpha !== undefined) {
            return 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + alpha + ')';
        }
        return 'rgb(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ')';
    }

    // Point class
    function Point(x, y, canvasWidth, canvasHeight) {
        this.x = x;
        this.y = y;
        this.originX = x;
        this.originY = y;
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;

        // Phase for sinusoidal movement - slow, smooth flowing animation
        this.phase = Math.random() * Math.PI * 2;
        this.phaseY = Math.random() * Math.PI * 2;
        this.amplitude = 25 + Math.random() * 35;
        this.amplitudeY = 25 + Math.random() * 35;
        this.frequency = 0.00015 + Math.random() * 0.0001;
        this.frequencyY = 0.0001 + Math.random() * 0.00008;
    }

    Point.prototype.update = function(time) {
        // Slow, smooth sinusoidal movement for flowing effect
        this.x = this.originX + Math.sin(time * this.frequency + this.phase) * this.amplitude;
        this.y = this.originY + Math.cos(time * this.frequencyY + this.phaseY) * this.amplitudeY;
    };

    // Main Topology class
    function Topology(options) {
        this.options = {};
        for (var key in defaults) {
            this.options[key] = options[key] !== undefined ? options[key] : defaults[key];
        }

        this.el = typeof this.options.el === 'string'
            ? document.querySelector(this.options.el)
            : this.options.el;

        if (!this.el) {
            console.error('Topology: Element not found');
            return;
        }

        this.color = hexToRgb(this.options.color);
        this.backgroundColor = hexToRgb(this.options.backgroundColor);
        this.points = [];
        this.animationId = null;
        this.isRunning = false;
        this.startTime = Date.now();

        this.init();
    }

    Topology.prototype.init = function() {
        // Create canvas
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');

        // Style canvas
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none';

        this.el.appendChild(this.canvas);

        // Set size
        this.resize();

        // Create points
        this.createPoints();

        // Start animation
        this.start();

        // Bind resize handler
        this.handleResize = this.resize.bind(this);
        this.resizeStableWidth = window.innerWidth;
    };

    Topology.prototype.resize = function() {
        var rect = this.el.getBoundingClientRect();
        var dpr = window.devicePixelRatio || 1;

        this.width = rect.width;
        this.height = rect.height;

        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;

        this.ctx.scale(dpr, dpr);

        // Recreate points on resize
        this.createPoints();
    };

    Topology.prototype.createPoints = function() {
        this.points = [];

        var spacing = this.options.spacing;
        var cols = Math.ceil(this.width / spacing) + 1;
        var rows = Math.ceil(this.height / spacing) + 1;

        // Create a grid of points with randomness for organic feel
        for (var i = 0; i < cols; i++) {
            for (var j = 0; j < rows; j++) {
                // Add more variance to point positions for natural look
                var x = i * spacing + (Math.random() - 0.5) * spacing * 0.7;
                var y = j * spacing + (Math.random() - 0.5) * spacing * 0.7;
                this.points.push(new Point(x, y, this.width, this.height));
            }
        }
    };

    Topology.prototype.start = function() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.animate();
    };

    Topology.prototype.stop = function() {
        this.isRunning = false;
        if (this.animationId) {
            window.cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    };

    Topology.prototype.animate = function() {
        if (!this.isRunning) return;

        var time = Date.now() - this.startTime;

        // Clear canvas
        this.ctx.fillStyle = rgbToCss(this.backgroundColor);
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Update points
        for (var i = 0; i < this.points.length; i++) {
            this.points[i].update(time);
        }

        // Draw connections
        this.drawConnections();

        // Draw points
        if (this.options.showDots) {
            this.drawPoints();
        }

        this.animationId = window.requestAnimationFrame(this.animate.bind(this));
    };

    Topology.prototype.drawConnections = function() {
        var maxDist = this.options.maxDistance;
        var maxDistSq = maxDist * maxDist;

        this.ctx.lineWidth = 1;
        this.ctx.lineCap = 'round';

        for (var i = 0; i < this.points.length; i++) {
            var p1 = this.points[i];

            for (var j = i + 1; j < this.points.length; j++) {
                var p2 = this.points[j];

                var dx = p2.x - p1.x;
                var dy = p2.y - p1.y;
                var distSq = dx * dx + dy * dy;

                if (distSq < maxDistSq) {
                    var dist = Math.sqrt(distSq);
                    var opacity = 1 - (dist / maxDist);
                    // Quadratic falloff for visible but subtle lines
                    opacity = opacity * opacity * 0.6;

                    this.ctx.strokeStyle = rgbToCss(this.color, opacity);
                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.stroke();
                }
            }
        }
    };

    Topology.prototype.drawPoints = function() {
        this.ctx.fillStyle = rgbToCss(this.color, 0.8);

        for (var i = 0; i < this.points.length; i++) {
            var p = this.points[i];
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
            this.ctx.fill();
        }
    };

    Topology.prototype.destroy = function() {
        this.stop();
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        this.canvas = null;
        this.ctx = null;
        this.points = [];
    };

    // Export to window
    window.TOPOLOGY = function(options) {
        return new Topology(options);
    };

})();
