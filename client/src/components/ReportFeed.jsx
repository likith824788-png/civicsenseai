import { useState, useEffect } from 'react'
import { db } from '../lib/firebase'
import {
  collection,
  query,
  limit,
  onSnapshot,
} from 'firebase/firestore'
import ReportCard from './ReportCard'
import { ALL_CATEGORIES, STATUS_OPTIONS } from '../lib/severity'
import { getApiUrl } from '../lib/api'

export default function ReportFeed() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('newest') // 'newest' | 'upvotes'
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedReport, setSelectedReport] = useState(null)

  useEffect(() => {
    setLoading(true)

    // Fetch reports with simple query — filter and sort client-side
    // to avoid needing composite indexes for every filter/sort combination
    const q = query(collection(db, 'reports'), limit(100))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
      }))

      // Client-side category filter
      if (filterCategory !== 'all') {
        data = data.filter(r => r.category === filterCategory)
      }

      // Client-side status filter
      if (filterStatus === 'unresolved') {
        data = data.filter(r => r.status !== 'resolved')
      } else if (filterStatus !== 'all') {
        data = data.filter(r => r.status === filterStatus)
      }

      // Client-side sort
      if (sortBy === 'upvotes') {
        data.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0))
      } else {
        data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      }

      setReports(data)
      setLoading(false)
    }, (error) => {
      console.error('Error fetching reports:', error)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [sortBy, filterCategory, filterStatus])

  const handleUpvote = (reportId, newCount) => {
    setReports(prev =>
      prev.map(r => r.id === reportId ? { ...r, upvotes: newCount } : r)
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Community Feed</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Explore & upvote civic reports in your neighborhood</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs sm:text-sm font-semibold text-white focus:outline-none focus:ring-1 focus:ring-white"
          >
            <option value="newest">Newest First</option>
            <option value="upvotes">Most Upvoted</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs sm:text-sm font-semibold text-white focus:outline-none focus:ring-1 focus:ring-white"
          >
            <option value="all">All Statuses</option>
            <option value="unresolved">⚡ Unresolved / Active</option>
            <option value="resolved">✅ Resolved</option>
            <option value="in-progress">⚡ In Progress</option>
            <option value="verified">🔍 Verified</option>
            <option value="pending">⏳ Pending</option>
          </select>

          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs sm:text-sm font-semibold text-white focus:outline-none focus:ring-1 focus:ring-white"
          >
            <option value="all">All Categories</option>
            {ALL_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Report Grid / List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <svg className="animate-spin h-8 w-8 text-white" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-xs text-zinc-400">Loading feed...</span>
        </div>
      ) : reports.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center border border-zinc-800 bg-zinc-950 space-y-3 max-w-md mx-auto">
          <span className="text-4xl block">🏙️</span>
          <h3 className="text-lg font-bold text-white">No Reports Yet</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Be the first to report a civic issue or click below to populate sample reports!
          </p>
          <a
            href={getApiUrl('/api/seed')}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-2 px-4 py-2 bg-white text-black font-semibold text-xs rounded-xl hover:bg-zinc-200 transition-colors shadow-md"
          >
            🌱 Add 5 Sample Reports
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 stagger-children">
          {reports.map(report => (
            <ReportCard
              key={report.id}
              report={report}
              onUpvote={handleUpvote}
              onClick={(r) => setSelectedReport(r)}
            />
          ))}
        </div>
      )}

      {/* Modal for selected report in Feed */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in-up">
          <div className="glass-card rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-zinc-700 bg-zinc-950 p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-start justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedReport.category}</h3>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">{new Date(selectedReport.created_at).toLocaleString()}</p>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="p-1.5 rounded-xl bg-zinc-900 hover:bg-white hover:text-black text-zinc-400 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {selectedReport.image_url && (
              <img
                src={selectedReport.image_url}
                alt={selectedReport.category}
                className="w-full h-64 object-cover rounded-xl border border-zinc-800"
              />
            )}

            <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800 space-y-1">
              <p className="text-[10px] uppercase font-bold text-zinc-400">Description</p>
              <p className="text-xs text-zinc-200">{selectedReport.description || 'No description provided.'}</p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-zinc-400 font-mono">📍 {selectedReport.latitude?.toFixed(4)}, {selectedReport.longitude?.toFixed(4)}</span>
              <button
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 bg-white text-black font-bold text-xs rounded-xl hover:bg-zinc-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
