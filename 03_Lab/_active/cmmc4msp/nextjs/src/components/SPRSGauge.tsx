'use client'
import { useEffect, useState } from 'react'

const MIN_SCORE = -203
const MAX_SCORE = 110
const TOTAL_RANGE = MAX_SCORE - MIN_SCORE // 313

function scoreToAngle(score: number): number {
  const clamped = Math.max(MIN_SCORE, Math.min(MAX_SCORE, score))
  const pct = (clamped - MIN_SCORE) / TOTAL_RANGE
  return pct * 180 // 0 to 180 degrees
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 180) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle)
  const end = polarToCartesian(cx, cy, r, endAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

function getGaugeColor(score: number): string {
  if (score < 0) return '#dc2626'
  if (score < 70) return '#f59e0b'
  return '#16a34a'
}

export function SPRSGauge({ score }: { score: number }) {
  const [displayAngle, setDisplayAngle] = useState(0)
  const targetAngle = scoreToAngle(score)
  const cx = 110
  const cy = 100
  const r = 80

  useEffect(() => {
    const timer = setTimeout(() => setDisplayAngle(targetAngle), 50)
    return () => clearTimeout(timer)
  }, [targetAngle])

  const color = getGaugeColor(score)

  // Background arc: full 0-180
  const bgPath = arcPath(cx, cy, r, 0, 180)
  // Zone arcs
  const redEnd = scoreToAngle(0)
  const amberEnd = scoreToAngle(70)
  const greenEnd = 180

  const redPath = arcPath(cx, cy, r, 0, redEnd)
  const amberPath = arcPath(cx, cy, r, redEnd, amberEnd)
  const greenPath = arcPath(cx, cy, r, amberEnd, greenEnd)

  // Needle
  const needleEnd = polarToCartesian(cx, cy, r - 10, displayAngle)
  const needleBase1 = polarToCartesian(cx, cy, 8, displayAngle + 90)
  const needleBase2 = polarToCartesian(cx, cy, 8, displayAngle - 90)

  return (
    <div className="flex flex-col items-center">
      <svg width="220" height="130" viewBox="0 0 220 130">
        {/* Background track */}
        <path d={bgPath} fill="none" stroke="#e5e7eb" strokeWidth="18" strokeLinecap="round" />
        {/* Colored zones */}
        <path d={redPath} fill="none" stroke="#fca5a5" strokeWidth="18" strokeLinecap="butt" />
        <path
          d={amberPath}
          fill="none"
          stroke="#fde68a"
          strokeWidth="18"
          strokeLinecap="butt"
        />
        <path
          d={greenPath}
          fill="none"
          stroke="#bbf7d0"
          strokeWidth="18"
          strokeLinecap="butt"
        />
        {/* Active arc */}
        <path
          d={arcPath(cx, cy, r, 0, displayAngle)}
          fill="none"
          stroke={color}
          strokeWidth="18"
          strokeLinecap="butt"
          style={{ transition: 'all 0.8s ease-out' }}
        />
        {/* Needle */}
        <polygon
          points={`${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y} ${needleEnd.x},${needleEnd.y}`}
          fill={color}
          style={{ transition: 'all 0.8s ease-out' }}
        />
        <circle cx={cx} cy={cy} r="6" fill="#374151" />
        {/* Score text */}
        <text
          x={cx}
          y={cy + 28}
          textAnchor="middle"
          fontSize="28"
          fontWeight="bold"
          fill={color}
        >
          {score}
        </text>
        <text x={cx} y={cy + 44} textAnchor="middle" fontSize="12" fill="#6b7280">
          / 110
        </text>
        {/* Min/Max labels */}
        <text x="18" y="115" fontSize="10" fill="#9ca3af">
          -203
        </text>
        <text x="185" y="115" fontSize="10" fill="#9ca3af">
          110
        </text>
      </svg>
      <p className="text-sm font-medium text-gray-500 -mt-2">SPRS Score</p>
    </div>
  )
}
