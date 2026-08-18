import { useState, useEffect } from 'react'
import { db, auth } from '../lib/firebase'
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
} from 'firebase/firestore'
import MapView from './MapView'
import ReportCard from './ReportCard'
import { ALL_CATEGORIES, STATUS_OPTIONS, CATEGORY_ICONS } from '../lib/severity'
import { getApiUrl } from '../lib/api'
import toast from 'react-hot-toast'

export default function AdminDashboard() {
  const [allReports, setAllReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState(null)
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [viewMode, setViewMode] = useState('map') // 'map' | 'table' | 'cards'
  const [selectedReport, setSelectedReport] = useState(null)

  useEffect(() => {
    setLoading(true)
    setErrorMessage(null)

    // Fetch all reports real-time
    const q = query(collection(db, 'reports'))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          created_at: doc.data().created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
        }))

        // Sort by newest first
        data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

        setAllReports(data)
        setLoading(false)
      },
      (error) => {
        console.error('Firestore Admin query error:', error)
        setErrorMessage(error.message || 'Failed to load reports')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  const handleStatusChange = async (reportId, newStatus) => {
    try {
      // 1. Instantly update Firestore directly
      const reportRef = doc(db, 'reports', reportId)
      const updateData = {
        status: newStatus,
        ...(newStatus === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
      }
      await updateDoc(reportRef, updateData)

      // Optimistically update local state
      setAllReports(prev =>
        prev.map(r => r.id === reportId ? { ...r, ...updateData } : r)
      )
      toast.success(`Status updated to "${newStatus.toUpperCase()}"`)

      // 2. Asynchronously notify backend API (for email triggers) without blocking UI
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : ''
        fetch(getApiUrl(`/api/reports/${reportId}/status`), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        }).catch(e => console.log('Backend notification note:', e.message))
      } catch (backendErr) {
        console.warn('Backend notification skipped:', backendErr.message)
      }
    } catch (err) {
      console.error('Status change error:', err)
      toast.error(err.message || 'Failed to update status')
    }
  }

  // Derive filtered reports dynamically from allReports
  const filteredReports = allReports.filter(r => {
    const matchesCategory = filterCategory === 'all' || r.category === filterCategory
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus
    return matchesCategory && matchesStatus
  })

  // Analytics derived from complete allReports dataset
  const totalReports = allReports.length
  const pendingCount = allReports.filter(r => r.status === 'pending').length
  const verifiedCount = allReports.filter(r => r.status === 'verified').length
  const inProgressCount = allReports.filter(r => r.status === 'in-progress').length
  const resolvedCount = allReports.filter(r => r.status === 'resolved').length

  const categoryCounts = ALL_CATEGORIES.map(cat => ({
    category: cat,
    count: allReports.filter(r => r.category === cat).length,
    icon: CATEGORY_ICONS[cat],
  }))

  return (
    <div className="w-full space-y-6 animate-fade-in-up">
      {/* Page Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Authority Dashboard</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Real-time civic issue monitoring & management</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={getApiUrl('/api/seed')}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-1.5 bg-white text-black hover:bg-zinc-200 text-xs font-semibold rounded-lg transition-all shadow-sm flex items-center gap-1.5"
          >
            🌱 Add Sample Reports
          </a>
        </div>
      </div>

      {/* Analytics Cards — Clickable Quick-Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setFilterStatus('all')}
          className={`glass-card rounded-2xl p-4 text-left transition-all cursor-pointer ${
            filterStatus === 'all'
              ? 'border-white bg-zinc-900 ring-2 ring-white/20'
              : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
          }`}
        >
          <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{totalReports}</p>
          <p className="text-xs font-medium text-zinc-400 mt-1 uppercase tracking-wider">
            Total {filterStatus === 'all' ? '●' : ''}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending')}
          className={`glass-card rounded-2xl p-4 text-left transition-all cursor-pointer ${
            filterStatus === 'pending'
              ? 'border-white bg-zinc-900 ring-2 ring-white/20'
              : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
          }`}
        >
          <p className="text-2xl sm:text-3xl font-extrabold text-zinc-200 tracking-tight">{pendingCount}</p>
          <p className="text-xs font-medium text-zinc-400 mt-1 uppercase tracking-wider">
            Pending {filterStatus === 'pending' ? '●' : ''}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'verified' ? 'all' : 'verified')}
          className={`glass-card rounded-2xl p-4 text-left transition-all cursor-pointer ${
            filterStatus === 'verified'
              ? 'border-white bg-zinc-900 ring-2 ring-white/20'
              : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
          }`}
        >
          <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{verifiedCount}</p>
          <p className="text-xs font-medium text-zinc-400 mt-1 uppercase tracking-wider">
            Verified {filterStatus === 'verified' ? '●' : ''}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'in-progress' ? 'all' : 'in-progress')}
          className={`glass-card rounded-2xl p-4 text-left transition-all cursor-pointer ${
            filterStatus === 'in-progress'
              ? 'border-yellow-400 bg-yellow-950/20 ring-2 ring-yellow-400/30'
              : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
          }`}
        >
          <p className="text-2xl sm:text-3xl font-extrabold text-yellow-400 tracking-tight">{inProgressCount}</p>
          <p className="text-xs font-medium text-yellow-200/80 mt-1 uppercase tracking-wider">
            In Progress {filterStatus === 'in-progress' ? '●' : ''}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'resolved' ? 'all' : 'resolved')}
          className={`glass-card rounded-2xl p-4 text-left transition-all cursor-pointer col-span-2 sm:col-span-1 ${
            filterStatus === 'resolved'
              ? 'border-green-400 bg-green-950/20 ring-2 ring-green-400/30'
              : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
          }`}
        >
          <p className="text-2xl sm:text-3xl font-extrabold text-green-400 tracking-tight">{resolvedCount}</p>
          <p className="text-xs font-medium text-green-300 mt-1 uppercase tracking-wider">
            Resolved {filterStatus === 'resolved' ? '●' : ''}
          </p>
        </button>
      </div>

      {/* Category Breakdown */}
      <div className="glass-card rounded-2xl p-4 sm:p-5 border border-zinc-800 bg-zinc-950">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Category Overview</h3>
          {filterCategory !== 'all' && (
            <button
              onClick={() => setFilterCategory('all')}
              className="text-xs text-zinc-400 hover:text-white underline"
            >
              Reset Category Filter
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {categoryCounts.map(({ category, count, icon }) => (
            <button
              key={category}
              type="button"
              onClick={() => setFilterCategory(filterCategory === category ? 'all' : category)}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left cursor-pointer ${
                filterCategory === category
                  ? 'bg-zinc-800 border-white border ring-1 ring-white/20'
                  : 'bg-zinc-900 border border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-zinc-800 text-white flex items-center justify-center text-sm border border-zinc-700">
                {icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-white leading-none">{count}</p>
                <p className="text-[11px] text-zinc-400 truncate mt-0.5">{category}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Controls & Filter Bar — Mobile & Desktop Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950 p-3 rounded-2xl border border-zinc-800">
        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs sm:text-sm font-medium text-white focus:outline-none focus:ring-1 focus:ring-white"
          >
            <option value="all">All Categories</option>
            {ALL_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs sm:text-sm font-medium text-white focus:outline-none focus:ring-1 focus:ring-white"
          >
            <option value="all">All Statuses</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          {(filterCategory !== 'all' || filterStatus !== 'all') && (
            <button
              onClick={() => { setFilterCategory('all'); setFilterStatus('all') }}
              className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800"
            >
              ✕ Clear Filters
            </button>
          )}
        </div>

        {/* View Mode Toggle Buttons */}
        <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 self-end sm:self-auto">
          {[
            { key: 'map', icon: '🗺️', label: 'Map' },
            { key: 'table', icon: '📊', label: 'Table' },
            { key: 'cards', icon: '🃏', label: 'Cards' },
          ].map(v => (
            <button
              key={v.key}
              onClick={() => setViewMode(v.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === v.key
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {v.icon} {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Views */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <svg className="animate-spin h-8 w-8 text-white" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-xs text-zinc-400">Loading reports...</span>
        </div>
      ) : errorMessage ? (
        <div className="glass-card rounded-2xl p-6 sm:p-8 text-center border border-zinc-700 bg-zinc-950 max-w-xl mx-auto space-y-3">
          <span className="text-3xl block">⚠️</span>
          <h3 className="text-lg font-bold text-white">Cloud Firestore Notice</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('API')
              ? 'Firestore database API needs to be enabled in Firebase Console. Go to Firebase Console → Build → Firestore Database → Create Database.'
              : errorMessage}
          </p>
          <a
            href="https://console.firebase.google.com"
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-2 px-4 py-2 bg-white text-black font-semibold text-xs rounded-xl hover:bg-zinc-200 transition-colors"
          >
            Open Firebase Console
          </a>
        </div>
      ) : (
        <div>
          {/* Map View */}
          {viewMode === 'map' && (
            <div className="w-full rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950">
              <MapView
                reports={filteredReports}
                height="550px"
                onReportClick={(r) => setSelectedReport(r)}
                onStatusChange={handleStatusChange}
              />
            </div>
          )}

          {/* Table View — Responsive Overflow */}
          {viewMode === 'table' && (
            <div className="glass-card rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400 uppercase text-[10px] tracking-wider">
                      <th className="px-4 py-3 font-semibold">Image</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Description</th>
                      <th className="px-4 py-3 font-semibold">Location</th>
                      <th className="px-4 py-3 font-semibold">Upvotes</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {filteredReports.map(report => (
                      <tr key={report.id} className="hover:bg-zinc-900/50 transition-colors">
                        <td className="px-4 py-3">
                          {report.image_url ? (
                            <img src={report.image_url} alt="" className="w-12 h-12 rounded-xl object-cover border border-zinc-700" />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 text-xs">—</div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-white">
                          <span className="inline-flex items-center gap-1.5">
                            {CATEGORY_ICONS[report.category]} {report.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-[220px]">
                          <span className="text-zinc-400 text-xs line-clamp-2">
                            {report.description || 'No description'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500 font-mono">
                          {report.latitude?.toFixed(4)}, {report.longitude?.toFixed(4)}
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-white">▲ {report.upvotes}</td>
                        <td className="px-4 py-3">
                          <span className={`status-${report.status} px-2.5 py-1 rounded-md text-xs font-semibold`}>
                            {report.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={report.status}
                            onChange={(e) => handleStatusChange(report.id, e.target.value)}
                            className="px-2.5 py-1 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-white"
                          >
                            {STATUS_OPTIONS.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cards View */}
          {viewMode === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {filteredReports.map(report => (
                <ReportCard
                  key={report.id}
                  report={report}
                  showAdminControls={true}
                  onStatusChange={handleStatusChange}
                  onClick={(r) => setSelectedReport(r)}
                  onUpvote={(reportId, newCount) => {
                    setAllReports(prev =>
                      prev.map(r => r.id === reportId ? { ...r, upvotes: newCount } : r)
                    )
                  }}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {filteredReports.length === 0 && (
            <div className="glass-card rounded-2xl p-8 sm:p-12 text-center border border-zinc-800 bg-zinc-950 space-y-3 max-w-md mx-auto">
              <span className="text-4xl block">📭</span>
              <h3 className="text-lg font-bold text-white">No Reports Found</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                There are no issue reports matching your filters right now. Click below to populate sample reports or reset filters!
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setFilterCategory('all'); setFilterStatus('all') }}
                  className="px-4 py-2 bg-zinc-800 text-white font-semibold text-xs rounded-xl hover:bg-zinc-700 transition-colors"
                >
                  Reset Filters
                </button>
                <a
                  href={getApiUrl('/api/seed')}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-white text-black font-semibold text-xs rounded-xl hover:bg-zinc-200 transition-colors shadow-md"
                >
                  🌱 Add 5 Sample Reports
                </a>
              </div>
            </div>
          )}

          {/* Detailed Report Modal */}
          {selectedReport && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in-up">
              <div className="glass-card rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-zinc-700 bg-zinc-950 p-6 space-y-5 shadow-2xl relative">
                {/* Modal Header */}
                <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{CATEGORY_ICONS[selectedReport.category] || '📋'}</span>
                      <h2 className="text-xl font-extrabold text-white">{selectedReport.category}</h2>
                    </div>
                    <p className="text-xs text-zinc-400 font-mono mt-1">ID: {selectedReport.id}</p>
                  </div>
                  <button
                    onClick={() => setSelectedReport(null)}
                    className="p-2 rounded-xl bg-zinc-900 hover:bg-white hover:text-black text-zinc-400 transition-colors text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>

                {/* Modal Image */}
                {selectedReport.image_url && (
                  <div className="w-full h-64 sm:h-80 rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900">
                    <img
                      src={selectedReport.image_url}
                      alt={selectedReport.category}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Description */}
                <div className="space-y-1">
                  <p className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider">Description</p>
                  <p className="text-sm text-zinc-200 bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800">
                    {selectedReport.description || 'No description provided.'}
                  </p>
                </div>

                {/* Status & Quick Action Buttons */}
                <div className="space-y-2">
                  <p className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider">Update Authority Status</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { key: 'pending', label: '⏳ Pending', bg: 'hover:bg-zinc-800' },
                      { key: 'verified', label: '🔍 Verified', bg: 'hover:bg-zinc-800' },
                      { key: 'in-progress', label: '⚡ In Progress', bg: 'hover:bg-yellow-950/40 text-yellow-300' },
                      { key: 'resolved', label: '✅ Resolved', bg: 'hover:bg-green-950/40 text-green-300' },
                    ].map(st => (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => {
                          handleStatusChange(selectedReport.id, st.key)
                          setSelectedReport(prev => prev ? { ...prev, status: st.key } : null)
                        }}
                        className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                          selectedReport.status === st.key
                            ? 'bg-white text-black border-white shadow-md'
                            : `bg-zinc-900 border-zinc-800 text-zinc-300 ${st.bg}`
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Metadata Details */}
                <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-900/40 p-3.5 rounded-xl border border-zinc-800/80">
                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase font-semibold">Location</span>
                    <span className="text-white font-mono">{selectedReport.latitude?.toFixed(4)}, {selectedReport.longitude?.toFixed(4)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase font-semibold">Community Upvotes</span>
                    <span className="text-white font-bold">▲ {selectedReport.upvotes || 0}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase font-semibold">Reported At</span>
                    <span className="text-zinc-300">{new Date(selectedReport.created_at).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase font-semibold">Reporter ID</span>
                    <span className="text-zinc-400 font-mono truncate block">{selectedReport.user_id}</span>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${selectedReport.latitude}&mlon=${selectedReport.longitude}#map=16/${selectedReport.latitude}/${selectedReport.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-zinc-300 hover:text-white underline font-semibold flex items-center gap-1"
                  >
                    🗺️ Open in OpenStreetMap
                  </a>
                  <button
                    onClick={() => setSelectedReport(null)}
                    className="px-4 py-2 bg-white text-black hover:bg-zinc-200 text-xs font-bold rounded-xl transition-colors shadow-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
