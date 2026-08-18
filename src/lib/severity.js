/**
 * Severity Score (rule-based v1)
 *
 * Calculates a severity level based on category + upvote count.
 * This is NOT ML-based — it's a simple heuristic for the MVP.
 */

const CATEGORY_BASE_SCORES = {
  'Water Leakage': 5,
  'Damaged Infrastructure': 4,
  'Pothole': 3,
  'Garbage/Waste Overflow': 2,
  'Other': 1,
}

/**
 * @param {string} category - The report category
 * @param {number} upvotes - The current upvote count
 * @returns {{ score: number, level: 'low' | 'medium' | 'high', label: string }}
 */
export function calculateSeverity(category, upvotes = 0) {
  const baseScore = CATEGORY_BASE_SCORES[category] || 1
  const upvoteBonus = Math.min(Math.floor(upvotes / 5), 3) // +1 per 5 upvotes, capped at +3
  const totalScore = baseScore + upvoteBonus

  let level, label
  if (totalScore >= 7) {
    level = 'high'
    label = 'High'
  } else if (totalScore >= 4) {
    level = 'medium'
    label = 'Medium'
  } else {
    level = 'low'
    label = 'Low'
  }

  return { score: totalScore, level, label }
}

/**
 * Get the Tailwind classes for a severity level
 */
export function getSeverityClasses(level) {
  switch (level) {
    case 'high':
      return 'bg-red-500/20 text-red-400 border-red-500/30'
    case 'medium':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    case 'low':
      return 'bg-green-500/20 text-green-400 border-green-500/30'
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }
}

/**
 * Category color mapping for map pins and badges
 */
export const CATEGORY_COLORS = {
  'Pothole': '#f59e0b',           // amber
  'Garbage/Waste Overflow': '#22c55e', // green
  'Water Leakage': '#3b82f6',     // blue
  'Damaged Infrastructure': '#ef4444', // red
  'Other': '#8b5cf6',              // purple
}

export const CATEGORY_ICONS = {
  'Pothole': '🕳️',
  'Garbage/Waste Overflow': '🗑️',
  'Water Leakage': '💧',
  'Damaged Infrastructure': '🏗️',
  'Other': '📋',
}

export const STATUS_OPTIONS = ['pending', 'verified', 'in-progress', 'resolved']

export const ALL_CATEGORIES = [
  'Pothole',
  'Garbage/Waste Overflow',
  'Water Leakage',
  'Damaged Infrastructure',
  'Other',
]
