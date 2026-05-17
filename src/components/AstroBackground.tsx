import { memo } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Star, MoonStar, Orbit } from 'lucide-react';

type AstroBackgroundProps = {
  className?: string;
};

const STARS = [
  { left: '8%', top: '14%', delay: 0 },
  { left: '15%', top: '72%', delay: 1.6 },
  { left: '24%', top: '28%', delay: 0.8 },
  { left: '41%', top: '18%', delay: 2.2 },
  { left: '58%', top: '70%', delay: 1.2 },
  { left: '67%', top: '24%', delay: 0.4 },
  { left: '79%', top: '58%', delay: 1.9 },
  { left: '88%', top: '20%', delay: 0.6 },
  { left: '92%', top: '76%', delay: 2.5 },
  { left: '49%', top: '84%', delay: 1.1 },
  { left: '33%', top: '64%', delay: 2.8 },
  { left: '71%', top: '44%', delay: 1.4 },
];

const SYMBOLS = [
  { icon: Sparkles, left: '12%', top: '22%', delay: 0.5 },
  { icon: Star, left: '78%', top: '18%', delay: 1.3 },
  { icon: MoonStar, left: '86%', top: '62%', delay: 2 },
  { icon: Orbit, left: '20%', top: '78%', delay: 0.9 },
];

function AstroBackground({ className = '' }: AstroBackgroundProps) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.1),transparent_28%),linear-gradient(180deg,rgba(5,5,8,0.96),rgba(5,5,8,0.86))]" />

      <motion.div
        className="absolute -left-16 top-10 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl"
        animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute right-0 top-1/3 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl"
        animate={{ x: [0, -24, 0], y: [0, 18, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />

      {STARS.map((star, index) => (
        <motion.span
          key={`${star.left}-${star.top}`}
          className="absolute rounded-full bg-white/70 shadow-[0_0_12px_rgba(255,255,255,0.35)]"
          style={{ left: star.left, top: star.top, width: index % 3 === 0 ? 4 : 2, height: index % 3 === 0 ? 4 : 2 }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [1, 1.6, 1], y: [0, -8, 0] }}
          transition={{ duration: 3 + (index % 4), delay: star.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {SYMBOLS.map((symbol) => {
        const Icon = symbol.icon;

        return (
          <motion.div
            key={`${symbol.left}-${symbol.top}`}
            className="absolute text-indigo-300/20"
            style={{ left: symbol.left, top: symbol.top }}
            animate={{ opacity: [0.12, 0.3, 0.12], y: [0, -10, 0], rotate: [0, 6, 0] }}
            transition={{ duration: 8, delay: symbol.delay, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Icon size={36} />
          </motion.div>
        );
      })}
    </div>
  );
}

export default memo(AstroBackground);