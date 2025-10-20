import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import db from './database.js'

const rawJwtSecret = process.env.JWT_SECRET
const JWT_SECRET = rawJwtSecret || (process.env.NODE_ENV !== 'production' ? 'dev-insecure-jwt-secret' : '')
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET must be set in production')
}
const SALT_ROUNDS = 10

export interface AuthRequest extends Request {
    userId?: number
}

// Middleware to verify JWT token
export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
    const token = req.cookies.token

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' })
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number }
        req.userId = decoded.userId
        next()
    } catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token' })
    }
}

// Register new user
export async function register(req: Request, res: Response) {
    const { username, password } = req.body

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' })
    }

    if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' })
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    try {
        // Check if username already exists
        const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
        if (existingUser) {
            return res.status(409).json({ error: 'Username already taken' })
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

        // Insert user
        const result = db.prepare(
            'INSERT INTO users (username, password_hash) VALUES (?, ?)'
        ).run(username, passwordHash)

        const userId = result.lastInsertRowid as number

        // Generate JWT token
        const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' })

        // Set HTTP-only cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        })

        res.json({
            success: true,
            user: {
                id: userId,
                username
            }
        })
    } catch (error) {
        console.error('Registration error:', error)
        res.status(500).json({ error: 'Failed to register user' })
    }
}

// Login user
export async function login(req: Request, res: Response) {
    const { username, password } = req.body

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' })
    }

    try {
        // Get user
        const user = db.prepare(
            'SELECT id, username, password_hash, selected_model FROM users WHERE username = ?'
        ).get(username) as { id: number; username: string; password_hash: string; selected_model: string } | undefined

        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' })
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.password_hash)
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid username or password' })
        }

        // Generate JWT token
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' })

        // Set HTTP-only cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        })

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                selectedModel: user.selected_model
            }
        })
    } catch (error) {
        console.error('Login error:', error)
        res.status(500).json({ error: 'Failed to login' })
    }
}

// Logout user
export function logout(req: Request, res: Response) {
    res.clearCookie('token')
    res.json({ success: true })
}

// Get current user
export function getCurrentUser(req: AuthRequest, res: Response) {
    const user = db.prepare(
        'SELECT id, username, selected_model FROM users WHERE id = ?'
    ).get(req.userId) as { id: number; username: string; selected_model: string } | undefined

    if (!user) {
        return res.status(404).json({ error: 'User not found' })
    }

    // Get onboarding status from user_settings
    const settings = db.prepare(
        'SELECT onboarding_complete FROM user_settings WHERE user_id = ?'
    ).get(req.userId) as { onboarding_complete: number } | undefined

    res.json({
        user: {
            id: user.id,
            username: user.username,
            selectedModel: user.selected_model,
            onboardingComplete: settings?.onboarding_complete === 1
        }
    })
}

