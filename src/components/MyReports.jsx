import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { db } from '../lib/firebase'
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
} from 'firebase/firestore'
import ReportCard from './ReportCard'
import toast from 'react-hot-toast'

export default function MyReports() {
  const { user } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedReport, setSelectedReport] = useState(null)

  useEffect(() => {
    if (!user) return

    const q = query(
      collection(db, 'reports'),
      where('user_id', '==', user.uid)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
      }))
      // Sort client-side to avoid requiring a composite index
      data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      setReports(data)
      setLoading(false)
    }, (error) => {
      console.error('Error fetching my reports:', error)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [user])

  const handleStatusChange = async (reportId, newStatus) => {
    try {
      const reportRef = doc(db, 'reports', reportId)
      const updateData = {
        status: newStatus,
        ...(newStatus === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
      }
      await updateDoc(reportRef, updateData)
      setReports(prev =>
        prev.map(r => r.id === reportId ? { ...r, ...updateData } : r)
      )
      toast.success(`Report marked as ${newStatus.toUpperCase()}`)
    } catch (err) {
      console.error('Failed to update report status:', err)
      toast.error('Failed to update report status')
    }
  }

  const filteredReports = filterStatus === 'all'
    ? reports
    : reports.filter(r => r.status === filterStatus)

  const pendingCount = reports.filter(r => r.status === 'pending').length
  const inProgressCount = reports.filter(r => r.status === 'in-progress').length
  const verifiedCount = reports.filter(r => r.status === 'verified').length
  const resolvedCount = reports.filter(r => r.status === 'resolved').length

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">My Reports</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Track real-time resolution status for issues you reported</p>
        </div>
        {reports.length > 0 && (
          <a
            href="/report"
            className="self-start sm:self-auto px-4 py-2 bg-white text-black font-semibold text-xs rounded-xl hover:bg-zinc-200 transition-colors shadow-sm"
          >
            📸 New Report
          </a>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <svg className="animate-spin h-8 w-8 text-white" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : reports.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center border border-zinc-800 bg-zinc-950 space-y-3 max-w-md mx-auto">
          <span className="text-4xl block">📋</span>
          <h3 className="text-lg font-bold text-white">No Reports Submitted</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            You haven't submitted any civic issue reports yet.
          </p>
          <a
            href="/report"
            className="inline-block mt-2 px-4 py-2 bg-white text-black font-semibold text-xs rounded-xl hover:bg-zinc-200 transition-colors shadow-md"
          >
            📸 Submit Your First Report
          </a>
        </div>
      ) : (
        <div className="space-y-6 stagger-children">
          {/* Summary Metric Filter Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`glass-card rounded-xl p-3 text-center transition-all cursor-pointer ${
                filterStatus === 'all'
                  ? 'border-white bg-zinc-900 ring-2 ring-white/20'
                  : 'bg-zinc-950 border border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <p className="text-2xl font-black text-white">{reports.length}</p>
              <p className="text-[10px] uppercase font-bold text-zinc-400 mt-0.5">
                All {filterStatus === 'all' ? '●' : ''}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending')}
              className={`glass-card rounded-xl p-3 text-center transition-all cursor-pointer ${
                filterStatus === 'pending'
                  ? 'border-white bg-zinc-900 ring-2 ring-white/20'
                  : 'bg-zinc-950 border border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <p className="text-2xl font-black text-white">{pendingCount}</p>
              <p className="text-[10px] uppercase font-bold text-zinc-400 mt-0.5">
                Pending {filterStatus === 'pending' ? '●' : ''}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus(filterStatus === 'verified' ? 'all' : 'verified')}
              className={`glass-card rounded-xl p-3 text-center transition-all cursor-pointer ${
                filterStatus === 'verified'
                  ? 'border-white bg-zinc-900 ring-2 ring-white/20'
                  : 'bg-zinc-950 border border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <p className="text-2xl font-black text-white">{verifiedCount}</p>
              <p className="text-[10px] uppercase font-bold text-zinc-400 mt-0.5">
                Verified {filterStatus === 'verified' ? '●' : ''}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus(filterStatus === 'in-progress' ? 'all' : 'in-progress')}
              className={`glass-card rounded-xl p-3 text-center transition-all cursor-pointer ${
                filterStatus === 'in-progress'
                  ? 'border-yellow-400 bg-yellow-950/20 ring-2 ring-yellow-400/30'
                  : 'bg-zinc-950 border border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <p className="text-2xl font-black text-yellow-400">{inProgressCount}</p>
              <p className="text-[10px] uppercase font-bold text-yellow-200/80 mt-0.5">
                In Progress {filterStatus === 'in-progress' ? '●' : ''}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus(filterStatus === 'resolved' ? 'all' : 'resolved')}
              className={`glass-card rounded-xl p-3 text-center transition-all cursor-pointer col-span-2 sm:col-span-1 ${
                filterStatus === 'resolved'
                  ? 'border-green-400 bg-green-950/20 ring-2 ring-green-400/30'
                  : 'bg-zinc-950 border border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <p className="text-2xl font-black text-green-400">{resolvedCount}</p>
              <p className="text-[10px] uppercase font-bold text-green-300 mt-0.5">
                Resolved {filterStatus === 'resolved' ? '●' : ''}
              </p>
            </button>
          </div>

          {filteredReports.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center border border-zinc-800 bg-zinc-950 space-y-2">
              <span className="text-3xl block">🔍</span>
              <p className="text-sm font-semibold text-white">No {filterStatus} reports found</p>
              <button
                type="button"
                onClick={() => setFilterStatus('all')}
                className="text-xs text-zinc-400 hover:text-white underline"
              >
                Show all my reports
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {filteredReports.map(report => (
                <ReportCard
                  key={report.id}
                  report={report}
                  onStatusChange={handleStatusChange}
                  onClick={(r) => setSelectedReport(r)}
                />
              ))}
            </div>
          )}

          {/* Modal for selected report in My Reports */}
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
      )}
    </div>
  )
}
