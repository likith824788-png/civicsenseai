import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { db, storage } from '../lib/firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { getApiUrl } from '../lib/api'
import toast from 'react-hot-toast'

function compressImage(file, maxWidth = 800, quality = 0.65) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target.result
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
              type: 'image/jpeg',
              lastModified: Date.now(),
            })
            resolve(compressedFile || file)
          },
          'image/jpeg',
          quality
        )
      }
    }
  })
}

const DEFAULT_LOCATION = { latitude: 28.6139, longitude: 77.2090 }

export default function ReportForm() {
  const { user } = useAuth()
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState(DEFAULT_LOCATION) // Default fallback location
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [statusStep, setStatusStep] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    captureLocation()
  }, [])

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported — using default city coordinates')
      setLocation(DEFAULT_LOCATION)
      return
    }

    setLocationLoading(true)
    setLocationError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        setLocationLoading(false)
      },
      () => {
        setLocationError('GPS permission denied — default location applied for testing')
        setLocation(DEFAULT_LOCATION)
        setLocationLoading(false)
      },
      { enableHighAccuracy: true, timeout: 5000 }
    )
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 15 * 1024 * 1024) {
      toast.error('Image must be under 15MB')
      return
    }

    setImage(file)
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!image) {
      toast.error('Please upload or select a photo of the issue')
      return
    }

    const targetLocation = location || DEFAULT_LOCATION
    const activeUserId = user ? user.uid : 'test-user-123'

    setSubmitting(true)
    setStatusStep('Processing report...')

    try {
      // 1. Compress image
      const compressedImage = await compressImage(image)

      // 2. Storage upload with fallback to compressed base64
      let imageUrl = null
      try {
        setStatusStep('Uploading image...')
        const fileName = `report-images/${activeUserId}/${Date.now()}.jpg`
        const storageRef = ref(storage, fileName)

        // Race upload against a 10s timeout to prevent hanging forever
        const uploadPromise = uploadBytes(storageRef, compressedImage, { contentType: 'image/jpeg' })
          .then(() => getDownloadURL(storageRef))
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Storage upload timed out')), 10000)
        )

        imageUrl = await Promise.race([uploadPromise, timeoutPromise])
      } catch (storageErr) {
        console.warn('Storage upload fallback (using compressed base64):', storageErr.message)
        // Use compressed image as base64 fallback (not the original which can be huge)
        try {
          const reader = new FileReader()
          const compressedBase64 = await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result)
            reader.readAsDataURL(compressedImage)
          })
          // Only use base64 if it's under 800KB to stay within Firestore's 1MB doc limit
          if (compressedBase64.length < 800 * 1024) {
            imageUrl = compressedBase64
          }
        } catch (b64Err) {
          console.warn('Base64 fallback also failed:', b64Err.message)
        }
      }

      // 3. Gemini AI classification with fallback
      let category = 'Other'
      try {
        setStatusStep('Analyzing with AI...')
        const formData = new FormData()
        formData.append('image', compressedImage)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)

        const res = await fetch(getApiUrl('/api/classify'), {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (res.ok) {
          const result = await res.json()
          category = result.category || 'Other'
        }
      } catch (classifyErr) {
        console.warn('AI classification fallback:', classifyErr.message)
      }

      // 4. Document creation in Firestore
      setStatusStep('Saving report...')
      await addDoc(collection(db, 'reports'), {
        user_id: activeUserId,
        image_url: imageUrl,
        category,
        description: description.trim() || null,
        latitude: targetLocation.latitude,
        longitude: targetLocation.longitude,
        status: 'pending',
        severity: 'low',
        upvotes: 0,
        upvoted_by: [],
        created_at: serverTimestamp(),
      })

      setSuccess(true)
      setImage(null)
      setImagePreview(null)
      setDescription('')
      toast.success(`Report submitted successfully! AI categorized as: ${category}`)

      setTimeout(() => setSuccess(false), 5000)
    } catch (err) {
      console.error('Submit error:', err)
      toast.error(err.message || 'Failed to submit report')
    } finally {
      setSubmitting(false)
      setStatusStep('')
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-up">
      <div className="border-b border-zinc-800 pb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Report an Issue</h1>
        <p className="text-sm text-zinc-400 mt-0.5">Upload a photo and Gemini AI will automatically categorize it</p>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-zinc-900 border border-white text-white font-medium text-sm flex items-center gap-3">
          <span className="text-xl">✅</span>
          <div>
            <p className="font-bold">Report submitted successfully!</p>
            <p className="text-xs text-zinc-400">View your report in "My Reports" or on the Community Feed.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Image Upload Area */}
        <div className="glass-card rounded-2xl p-5 sm:p-6 bg-zinc-950 border border-zinc-800 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
            📸 Photo of Issue <span className="text-red-500">*</span>
          </label>

          {imagePreview ? (
            <div className="relative group">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full h-60 sm:h-72 object-cover rounded-xl border border-zinc-700"
              />
              <button
                type="button"
                onClick={() => { setImage(null); setImagePreview(null) }}
                className="absolute top-3 right-3 p-2 bg-black/80 hover:bg-white hover:text-black rounded-lg text-white transition-all text-xs font-bold"
              >
                ✕ Remove
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-zinc-800 hover:border-white rounded-xl cursor-pointer transition-all hover:bg-zinc-900 group">
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📷</div>
              <span className="text-xs sm:text-sm font-semibold text-zinc-300 group-hover:text-white">
                Click or tap to upload photo
              </span>
              <span className="text-[10px] text-zinc-500 mt-1">JPG, PNG up to 15MB</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Location Section */}
        <div className="glass-card rounded-2xl p-5 sm:p-6 bg-zinc-950 border border-zinc-800 space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
            📍 Location Coordinates
          </label>

          {locationLoading ? (
            <div className="flex items-center gap-2 text-zinc-400 text-xs py-1">
              <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Getting GPS coordinates...
            </div>
          ) : (
            <div className="flex items-center justify-between py-1">
              <div className="text-xs font-mono">
                <span className="text-white font-bold">✓ Location Ready</span>
                <span className="text-zinc-400 ml-2">
                  ({location?.latitude.toFixed(4)}, {location?.longitude.toFixed(4)})
                </span>
              </div>
              <button
                type="button"
                onClick={captureLocation}
                className="text-xs text-zinc-400 hover:text-white underline font-semibold"
              >
                Refresh Location
              </button>
            </div>
          )}
          {locationError && <p className="text-zinc-500 text-[11px] font-mono">{locationError}</p>}
        </div>

        {/* Description Input */}
        <div className="glass-card rounded-2xl p-5 sm:p-6 bg-zinc-950 border border-zinc-800 space-y-2">
          <label htmlFor="description" className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
            📝 Description <span className="text-zinc-500 font-normal">(optional)</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Add details about the issue location or severity..."
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-white transition-all resize-none"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting || !image}
          className="w-full py-4 px-6 bg-white hover:bg-zinc-200 text-black font-extrabold rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm uppercase tracking-wider shadow-lg shadow-white/5"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4 text-black" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {statusStep || 'Submitting Report...'}
            </span>
          ) : (
            '🚀 Submit Issue Report'
          )}
        </button>
      </form>
    </div>
  )
}
