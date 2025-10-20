import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = path.join(__dirname, '../database/chat.db')
const db = new Database(dbPath)

// Enable foreign keys
db.pragma('foreign_keys = ON')

// Initialize database schema
export function initDatabase() {
    // Users table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            selected_model TEXT DEFAULT 'openai/gpt-4o-mini',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `)

    // Chats table
    db.exec(`
        CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            mode TEXT CHECK(mode IN ('chat', 'study', 'research')) DEFAULT 'chat',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `)

    // Add mode column to chats table if it doesn't exist (migration)
    try {
        db.exec(`ALTER TABLE chats ADD COLUMN mode TEXT CHECK(mode IN ('chat', 'study', 'research')) DEFAULT 'chat'`)
        console.log('Added mode column to chats table')
    } catch (error) {
        // Column already exists, ignore error
    }

    // Messages table
    db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
            content TEXT NOT NULL,
            model TEXT,
            tokens_input INTEGER,
            tokens_output INTEGER,
            tokens_thinking INTEGER,
            cost REAL,
            thinking TEXT,
            research_metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
        )
    `)

    // Add research_metadata column if it doesn't exist (migration)
    try {
        db.exec(`ALTER TABLE messages ADD COLUMN research_metadata TEXT`)
        console.log('Added research_metadata column to messages table')
    } catch (error) {
        // Column already exists, ignore error
    }

    // Add selected_model column to user_settings table if it doesn't exist
    try {
        db.exec(`ALTER TABLE user_settings ADD COLUMN selected_model TEXT`)
        console.log('Added selected_model column to user_settings table')
    } catch (error) {
        // Column already exists, ignore error
    }

    // User settings table
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL,
            display_name TEXT,
            system_prompt TEXT,
            provider TEXT CHECK(provider IN ('openrouter', 'openai', 'anthropic', 'openai_compatible', 'ollama')),
            provider_api_key_encrypted TEXT,
            provider_base_url TEXT,
            selected_model TEXT,
            embedding_api_key_encrypted TEXT,
            embedding_model TEXT,
            onboarding_complete BOOLEAN DEFAULT 0,
            font_size TEXT CHECK(font_size IN ('small', 'medium', 'large', 'extra-large')) DEFAULT 'medium',
            font_family TEXT CHECK(font_family IN ('inter', 'atkinson', 'opendyslexic', 'literata', 'system')) DEFAULT 'inter',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `)

    // Add font_size and font_family columns to user_settings table if they don't exist (migration)
    try {
        db.exec(`ALTER TABLE user_settings ADD COLUMN font_size TEXT CHECK(font_size IN ('small', 'medium', 'large', 'extra-large')) DEFAULT 'medium'`)
        console.log('Added font_size column to user_settings table')
    } catch (error) {
        // Column already exists, ignore error
    }

    try {
        db.exec(`ALTER TABLE user_settings ADD COLUMN font_family TEXT CHECK(font_family IN ('inter', 'atkinson', 'opendyslexic', 'literata', 'system')) DEFAULT 'inter'`)
        console.log('Added font_family column to user_settings table')
    } catch (error) {
        // Column already exists, ignore error
    }

    // Provider-scoped settings table (each provider keeps its own credentials/base URL)
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_provider_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            provider TEXT NOT NULL CHECK(provider IN ('openrouter', 'openai', 'anthropic', 'openai_compatible', 'ollama')),
            api_key_encrypted TEXT,
            base_url TEXT,
            selected_model TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, provider),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `)

    // Attachments table
    db.exec(`
        CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('image', 'file', 'document_reference')),
            name TEXT NOT NULL,
            url TEXT,
            mime_type TEXT NOT NULL,
            size INTEGER NOT NULL,
            extracted_text TEXT,
            document_id INTEGER,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
        )
    `)

    // Migration: Make url nullable and add document_id if attachments table exists
    try {
        // Check if we need to migrate
        const tableInfo = db.pragma('table_info(attachments)') as Array<{ name: string; notnull: number }>
        const urlColumn = tableInfo.find((col) => col.name === 'url')
        const hasDocumentId = tableInfo.some((col) => col.name === 'document_id')
        
        if (urlColumn && urlColumn.notnull === 1) {
            // Need to recreate table to change NOT NULL constraint
            db.exec(`
                -- Create new table with updated schema
                CREATE TABLE attachments_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    message_id INTEGER NOT NULL,
                    type TEXT NOT NULL CHECK(type IN ('image', 'file', 'document_reference')),
                    name TEXT NOT NULL,
                    url TEXT,
                    mime_type TEXT NOT NULL,
                    size INTEGER NOT NULL,
                    extracted_text TEXT,
                    document_id INTEGER,
                    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
                    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
                );
                
                -- Copy data from old table
                INSERT INTO attachments_new (id, message_id, type, name, url, mime_type, size, extracted_text)
                SELECT id, message_id, type, name, url, mime_type, size, extracted_text FROM attachments;
                
                -- Drop old table
                DROP TABLE attachments;
                
                -- Rename new table
                ALTER TABLE attachments_new RENAME TO attachments;
            `)
            console.log('Migrated attachments table to support document references')
        } else if (!hasDocumentId) {
            // Just add document_id column
            db.exec(`ALTER TABLE attachments ADD COLUMN document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL`)
            console.log('Added document_id column to attachments table')
        }
    } catch (error) {
        // Table doesn't exist yet or migration already done
    }

    // QuotedText table
    db.exec(`
        CREATE TABLE IF NOT EXISTS quoted_texts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            quoted_message_id TEXT NOT NULL,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
        )
    `)

    // Documents table for account-wide document library
    db.exec(`
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('uploading', 'processing', 'completed', 'failed')) DEFAULT 'uploading',
            error_message TEXT,
            file_path TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `)

    // Document chunks table
    db.exec(`
        CREATE TABLE IF NOT EXISTS document_chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id INTEGER NOT NULL,
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            token_count INTEGER NOT NULL,
            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
        )
    `)

    // Create index for faster chunk lookups
    db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id)`)

    // Document embeddings table (storing vectors as JSON)
    db.exec(`
        CREATE TABLE IF NOT EXISTS document_embeddings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chunk_id INTEGER NOT NULL UNIQUE,
            vector_json TEXT NOT NULL,
            FOREIGN KEY (chunk_id) REFERENCES document_chunks(id) ON DELETE CASCADE
        )
    `)

    // Create index for faster embedding lookups
    db.exec(`CREATE INDEX IF NOT EXISTS idx_embeddings_chunk ON document_embeddings(chunk_id)`)

    // MCP servers table
    db.exec(`
        CREATE TABLE IF NOT EXISTS mcp_servers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            transport_type TEXT NOT NULL CHECK(transport_type IN ('stdio', 'sse', 'streamable_http')),
            command TEXT,
            args TEXT,
            env TEXT,
            url TEXT,
            enabled BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `)

    // Create index for faster MCP server lookups
    db.exec(`CREATE INDEX IF NOT EXISTS idx_mcp_servers_user ON mcp_servers(user_id)`)

    console.log('Database initialized successfully')
}

export default db

