import { useEffect } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { CATEGORY_ICONS } from '../lib/severity'

// Fix Leaflet default icon issue with bundlers
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

/**
 * Create a monochrome high-contrast marker icon for a category
 */
function createCategoryIcon(category, status) {
  const isResolved = status === 'resolved'
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 34px; height: 34px;
        background: ${isResolved ? '#14532d' : '#000000'};
        border: 2px solid ${isResolved ? '#4ade80' : '#ffffff'};
        border-radius: 50%;
        box-shadow: 0 4px 12px ${isResolved ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.25)'};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 15px;
        color: #ffffff;
      ">
        ${isResolved ? '✅' : (CATEGORY_ICONS[category] || '📋')}
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -20],
  })
}

/** Auto-fit bounds to markers */
function FitBounds({ reports }) {
  const map = useMap()

  useEffect(() => {
    if (reports.length === 0) return

    const bounds = L.latLngBounds(
      reports.map(r => [r.latitude, r.longitude])
    )
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
  }, [reports, map])

  return null
}

export default function MapView({ reports, height = '500px', onReportClick, onStatusChange }) {
  const defaultCenter = [20.5937, 78.9629]
  const center = reports.length > 0
    ? [reports[0].latitude, reports[0].longitude]
    : defaultCenter

  return (
    <div style={{ height }} className="w-full rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950">
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <FitBounds reports={reports} />

        {reports.map(report => (
          <Marker
            key={report.id}
            position={[report.latitude, report.longitude]}
            icon={createCategoryIcon(report.category, report.status)}
            eventHandlers={{
              click: () => onReportClick && onReportClick(report),
            }}
          >
            <Popup maxWidth={300}>
              <div className="text-white min-w-[200px] space-y-2">
                {report.image_url && (
                  <img
                    src={report.image_url}
                    alt={report.category}
                    className="w-full h-32 object-cover rounded-lg border border-zinc-700"
                  />
                )}
                <div className="pt-2 border-t border-zinc-800 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-zinc-400 font-semibold uppercase">Status:</span>
                  {onStatusChange ? (
                    <select
                      value={report.status}
                      onChange={(e) => onStatusChange(report.id, e.target.value)}
                      className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-semibold text-white focus:outline-none"
                    >
                      <option value="pending">Pending</option>
                      <option value="verified">Verified</option>
                      <option value="in-progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  ) : (
                    <span className="text-xs font-semibold text-white capitalize">{report.status}</span>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
