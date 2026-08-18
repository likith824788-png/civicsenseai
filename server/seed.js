import admin from 'firebase-admin'
import { readFileSync } from 'fs'

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore()

const sampleReports = [
  {
    user_id: 'seed-user-1',
    category: 'Pothole',
    description: 'Deep pothole on Main Street near the central intersection causing severe traffic congestion.',
    image_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
    latitude: 28.6139,
    longitude: 77.2090,
    status: 'pending',
    severity: 'high',
    upvotes: 14,
    created_at: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 3600000 * 5)),
  },
  {
    user_id: 'seed-user-2',
    category: 'Garbage/Waste Overflow',
    description: 'Overflowing community garbage bin attracting pests and blocking pedestrian walkway.',
    image_url: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=800&q=80',
    latitude: 28.6190,
    longitude: 77.2150,
    status: 'verified',
    severity: 'medium',
    upvotes: 8,
    created_at: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 3600000 * 12)),
  },
  {
    user_id: 'seed-user-3',
    category: 'Water Leakage',
    description: 'Major underground pipe burst spilling drinking water onto public road.',
    image_url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
    latitude: 28.6080,
    longitude: 77.2200,
    status: 'in-progress',
    severity: 'high',
    upvotes: 22,
    created_at: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 3600000 * 24)),
  },
  {
    user_id: 'seed-user-4',
    category: 'Damaged Infrastructure',
    description: 'Broken street lights along the pedestrian walkway causing safety concerns at night.',
    image_url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=800&q=80',
    latitude: 28.6250,
    longitude: 77.2000,
    status: 'resolved',
    severity: 'low',
    upvotes: 5,
    created_at: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 3600000 * 48)),
  },
  {
    user_id: 'seed-user-5',
    category: 'Pothole',
    description: 'Dangerous road crater near school zone requiring urgent repair.',
    image_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
    latitude: 28.6000,
    longitude: 77.2100,
    status: 'pending',
    severity: 'high',
    upvotes: 11,
    created_at: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 3600000 * 2)),
  },
]

async function seedDatabase() {
  console.log('🌱 Seeding Firestore database with sample reports...')

  for (const report of sampleReports) {
    const docRef = await db.collection('reports').add(report)
    console.log(`✅ Added report [${report.category}] with ID: ${docRef.id}`)
  }

  console.log('\n📊 Verifying seeded data in Firestore:')
  const snapshot = await db.collection('reports').get()
  console.log(`🎉 Total documents in 'reports' collection: ${snapshot.size}`)

  snapshot.forEach(doc => {
    const data = doc.data()
    console.log(` - ID: ${doc.id} | Category: ${data.category} | Status: ${data.status} | Upvotes: ${data.upvotes}`)
  })
}

seedDatabase().catch(err => {
  console.error('❌ Seeding error:', err)
  process.exit(1)
})
