# AI Chat

> **⚠️ Beta Release**: This project is currently in beta. Some features or functions may not work or behave as expected. Please report any issues you encounter.

Full-stack TypeScript application: React + Vite frontend with an Express backend, featuring chat, document ingestion, embeddings, and provider settings.

## Features

- 🤖 Multi-provider AI chat (OpenAI, Anthropic, OpenRouter, etc.)
- 📄 Document processing (PDF, DOCX, XLSX) with RAG
- 🔍 Semantic search with embeddings
- 🔐 Secure authentication with JWT
- 📚 Study mode with interactive quizzes
- 🌐 Web search integration
- 🎨 Modern, responsive UI with Tailwind CSS

## Quick Start

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and set your secrets:

```env
JWT_SECRET=your-secret-key-here
ENCRYPTION_KEY=your-32-byte-encryption-key
CORS_ORIGIN=http://localhost:5173
```

### 3. Run Locally

Open two terminals:

**Terminal 1 - Frontend (Vite dev server):**
```bash
bun run dev
```
Runs on `http://localhost:5173`

**Terminal 2 - Backend (Express server):**
```bash
bun run server:dev
```
Runs on `http://localhost:3001`

## Environment Variables

### Frontend (Vite)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:3001/api` |

### Server

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment mode | No | `development` |
| `PORT` | Express server port | No | `3001` |
| `CORS_ORIGIN` | Allowed origin for CORS | No | `http://localhost:5173` |
| `JWT_SECRET` | Secret for signing JWT tokens | **Yes (production)** | `dev-insecure-jwt-secret` |
| `ENCRYPTION_KEY` | 32+ byte key for encrypting API keys | **Yes** | - |
| `OPENAI_API_KEY` | Fallback OpenAI key (optional) | No | - |

### Document Processing

| Variable | Description | Default |
|----------|-------------|---------|
| `PDF_EXTRACTOR` | Force PDF extractor: `unpdf` or `pdfjs` | Auto-detect |
| `PDF_MAX_PAGES` | Max pages to extract from PDFs | `40` |
| `PDF_MAX_TEXT_CHARS` | Max characters from PDF text | `250000` |
| `DOC_MAX_TEXT_CHARS` | Max characters from documents | `300000` |
| `DOC_MAX_CHUNKS` | Max chunks per document | `200` |

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start Vite dev server (frontend) |
| `bun run server:dev` | Start Express server in watch mode |
| `bun run server` | Start Express server (no watch) |
| `bun run build` | Type-check and build frontend |
| `bun run preview` | Preview production build |
| `bun run lint` | Lint the codebase |

## Project Structure

```
aichatvtwo/
├── src/                      # Frontend React app
│   ├── components/           # React components
│   ├── contexts/             # React contexts
│   ├── pages/                # Page components
│   ├── services/             # API service layer
│   └── types/                # TypeScript types
├── server/                   # Backend Express app
│   ├── src/
│   │   ├── auth.ts           # Authentication logic
│   │   ├── chat.ts           # Chat proxy
│   │   ├── chats.ts          # Chat CRUD
│   │   ├── documents.ts      # Document processing
│   │   ├── embeddings.ts     # Embedding generation
│   │   ├── search.ts         # Web search
│   │   ├── server.ts         # Express server
│   │   ├── userSettings.ts   # User settings
│   │   ├── extractors/       # Document extractors
│   │   └── utils/            # Utilities
│   └── database/             # SQLite DB and uploads (gitignored)
├── .github/workflows/        # CI/CD workflows
└── .env.local                # Local environment (gitignored)
```

## Deployment

### Prerequisites

- Bun 1.0+ (or Node.js 20+ with npm)
- Persistent storage for database and uploads

### GitHub Actions CI

The project includes a CI workflow (`.github/workflows/ci.yml`) that:
- Installs dependencies
- Runs linter
- Builds frontend
- Type-checks server
- Runs security audit

### Production Environment

1. **Set required environment variables:**
   ```bash
   JWT_SECRET=<strong-random-secret>
   ENCRYPTION_KEY=<32-byte-key>
   CORS_ORIGIN=https://your-frontend-domain.com
   NODE_ENV=production
   ```

2. **Build the frontend:**
   ```bash
   bun run build
   ```
   This creates a `dist/` folder with static assets.

3. **Serve the frontend:**
   - Use a static hosting service (Vercel, Netlify, Cloudflare Pages)
   - Or serve via Express by adding static middleware

4. **Run the backend:**
   ```bash
   bun run server
   ```
   - Ensure `server/database/` is writable
   - Consider using PM2 or similar for process management

5. **Database persistence:**
   - The SQLite database is stored in `server/database/chat.db`
   - User uploads are in `server/database/uploads/`
   - Mount these directories to persistent storage in production

### Deployment Platforms

**Frontend:**
- Vercel, Netlify, Cloudflare Pages (static hosting)
- Set `VITE_API_BASE_URL` to your backend URL

**Backend:**
- Railway, Render, Fly.io, DigitalOcean App Platform
- Ensure persistent volumes for database and uploads
- Set all required environment variables

## Security

- 🔐 User API keys are encrypted at rest using AES-256-GCM
- 🍪 Authentication tokens are HTTP-only cookies with `sameSite=strict`
- 🔒 CORS restricted to configured origin
- 🛡️ JWT tokens required in production

See `SECURITY.md` for vulnerability reporting.

## Tech Stack

**Frontend:**
- React 19
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- React Markdown with KaTeX

**Backend:**
- Express 5
- TypeScript
- SQLite (better-sqlite3)
- OpenAI SDK
- JWT authentication
- Multer for file uploads

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `bun run lint` and `bun run build`
5. Submit a pull request