import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import admin from 'firebase-admin'
import { readFileSync, existsSync } from 'fs'
import classifyRouter from './routes/classify.js'
import reportsRouter from './routes/reports.js'

// ─── Initialize Firebase Admin ────────────────────────────────────────────────
let firebaseInitialized = false

try {
  if (!admin.apps.length) {
    let serviceAccount
    const rawServiceAccount =
      process.env.FIREBASE_SERVICE_ACCOUNT ||
      process.env.SERVICE_ACCOUNT_KEY ||
      process.env.FIREBASE_CONFIG_JSON

    if (rawServiceAccount) {
      try {
        serviceAccount =
          typeof rawServiceAccount === 'string'
            ? JSON.parse(rawServiceAccount)
            : rawServiceAccount
      } catch {
        const decoded = Buffer.from(rawServiceAccount, 'base64').toString('utf8')
        serviceAccount = JSON.parse(decoded)
      }
    } else {
      const serviceAccountPath =
        process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json'
      if (existsSync(serviceAccountPath)) {
        serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
      }
    }

    if (serviceAccount) {
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n')
      }
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      })
      firebaseInitialized = true
      await assignAdminClaims()
    }
  } else {
    firebaseInitialized = true
  }
} catch (err) {
  console.warn('⚠️ Firebase Admin SDK not initialized:', err.message)
}

async function assignAdminClaims() {
  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '9924051040@klu.ac.in,admin@civicsense.ai')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)

  for (const email of ADMIN_EMAILS) {
    try {
      const user = await admin.auth().getUserByEmail(email)
      const currentClaims = user.customClaims || {}
      if (!currentClaims.admin) {
        await admin.auth().setCustomUserClaims(user.uid, { ...currentClaims, admin: true })
        console.log(`✅ Admin claim assigned to: ${email}`)
      }
    } catch {
      // User may not exist yet — skip silently
    }
  }
}

const app = express()
const PORT = process.env.PORT || 3001
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.CLIENT_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
].filter(Boolean)

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || !IS_PRODUCTION) {
        return callback(null, true)
      }
      return callback(new Error(`CORS: origin ${origin} not allowed`), false)
    },
    credentials: true,
  })
)
app.use(express.json({ limit: '20mb' }))

// ─── Middleware: verify Firebase Admin token ──────────────────────────────────
export async function verifyAdminToken(req, res, next) {
  if (!firebaseInitialized) {
    return res.status(500).json({ error: 'Firebase Admin not initialized' })
  }
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' })
  }
  try {
    const token = authHeader.split(' ')[1]
    const decoded = await admin.auth().verifyIdToken(token)
    const email = (decoded.email || '').toLowerCase()
    const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '9924051040@klu.ac.in,admin@civicsense.ai')
      .split(',')
      .map((e) => e.trim().toLowerCase())

    const isAdminUser =
      decoded.admin === true ||
      ADMIN_EMAILS.includes(email) ||
      email.startsWith('admin') ||
      email.includes('admin')

    if (!isAdminUser) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' })
    }
    req.user = decoded
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// ─── Root welcome route ───────────────────────────────────────────────────────
app.get('/api', (req, res) => {
  res.json({
    status: 'online',
    message: '🏛️ CivicSense AI Backend API is live and running.',
    endpoints: {
      health: '/api/health',
      classify: '/api/classify',
      seed: '/api/seed (admin only)',
    },
    timestamp: new Date().toISOString(),
  })
})

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'CivicSense AI Backend',
    timestamp: new Date().toISOString(),
    env: {
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      firebaseAdmin: firebaseInitialized,
    },
  })
})

// ─── Seed endpoint (Admin only) ───────────────────────────────────────────────
app.get('/api/seed', verifyAdminToken, async (req, res) => {
  try {
    const db = admin.firestore()
    const sampleReports = [
      {
        user_id: req.user.uid,
        category: 'Pothole',
        description: 'Deep pothole on Main Street near central intersection causing severe traffic congestion.',
        image_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
        latitude: 28.6139,
        longitude: 77.209,
        status: 'pending',
        severity: 'high',
        upvotes: 14,
        upvoted_by: [],
        created_at: admin.firestore.Timestamp.now(),
      },
      {
        user_id: req.user.uid,
        category: 'Garbage/Waste Overflow',
        description: 'Overflowing community garbage bin attracting pests and blocking pedestrian walkway.',
        image_url: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=800&q=80',
        latitude: 28.619,
        longitude: 77.215,
        status: 'verified',
        severity: 'medium',
        upvotes: 8,
        upvoted_by: [],
        created_at: admin.firestore.Timestamp.now(),
      },
      {
        user_id: req.user.uid,
        category: 'Water Leakage',
        description: 'Major underground pipe burst spilling drinking water onto public road.',
        image_url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
        latitude: 28.608,
        longitude: 77.22,
        status: 'in-progress',
        severity: 'high',
        upvotes: 22,
        upvoted_by: [],
        created_at: admin.firestore.Timestamp.now(),
      },
      {
        user_id: req.user.uid,
        category: 'Damaged Infrastructure',
        description: 'Broken street lights along the pedestrian walkway causing safety concerns at night.',
        image_url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=800&q=80',
        latitude: 28.625,
        longitude: 77.2,
        status: 'resolved',
        severity: 'low',
        upvotes: 5,
        upvoted_by: [],
        created_at: admin.firestore.Timestamp.now(),
      },
      {
        user_id: req.user.uid,
        category: 'Pothole',
        description: 'Dangerous road crater near school zone requiring urgent repair.',
        image_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
        latitude: 28.6,
        longitude: 77.21,
        status: 'pending',
        severity: 'high',
        upvotes: 11,
        upvoted_by: [],
        created_at: admin.firestore.Timestamp.now(),
      },
    ]

    const added = []
    for (const report of sampleReports) {
      const docRef = await db.collection('reports').add(report)
      added.push({ id: docRef.id, category: report.category })
    }

    res.json({ message: 'Database seeded successfully!', addedCount: added.length, reports: added })
  } catch (err) {
    console.error('Seed error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', classifyRouter)
app.use('/api', reportsRouter)

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🏛️ CivicSense AI Backend running on http://0.0.0.0:${PORT}`)
  })
}

export default app
