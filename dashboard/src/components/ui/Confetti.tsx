/** A short burst of colour for a right answer. Pure CSS, hidden for people who ask for less motion. */
const PIECES = Array.from({ length: 28 }, (_, i) => ({ left: (i * 37) % 100, delay: (i % 7) * 60, hue: i % 5, size: 6 + (i % 4) * 2, drift: ((i * 53) % 60) - 30 }));

export default function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {PIECES.map((p, i) => <i key={i} data-hue={p.hue} style={{ left: `${p.left}%`, width: p.size, height: p.size * 1.6, animationDelay: `${p.delay}ms`, ['--drift' as string]: `${p.drift}px` }} />)}
    </div>
  );
}
