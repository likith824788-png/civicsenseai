import { Router } from 'express'
import admin from 'firebase-admin'

const router = Router()

// Get Firestore instance
function getDb() {
  return admin.firestore()
}

// Verify Firebase ID token from Authorization header
async function verifyAuth(req) {
  if (!admin.apps.length) {
    return null
  }
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.split(' ')[1]
  try {
    const decodedToken = await admin.auth().verifyIdToken(token)
    return decodedToken
  } catch (err) {
    console.error('Auth verification failed:', err.message)
    return null
  }
}

// PATCH /api/reports/:id/upvote
router.patch('/reports/:id/upvote', async (req, res) => {
  try {
    const user = await verifyAuth(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { id } = req.params
    const db = getDb()
    const reportRef = db.collection('reports').doc(id)

    // Get current report
    const reportDoc = await reportRef.get()
    if (!reportDoc.exists) {
      return res.status(404).json({ error: 'Report not found' })
    }

    const reportData = reportDoc.data()
    const upvotedBy = reportData.upvoted_by || []

    // ── Deduplication check: prevent the same user from voting twice ──
    if (upvotedBy.includes(user.uid)) {
      return res.status(409).json({ error: 'You have already upvoted this report', upvotes: reportData.upvotes })
    }

    // Atomic: increment upvotes AND add user to upvoted_by list
    await reportRef.update({
      upvotes: admin.firestore.FieldValue.increment(1),
      upvoted_by: admin.firestore.FieldValue.arrayUnion(user.uid),
    })

    const updatedDoc = await reportRef.get()
    res.json({ upvotes: updatedDoc.data().upvotes })
  } catch (err) {
    console.error('Upvote error:', err)
    res.status(500).json({ error: 'Failed to upvote' })
  }
})

// Send Resend email notification to user when report status changes
async function sendStatusEmail(toEmail, reportCategory, newStatus, reportId) {
  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    console.log('ℹ️  RESEND_API_KEY not set — skipping email notification.')
    return
  }

  const subject =
    newStatus === 'resolved'
      ? `🎉 Your Civic Issue Report Has Been Resolved! (${reportCategory})`
      : `📋 Status Update on Your Civic Report (${newStatus.toUpperCase()})`

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; background-color: #09090b; color: #ffffff; padding: 30px; border-radius: 12px; max-width: 600px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 40px;">🏛️</span>
        <h2 style="color: #ffffff; margin: 10px 0 5px 0;">CivicSense AI</h2>
        <p style="color: #a1a1aa; font-size: 13px; margin: 0;">Civic Issue Status Update Notification</p>
      </div>

      <div style="background-color: #18181b; border: 1px solid #27272a; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0; color: #a1a1aa; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Report Details</p>
        <p style="margin: 6px 0; color: #ffffff; font-size: 15px;"><strong>Category:</strong> ${reportCategory}</p>
        <p style="margin: 6px 0; color: #ffffff; font-size: 15px;"><strong>New Status:</strong> <span style="background-color: #ffffff; color: #000000; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 13px;">${newStatus.toUpperCase()}</span></p>
        <p style="margin: 6px 0 0 0; color: #71717a; font-size: 11px;">Report ID: ${reportId}</p>
      </div>

      <p style="font-size: 14px; color: #e4e4e7; line-height: 1.6;">
        ${
          newStatus === 'resolved'
            ? '🎉 <strong>Thank you for improving your community!</strong> The reported issue has been marked as <strong>RESOLVED</strong> by local authorities. Your report helped make a real impact.'
            : 'Thank you for submitting your report. Local authorities are actively updating the status of your issue.'
        }
      </p>

      <div style="border-top: 1px solid #27272a; margin-top: 25px; padding-top: 15px; text-align: center;">
        <p style="font-size: 11px; color: #52525b; margin: 0;">Sent with ❤️ by CivicSense AI Platform</p>
      </div>
    </div>
  `

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'CivicSense AI <onboarding@resend.dev>',
        to: [toEmail],
        subject: subject,
        html: htmlContent,
      }),
    })

    const data = await response.json()
    console.log(`📧 Resend Email sent to ${toEmail}:`, data)
    return data
  } catch (err) {
    console.error('📧 Email sending error:', err)
  }
}

// PATCH /api/reports/:id/status  (Admin only)
router.patch('/reports/:id/status', async (req, res) => {
  try {
    const user = await verifyAuth(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Enforce admin-only status changes on the server
    if (!user.admin) {
      return res.status(403).json({ error: 'Forbidden: Admin access required to change report status' })
    }

    const { id } = req.params
    const { status } = req.body

    const validStatuses = ['pending', 'verified', 'in-progress', 'resolved']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    const db = getDb()
    const reportRef = db.collection('reports').doc(id)

    const reportDoc = await reportRef.get()
    if (!reportDoc.exists) {
      return res.status(404).json({ error: 'Report not found' })
    }

    const reportData = reportDoc.data()
    await reportRef.update({ status })

    const updatedDoc = await reportRef.get()
    const data = { id: updatedDoc.id, ...updatedDoc.data() }

    console.log(`📋 Report ${id} status → ${status}`)

    // Trigger Resend email notification asynchronously to the reporter
    if (reportData.user_id) {
      try {
        const reporterUser = await admin.auth().getUser(reportData.user_id)
        if (reporterUser && reporterUser.email) {
          sendStatusEmail(reporterUser.email, reportData.category || 'Civic Issue', status, id)
        }
      } catch (authErr) {
        console.warn('Could not fetch reporter email for notification:', authErr.message)
      }
    }

    res.json(data)
  } catch (err) {
    console.error('Status update error:', err)
    res.status(500).json({ error: 'Failed to update status' })
  }
})

export default router
