import { motion } from 'motion/react';

interface KundliChartProps {
  houses: string[];
  planets: { name: string; house: number }[];
}

export default function KundliChart({ houses, planets }: KundliChartProps) {
  // North Indian Chart logic
  // The chart consists of 12 regions (houses)
  // House 1 is the top-center diamond
  
  const width = 400;
  const height = 400;

  const getPlanetsInHouse = (houseIndex: number) => {
    // Planets index from calculation might be 1-based, we map house 1 to index 0
    return planets.filter(p => p.house === houseIndex + 1);
  };

  return (
    <div className="relative w-full max-w-[500px] aspect-square mx-auto p-4 bg-[#0c0c16] rounded-3xl border border-slate-800 backdrop-blur-md shadow-2xl group">
      <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl pointer-events-none"></div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full drop-shadow-[0_0_15px_rgba(99,102,241,0.1)]">
        {/* Diamond Chart Framework */}
        <rect x="0" y="0" width={width} height={height} fill="transparent" stroke="rgba(71,85,105,0.4)" strokeWidth="1" />
        
        {/* Main Diagonals */}
        <line x1="0" y1="0" x2={width} y2={height} stroke="rgba(71,85,105,0.4)" strokeWidth="2" />
        <line x1={width} y1="0" x2="0" y2={height} stroke="rgba(71,85,105,0.4)" strokeWidth="2" />
        
        {/* Inscribed Diamond */}
        <polygon 
          points={`${width / 2},0 ${width},${height / 2} ${width / 2},${height} 0,${height / 2}`} 
          fill="none" 
          stroke="rgba(71,85,105,0.4)" 
          strokeWidth="2" 
        />

        {/* House Labels and Planets */}
        <HouseContent x={width/2} y={height/4} label={houses[0]} planets={getPlanetsInHouse(0)} main /> {/* H1 */}
        <HouseContent x={width/4} y={height/8} label={houses[1]} planets={getPlanetsInHouse(1)} /> {/* H2 */}
        <HouseContent x={width/8} y={height/4} label={houses[2]} planets={getPlanetsInHouse(2)} /> {/* H3 */}
        <HouseContent x={width/4} y={height/2} label={houses[3]} planets={getPlanetsInHouse(3)} /> {/* H4 */}
        <HouseContent x={width/8} y={3*height/4} label={houses[4]} planets={getPlanetsInHouse(4)} /> {/* H5 */}
        <HouseContent x={width/4} y={7*height/8} label={houses[5]} planets={getPlanetsInHouse(5)} /> {/* H6 */}
        <HouseContent x={width/2} y={3*height/4} label={houses[6]} planets={getPlanetsInHouse(6)} /> {/* H7 */}
        <HouseContent x={3*width/4} y={7*height/8} label={houses[7]} planets={getPlanetsInHouse(7)} /> {/* H8 */}
        <HouseContent x={7*width/8} y={3*height/4} label={houses[8]} planets={getPlanetsInHouse(8)} /> {/* H9 */}
        <HouseContent x={3*width/4} y={height/2} label={houses[9]} planets={getPlanetsInHouse(9)} /> {/* H10 */}
        <HouseContent x={7*width/8} y={height/4} label={houses[10]} planets={getPlanetsInHouse(10)} /> {/* H11 */}
        <HouseContent x={3*width/4} y={height/8} label={houses[11]} planets={getPlanetsInHouse(11)} /> {/* H12 */}
      </svg>
    </div>
  );
}

function HouseContent({ x, y, label, planets, main }: { x: number, y: number, label: string, planets: any[], main?: boolean }) {
  return (
    <g>
      <text 
        x={x} 
        y={y} 
        textAnchor="middle" 
        fill={main ? "rgba(129,140,248,0.9)" : "rgba(148,163,184,0.6)"} 
        fontSize={main ? "16" : "12"} 
        fontWeight={main ? "bold" : "medium"} 
        className="select-none font-sans"
      >
        {label}
      </text>
      {planets.map((p, i) => (
        <text
          key={`${p.name}-${i}`}
          x={x}
          y={y + 15 + (i * 12)}
          textAnchor="middle"
          fill="#cbd5e1"
          fontSize="10"
          className="select-none font-mono"
        >
          {p.name.substring(0, 2)}
        </text>
      ))}
    </g>
  );
}
