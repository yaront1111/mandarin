// server/routes/avatarRoutes.js
import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { lookup as mimeLookup } from 'mime-types'
import asyncHandler from 'express-async-handler'
import mongoose from 'mongoose'
import { User } from '../models/index.js'
import config from '../config.js'
import logger from '../logger.js'

const router = express.Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const log = logger.child({ component: 'AvatarRoutes' })

// Inline SVG fallback
const FALLBACK_SVG = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <circle cx="100" cy="100" r="100" fill="#e0e0e0"/>
  <circle cx="100" cy="80"  r="40"  fill="#bbb"/>
  <circle cx="100" cy="180" r="60"  fill="#bbb"/>
</svg>`

// Potential default avatar locations
const DEFAULT_AVATAR_PATHS = [
  path.join(__dirname, '..', 'public', 'default-avatar.png'),
  path.join(__dirname, '..', 'public', 'default-avatar.svg'),
  path.join(process.cwd(), 'public', 'default-avatar.png'),
  path.join(process.cwd(), 'public', 'default-avatar.svg'),
  path.join(process.cwd(), '..', 'client', 'public', 'default-avatar.png'),
  path.join(process.cwd(), '..', 'client', 'public', 'default-avatar.svg')
]

// Pre-resolve default avatar (sync at startup)
let defaultAvatar = null
let defaultMime = null
for (const p of DEFAULT_AVATAR_PATHS) {
  try {
    require('fs').accessSync(p)
    defaultAvatar = p
    defaultMime = mimeLookup(p) || 'application/octet-stream'
    log.info(`Default avatar found at ${p}`)
    break
  } catch {}
}
if (!defaultAvatar) {
  log.warn('No default avatar file found—will use inline SVG')
}

// Common headers middleware
router.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Cross-Origin-Resource-Policy', 'cross-origin')
  res.set('Cache-Control', 'public, max-age=86400')           // 1 day
  res.set('Expires', new Date(Date.now() + 86400000).toUTCString())
  next()
})

// Serve default avatar (file or inline)
function serveDefaultAvatar(res) {
  if (defaultAvatar) {
    return res.type(defaultMime).sendFile(defaultAvatar, err => {
      if (err) {
        log.error({ err }, 'Error sending default avatar file')
        res.type('image/svg+xml').send(FALLBACK_SVG)
      }
    })
  }
  log.warn('Serving inline SVG fallback avatar')
  return res.type('image/svg+xml').send(FALLBACK_SVG)
}

// Health check
router.get('/health', (req, res) => {
  log.info('Avatar route health check')
  res.json({ status: 'ok', timestamp: new Date().toISOString(), route: req.baseUrl })
})

// Explicit “default” endpoint
router.get('/default', (req, res) => serveDefaultAvatar(res))

// Helper: async existence check
async function exists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

// Primary: GET /api/avatar/:userId
router.get(
  '/:userId',
  asyncHandler(async (req, res) => {
    const { userId } = req.params

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      log.warn(`Invalid userId: ${userId}`)
      return serveDefaultAvatar(res)
    }

    // Fetch user photos
    const user = await User.findById(userId).select('photos').lean()
    if (user?.photos?.length) {
      const { url } = user.photos[0]

      // External URL redirect
      if (/^https?:\/\//i.test(url)) {
        log.debug(`Redirecting to external avatar URL: ${url}`)
        return res.redirect(url)
      }

      // Local file
      const localPath = path.isAbsolute(url)
        ? url
        : path.join(process.cwd(), url.replace(/^\//, ''))

      if (await exists(localPath)) {
        const mime = mimeLookup(localPath) || 'application/octet-stream'
        log.debug(`Serving local avatar file: ${localPath}`)
        return res.type(mime).sendFile(localPath, err => {
          if (err) {
            log.error({ err }, 'Error sending local avatar file')
            serveDefaultAvatar(res)
          }
        })
      }
    }

    // Legacy: uploads/user-<id>.jpg
    const legacyPath = path.join(
      process.cwd(),
      config.FILE_UPLOAD_PATH || 'uploads',
      `user-${userId}.jpg`
    )
    if (await exists(legacyPath)) {
      log.debug(`Serving legacy avatar path: ${legacyPath}`)
      return res.type('image/jpeg').sendFile(legacyPath, err => {
        if (err) {
          log.error({ err }, 'Error sending legacy avatar file')
          serveDefaultAvatar(res)
        }
      })
    }

    // Fallback
    serveDefaultAvatar(res)
  })
)

export default router
