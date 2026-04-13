// Confetti Burst Simulation
const canvas = document.getElementById('confetti-canvas');
const ctx = canvas.getContext('2d');

let particles = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = Math.random() * 8 + 4;
    this.speedX = Math.random() * 16 - 8;
    this.speedY = Math.random() * -15 - 5;
    this.color = `hsl(${Math.random() * 360}, 90%, 60%)`;
    this.gravity = 0.4;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = Math.random() * 10 - 5;
    this.opacity = 1;
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.speedY += this.gravity;
    this.rotation += this.rotationSpeed;
    this.opacity -= 0.01;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    ctx.restore();
  }
}

function triggerConfetti(originX = window.innerWidth / 2, originY = window.innerHeight / 2) {
  const count = 100;
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(originX, originY));
  }
}

function animateConfetti() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  for (let i = 0; i < particles.length; i++) {
    particles[i].update();
    particles[i].draw();
    
    if (particles[i].opacity <= 0 || particles[i].y > canvas.height) {
      particles.splice(i, 1);
      i--;
    }
  }
  
  requestAnimationFrame(animateConfetti);
}

animateConfetti();

// Expose globally
window.celebrate = triggerConfetti;
