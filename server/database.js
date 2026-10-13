import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), 'migrations')
const postgresMigrationsDirectory = join(migrationsDirectory, 'postgres')

function replaceParameters(query) {
  let index = 0
  return query.replace(/\?/g, () => `$${++index}`)
}

export function createDataStore(database, isPostgres = false) {
  const store = {
    async all(query, parameters = []) {
      if (!isPostgres) return database.prepare(query).all(...parameters)
      const rows = await database.unsafe(replaceParameters(query), parameters)
      return rows.map(normalizePostgresRow)
    },

    async get(query, parameters = []) {
      if (!isPostgres) return database.prepare(query).get(...parameters)
      const rows = await database.unsafe(replaceParameters(query), parameters)
      return rows[0] ? normalizePostgresRow(rows[0]) : undefined
    },

    async run(query, parameters = []) {
      if (!isPostgres) {
        const result = database.prepare(query).run(...parameters)
        return { changes: result.changes }
      }
      const result = await database.unsafe(replaceParameters(query), parameters)
      return { changes: result.count }
    },

    async transaction(callback) {
      if (isPostgres) return database.begin((transaction) => callback(createDataStore(transaction, true)))
      database.exec('BEGIN IMMEDIATE')
      try {
        const result = await callback(store)
        database.exec('COMMIT')
        return result
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    },
  }

  return store
}

function normalizePostgresRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      typeof value === 'bigint' ? Number(value) : value,
    ]),
  )
}

export function openDatabase(databasePath) {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true })
  const db = new DatabaseSync(databasePath)
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `)

  const appliedMigrations = new Set(
    db.prepare('SELECT name FROM schema_migrations').all().map((row) => row.name),
  )

  for (const name of readdirSync(migrationsDirectory).filter((file) => file.endsWith('.sql')).sort()) {
    if (appliedMigrations.has(name)) continue
    const sql = readFileSync(join(migrationsDirectory, name), 'utf8')
    db.exec('BEGIN')
    try {
      db.exec(sql)
      db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(
        name,
        new Date().toISOString(),
      )
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }

  return db
}

export async function openPostgresDatabase(databaseUrl, postgresFactory) {
  if (typeof databaseUrl !== 'string' || !databaseUrl.startsWith('postgres')) {
    throw new Error('Set DATABASE_URL to a Neon Postgres connection string.')
  }
  const postgres = postgresFactory ?? (await import('postgres')).default
  const database = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
  })
  const store = createDataStore(database, true)

  await database`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`
  const applied = new Set(
    (await store.all('SELECT name FROM schema_migrations')).map((row) => row.name),
  )
  const migrations = readdirSync(postgresMigrationsDirectory)
    .filter((name) => name.endsWith('.sql'))
    .sort()

  for (const name of migrations) {
    if (applied.has(name)) continue
    const sql = readFileSync(join(postgresMigrationsDirectory, name), 'utf8')
    await database.begin(async (transaction) => {
      for (const statement of sql.split(';').map((value) => value.trim()).filter(Boolean)) {
        await transaction.unsafe(statement)
      }
      await transaction`
        INSERT INTO schema_migrations (name, applied_at)
        VALUES (${name}, ${new Date().toISOString()})
        ON CONFLICT (name) DO NOTHING
      `
    })
  }
  return { store, close: () => database.end({ timeout: 5 }) }
}
