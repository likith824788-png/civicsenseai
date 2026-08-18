import { Router } from 'express'
import multer from 'multer'
import { GoogleGenerativeAI } from '@google/generative-ai'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
})

const VALID_CATEGORIES = [
  'Pothole',
  'Garbage/Waste Overflow',
  'Water Leakage',
  'Damaged Infrastructure',
  'Other',
]

router.post('/classify', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.warn('GEMINI_API_KEY not set — returning "Other" as fallback')
      return res.json({ category: 'Other', confidence: 0, fallback: true })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const MODEL_CANDIDATES = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash-latest']

    // Convert buffer to base64
    const base64Image = req.file.buffer.toString('base64')
    const mimeType = req.file.mimetype || 'image/jpeg'

    const prompt = `You are an AI assistant for a civic issue reporting platform. Analyze this image and classify it into EXACTLY ONE of these categories:

1. Pothole
2. Garbage/Waste Overflow
3. Water Leakage
4. Damaged Infrastructure
5. Other

Respond with ONLY the category name, nothing else. If the image doesn't clearly show a civic issue, respond with "Other".`

    let responseText = ''
    let lastError = null

    for (const modelName of MODEL_CANDIDATES) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            maxOutputTokens: 10,
            temperature: 0.1,
          },
        })

        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
        ])

        responseText = result.response.text().trim()
        if (responseText) {
          console.log(`🤖 Gemini AI model (${modelName}) output: "${responseText}"`)
          break
        }
      } catch (modelErr) {
        console.warn(`⚠️ Model ${modelName} failed (${modelErr.message}), trying fallback candidate...`)
        lastError = modelErr
      }
    }

    // Validate the response is one of our categories
    let category = 'Other'
    for (const validCat of VALID_CATEGORIES) {
      if (responseText.toLowerCase().includes(validCat.toLowerCase())) {
        category = validCat
        break
      }
    }

    console.log(`🤖 AI Classification: "${responseText}" → ${category}`)

    res.json({ category, raw: responseText, fallback: false })
  } catch (err) {
    console.error('Classification error:', err)
    // Graceful fallback
    res.json({ category: 'Other', confidence: 0, fallback: true, error: err.message })
  }
})

export default router
