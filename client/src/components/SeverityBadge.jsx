import { calculateSeverity, CATEGORY_ICONS } from '../lib/severity'

export default function SeverityBadge({ category, upvotes }) {
  const { level, label } = calculateSeverity(category, upvotes)

  const badges = {
    high: 'bg-white text-black font-extrabold border-white',
    medium: 'bg-zinc-800 text-white font-semibold border-zinc-600',
    low: 'bg-zinc-900 text-zinc-400 font-medium border-zinc-800',
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] uppercase tracking-wider border ${badges[level] || badges.low}`}>
      {level === 'high' && '🔥 '}
      {label} Severity
    </span>
  )
}

export function StatusBadge({ status }) {
  const labels = {
    pending: '⏳ Pending',
    verified: '🔍 Verified',
    'in-progress': '⚡ In Progress',
    resolved: '✅ Resolved',
  }

  return (
    <span className={`status-${status} inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide`}>
      {labels[status] || status}
    </span>
  )
}

export function CategoryBadge({ category }) {
  const icon = CATEGORY_ICONS[category] || '📋'
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-black/80 text-white border border-zinc-700 backdrop-blur-md">
      {icon} {category}
    </span>
  )
}
