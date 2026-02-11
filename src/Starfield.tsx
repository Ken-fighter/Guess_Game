import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  twinkleSpeed: number;
  twinklePhase: number;
  vx: number;
  vy: number;
}

interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  opacity: number;
  life: number;
  maxLife: number;
}

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    // Create stars
    const starCount = Math.floor((width * height) / 3000);
    const stars: Star[] = [];
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 0.3,
        opacity: Math.random() * 0.7 + 0.3,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
        vx: (Math.random() - 0.5) * 0.05,
        vy: (Math.random() - 0.5) * 0.03,
      });
    }

    // Shooting stars
    const shootingStars: ShootingStar[] = [];
    let shootingTimer = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener('resize', resize);

    let time = 0;
    const animate = () => {
      time += 1;
      ctx.clearRect(0, 0, width, height);

      // Deep space gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#050a18');
      gradient.addColorStop(0.3, '#0a0f2e');
      gradient.addColorStop(0.6, '#0d1233');
      gradient.addColorStop(1, '#080c20');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Subtle nebula glow
      const nebulaX = width * 0.7;
      const nebulaY = height * 0.3;
      const nebulaR = Math.min(width, height) * 0.4;
      const nebula = ctx.createRadialGradient(nebulaX, nebulaY, 0, nebulaX, nebulaY, nebulaR);
      nebula.addColorStop(0, 'rgba(88, 28, 135, 0.08)');
      nebula.addColorStop(0.5, 'rgba(67, 56, 202, 0.04)');
      nebula.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, width, height);

      const nebula2X = width * 0.2;
      const nebula2Y = height * 0.7;
      const nebula2 = ctx.createRadialGradient(nebula2X, nebula2Y, 0, nebula2X, nebula2Y, nebulaR * 0.6);
      nebula2.addColorStop(0, 'rgba(6, 78, 130, 0.06)');
      nebula2.addColorStop(0.5, 'rgba(30, 64, 175, 0.03)');
      nebula2.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = nebula2;
      ctx.fillRect(0, 0, width, height);

      // Draw stars
      for (const star of stars) {
        star.x += star.vx;
        star.y += star.vy;
        if (star.x < 0) star.x = width;
        if (star.x > width) star.x = 0;
        if (star.y < 0) star.y = height;
        if (star.y > height) star.y = 0;

        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinklePhase);
        const currentOpacity = star.opacity * (0.5 + 0.5 * twinkle);

        // Star glow
        if (star.size > 1.2) {
          const glowGradient = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.size * 4);
          glowGradient.addColorStop(0, `rgba(180, 200, 255, ${currentOpacity * 0.3})`);
          glowGradient.addColorStop(1, 'rgba(180, 200, 255, 0)');
          ctx.fillStyle = glowGradient;
          ctx.fillRect(star.x - star.size * 4, star.y - star.size * 4, star.size * 8, star.size * 8);
        }

        // Star core
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        const colorChoice = star.twinklePhase > 4 ? '200, 220, 255' : star.twinklePhase > 2 ? '255, 240, 220' : '220, 230, 255';
        ctx.fillStyle = `rgba(${colorChoice}, ${currentOpacity})`;
        ctx.fill();
      }

      // Shooting stars
      shootingTimer += 1;
      if (shootingTimer > 200 + Math.random() * 300) {
        shootingTimer = 0;
        const angle = Math.PI * 0.15 + Math.random() * Math.PI * 0.2;
        shootingStars.push({
          x: Math.random() * width * 0.8,
          y: Math.random() * height * 0.3,
          length: 80 + Math.random() * 120,
          speed: 4 + Math.random() * 6,
          angle,
          opacity: 0.8 + Math.random() * 0.2,
          life: 0,
          maxLife: 40 + Math.random() * 30,
        });
      }

      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        ss.life += 1;
        ss.x += Math.cos(ss.angle) * ss.speed;
        ss.y += Math.sin(ss.angle) * ss.speed;

        const progress = ss.life / ss.maxLife;
        const fadeOpacity = progress < 0.3 ? progress / 0.3 : 1 - (progress - 0.3) / 0.7;
        const currentOp = ss.opacity * fadeOpacity;

        const tailX = ss.x - Math.cos(ss.angle) * ss.length;
        const tailY = ss.y - Math.sin(ss.angle) * ss.length;

        const trailGradient = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
        trailGradient.addColorStop(0, `rgba(255, 255, 255, 0)`);
        trailGradient.addColorStop(0.7, `rgba(200, 220, 255, ${currentOp * 0.5})`);
        trailGradient.addColorStop(1, `rgba(255, 255, 255, ${currentOp})`);

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(ss.x, ss.y);
        ctx.strokeStyle = trailGradient;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Head glow
        const headGlow = ctx.createRadialGradient(ss.x, ss.y, 0, ss.x, ss.y, 6);
        headGlow.addColorStop(0, `rgba(255, 255, 255, ${currentOp})`);
        headGlow.addColorStop(1, `rgba(200, 220, 255, 0)`);
        ctx.fillStyle = headGlow;
        ctx.fillRect(ss.x - 6, ss.y - 6, 12, 12);

        if (ss.life >= ss.maxLife) {
          shootingStars.splice(i, 1);
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ zIndex: 0 }}
    />
  );
}
