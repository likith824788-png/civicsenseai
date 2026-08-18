import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { db } from '../lib/firebase'
import { doc, updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore'
import SeverityBadge, { StatusBadge, CategoryBadge } from './SeverityBadge'
import { getApiUrl } from '../lib/api'
import toast from 'react-hot-toast'

export default function ReportCard({ report, onUpvote, showAdminControls = false, onStatusChange, onClick }) {
  const { user } = useAuth()
  const [upvoting, setUpvoting] = useState(false)
  const [localUpvotes, setLocalUpvotes] = useState(report.upvotes || 0)
  const [hasUpvoted, setHasUpvoted] = useState(false)
  const [imgError, setImgError] = useState(false)

  // Check if current user has upvoted this report
  useEffect(() => {
    setLocalUpvotes(report.upvotes || 0)
    if (user && Array.isArray(report.upvoted_by) && report.upvoted_by.includes(user.uid)) {
      setHasUpvoted(true)
    } else {
      setHasUpvoted(false)
    }
  }, [report.upvotes, report.upvoted_by, user])

  const handleUpvote = async (e) => {
    if (e) e.stopPropagation()
    if (!user) {
      toast.error('Please sign in to upvote reports')
      return
    }

    if (upvoting) return
    setUpvoting(true)

    try {
      const reportRef = doc(db, 'reports', report.id)

      if (hasUpvoted) {
        // Toggle downvote
        setLocalUpvotes(prev => Math.max(0, prev - 1))
        setHasUpvoted(false)
        await updateDoc(reportRef, {
          upvotes: increment(-1),
          upvoted_by: arrayRemove(user.uid),
        })
        if (onUpvote) onUpvote(report.id, Math.max(0, localUpvotes - 1))
      } else {
        // Upvote
        setLocalUpvotes(prev => prev + 1)
        setHasUpvoted(true)
        await updateDoc(reportRef, {
          upvotes: increment(1),
          upvoted_by: arrayUnion(user.uid),
        })
        if (onUpvote) onUpvote(report.id, localUpvotes + 1)
      }
    } catch (err) {
      console.error('Upvote error:', err)
      // Fallback to server endpoint if client rule fails
      try {
        const token = await user.getIdToken()
        const res = await fetch(getApiUrl(`/api/reports/${report.id}/upvote`), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        })
        if (!res.ok) throw new Error('Server upvote failed')
      } catch (fallbackErr) {
        toast.error('Failed to upvote')
        setLocalUpvotes(report.upvotes || 0)
      }
    } finally {
      setUpvoting(false)
    }
  }

  const isOwner = user && user.uid === report.user_id
  const canManageStatus = showAdminControls || isOwner
  const isResolved = report.status === 'resolved'

  const handleLocalStatusChange = async (newStatus, e) => {
    if (e) e.stopPropagation()
    if (onStatusChange) {
      onStatusChange(report.id, newStatus)
      return
    }
    try {
      const reportRef = doc(db, 'reports', report.id)
      const updateData = {
        status: newStatus,
        ...(newStatus === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
      }
      await updateDoc(reportRef, updateData)
      toast.success(`Status updated to ${newStatus.toUpperCase()}`)
    } catch (err) {
      console.error('Status update error:', err)
      toast.error('Failed to update status')
    }
  }

  const isPopular = localUpvotes >= 10
  const timeAgo = getTimeAgo(report.created_at)

  return (
    <div
      onClick={() => onClick && onClick(report)}
      className={`glass-card rounded-2xl overflow-hidden transition-all duration-200 bg-zinc-950 border flex flex-col justify-between ${
        onClick ? 'cursor-pointer hover:scale-[1.01]' : ''
      } ${
        isResolved
          ? 'border-green-500/40 shadow-lg shadow-green-500/5'
          : isPopular
          ? 'popular-report'
          : 'border-zinc-800 hover:border-zinc-500'
      }`}
    >
      <div>
        {/* Image Container */}
        <div className="relative h-48 sm:h-56 w-full bg-zinc-900 overflow-hidden border-b border-zinc-800">
          {report.image_url && !imgError ? (
            <img
              src={report.image_url}
              alt={report.category}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-black flex items-center justify-center text-zinc-700">
              <span className="text-4xl">🏛️</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

          {/* Badges overlay */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <CategoryBadge category={report.category} />
              <SeverityBadge category={report.category} upvotes={localUpvotes} />
            </div>

            <div className="flex items-center gap-1.5">
              {isResolved && (
                <span className="px-2.5 py-1 rounded-md bg-green-500 text-black text-[10px] font-extrabold uppercase tracking-wider shadow-sm flex items-center gap-1">
                  ✓ Resolved
                </span>
              )}
              {isPopular && !isResolved && (
                <span className="px-2.5 py-1 rounded-md bg-white text-black text-[10px] font-extrabold uppercase tracking-wider shadow-sm">
                  🔥 Trending
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card Content Body */}
        <div className="p-4 sm:p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {report.description ? (
                <p className="text-zinc-200 text-xs sm:text-sm leading-relaxed line-clamp-2">
                  {report.description}
                </p>
              ) : (
                <p className="text-zinc-500 text-xs italic">No description provided</p>
              )}
            </div>
            <StatusBadge status={report.status} />
          </div>

          {/* Location & Time */}
          <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono pt-1">
            <span className="truncate max-w-[180px]">📍 {report.latitude?.toFixed(4)}, {report.longitude?.toFixed(4)}</span>
            <span className="text-zinc-500 shrink-0">{timeAgo}</span>
          </div>
        </div>
      </div>

      {/* Upvote & Actions Bar */}
      <div className="p-4 sm:p-5 pt-0">
        <div className="flex items-center justify-between pt-3 border-t border-zinc-900 gap-2">
          <button
            onClick={handleUpvote}
            disabled={upvoting}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              hasUpvoted
                ? 'bg-white text-black border border-white'
                : 'bg-zinc-900 text-zinc-300 hover:bg-white hover:text-black border border-zinc-700 hover:border-white'
            }`}
          >
            <span>{hasUpvoted ? '▲' : '△'}</span>
            <span>{localUpvotes}</span>
          </button>

          {/* Status Controls for Admin or Owner */}
          {canManageStatus && (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <select
                value={report.status}
                onChange={(e) => handleLocalStatusChange(e.target.value, e)}
                className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-xl text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-white"
              >
                <option value="pending">⏳ Pending</option>
                <option value="verified">🔍 Verified</option>
                <option value="in-progress">⚡ In Progress</option>
                <option value="resolved">✅ Resolved</option>
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getTimeAgo(dateString) {
  if (!dateString) return 'recently'
  const now = new Date()
  const date = new Date(dateString)
  const seconds = Math.floor((now - date) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return date.toLocaleDateString()
}
