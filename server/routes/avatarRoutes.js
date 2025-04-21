// server/routes/avatarRoutes.js
import express from 'express'
import fs from 'fs'
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

// Inline SVG fallback (served only if no files exist)
const FALLBACK_SVG = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <circle cx="100" cy="100" r="100" fill="#e0e0e0"/>
  <circle cx="100" cy="80"  r="40"  fill="#bbb"/>
  <circle cx="100" cy="180" r="60"  fill="#bbb"/>
</svg>`

// All the places a default avatar might live
const DEFAULT_AVATAR_PATHS = [
  path.join(__dirname, '..', 'public', 'default-avatar.png'),
  path.join(__dirname, '..', 'public', 'default-avatar.svg'),
  path.join(process.cwd(), 'public', 'default-avatar.png'),
  path.join(process.cwd(), 'public', 'default-avatar.svg'),
  path.join(process.cwd(), '..', 'client', 'public', 'default-avatar.png'),
  path.join(process.cwd(), '..', 'client', 'public', 'default-avatar.svg')
]

// Helper: set CORS + caching headers
function setCommonHeaders(res) {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Cross-Origin-Resource-Policy', 'cross-origin')
  res.set('Cache-Control', 'public, max-age=86400')            // 1 day
  res.set('Expires', new Date(Date.now() + 86400000).toUTCString())
}

// Helper: send the inline SVG fallback
function serveInlineSvg(res) {
  log.warn('Serving inline SVG fallback avatar')
  res.type('image/svg+xml').send(FALLBACK_SVG)
}

// Helper: try all default files, then fallback to inline SVG
function serveDefaultAvatar(res) {
  setCommonHeaders(res)
  for (const p of DEFAULT_AVATAR_PATHS) {
    if (fs.existsSync(p)) {
      const mimeType = mimeLookup(p) || 'application/octet-stream'
      log.debug(`Serving default avatar from ${p}`)
      return res.type(mimeType).sendFile(p)
    }
  }
  return serveInlineSvg(res)
}

// Health‑check
router.get('/health', (req, res) => {
  setCommonHeaders(res)
  log.info('Avatar route health check')
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    route:     req.baseUrl
  })
})

// Explicit “default” endpoint
router.get('/default', (req, res) => {
  serveDefaultAvatar(res)
})

// Primary: GET /api/avatar/:userId
router.get(
  '/:userId',
  asyncHandler(async (req, res) => {
    const { userId } = req.params
    setCommonHeaders(res)

    // Validate ObjectId early
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      log.warn(`Invalid userId: ${userId}`)
      return serveDefaultAvatar(res)
    }

    // Lookup user’s photos
    const user = await User.findById(userId).select('photos').lean()
    if (user?.photos?.length > 0) {
      const { url } = user.photos[0]

      // External URL? redirect
      if (url.startsWith('http://') || url.startsWith('https://')) {
        log.debug(`Redirecting to external avatar URL: ${url}`)
        return res.redirect(url)
      }

      // Local path: absolute or rooted under uploads
      const localPath = path.isAbsolute(url)
        ? url
        : path.join(process.cwd(), url.replace(/^\//, ''))

      if (fs.existsSync(localPath)) {
        const mimeType = mimeLookup(localPath) || 'application/octet-stream'
        log.debug(`Serving local avatar file: ${localPath}`)
        return res.type(mimeType).sendFile(localPath)
      }
    }

    // Legacy pattern: user-<id>.jpg
    const legacyPath = path.join(
      process.cwd(),
      config.FILE_UPLOAD_PATH || 'uploads',
      `user-${userId}.jpg`
    )
    if (fs.existsSync(legacyPath)) {
      log.debug(`Serving legacy avatar path: ${legacyPath}`)
      return res.type('image/jpeg').sendFile(legacyPath)
    }

    // Nothing found → default
    serveDefaultAvatar(res)
  })
)

export default router
