import { describe, expect, it, vi } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDataStore, openDatabase, openPostgresDatabase } from './database.js'
import { getReviewCategories } from '../src/lib/reviewSuggestions.js'

const migrationDirectory = join(dirname(fileURLToPath(import.meta.url)), 'migrations')

describe('Postgres data store', () => {
  it('converts positional placeholders and normalizes integer counts', async () => {
    const result = Object.assign([{ count: 3n }], { count: 1 })
    const unsafe = vi.fn().mockResolvedValue(result)
    const store = createDataStore({ unsafe }, true)

    const rows = await store.all(
      'SELECT COUNT(*) AS count FROM qr_codes WHERE status = ? AND id LIKE ?',
      ['assigned', '%rt-%'],
    )

    expect(unsafe).toHaveBeenCalledWith(
      'SELECT COUNT(*) AS count FROM qr_codes WHERE status = $1 AND id LIKE $2',
      ['assigned', '%rt-%'],
    )
    expect(rows).toEqual([{ count: 3 }])
  })

  it('runs multi-query workflows inside the Postgres transaction', async () => {
    const transaction = { unsafe: vi.fn().mockResolvedValue(Object.assign([], { count: 1 })) }
    const begin = vi.fn(async (callback) => callback(transaction))
    const store = createDataStore({ begin }, true)

    await expect(store.transaction(async (tx) => tx.run('UPDATE qr_codes SET status = ?', ['assigned'])))
      .resolves.toEqual({ changes: 1 })
    expect(begin).toHaveBeenCalledOnce()
    expect(transaction.unsafe).toHaveBeenCalledWith(
      'UPDATE qr_codes SET status = $1',
      ['assigned'],
    )
  })

  it('runs the category ID migration through the Postgres migration mechanism', async () => {
    const executed = []
    const emptyResult = Object.assign([], { count: 0 })
    const tag = (strings, ...values) => {
      const query = strings.join('?')
      executed.push({ query, values })
      return Promise.resolve(query.includes('SELECT name FROM schema_migrations') ? [] : emptyResult)
    }
    const unsafe = vi.fn(async (query, values = []) => {
      executed.push({ query, values })
      return query.includes('SELECT name FROM schema_migrations') ? [] : emptyResult
    })
    const transaction = Object.assign(tag, { unsafe })
    const database = Object.assign(tag, {
      unsafe,
      begin: vi.fn(async (callback) => callback(transaction)),
      end: vi.fn(),
    })
    const postgresFactory = vi.fn(() => database)
    const opened = await openPostgresDatabase('postgres://localhost/reviewtap-test', postgresFactory)

    await opened.close()

    expect(postgresFactory).toHaveBeenCalledOnce()
    expect(executed.some(({ query }) => (
      query.includes("ADD COLUMN IF NOT EXISTS category_id TEXT NOT NULL DEFAULT 'other-general-business'")
    ))).toBe(true)
    expect(executed.some(({ query }) => (
      query.includes("SET category_id = 'other-general-business'")
    ))).toBe(true)
    const postgresCategoryMigration = readFileSync(
      join(migrationDirectory, 'postgres', '003-business-category-id.sql'),
      'utf8',
    )
    const sqliteCategoryMigration = readFileSync(
      join(migrationDirectory, '003-business-category-id.sql'),
      'utf8',
    )
    for (const { id } of getReviewCategories()) {
      expect(postgresCategoryMigration).toContain(`'${id}'`)
      expect(sqliteCategoryMigration).toContain(`'${id}'`)
    }
    expect(executed.some(({ query, values }) => (
      query.includes('INSERT INTO schema_migrations') &&
      values[0] === '003-business-category-id.sql'
    ))).toBe(true)
    expect(database.begin).toHaveBeenCalledTimes(4)
  })
})

describe('SQLite category ID migration', () => {
  it('preserves existing businesses and QR assignments with the general category fallback', () => {
    const databaseDirectory = mkdtempSync(join(tmpdir(), 'reviewtap-category-migration-'))
    const databasePath = join(databaseDirectory, 'reviewtap.sqlite')
    let database = new DatabaseSync(databasePath)
    let migrated

    try {
      database.exec(`
        CREATE TABLE schema_migrations (
          name TEXT PRIMARY KEY,
          applied_at TEXT NOT NULL
        )
      `)
      const priorMigrations = [
        '001-initial-schema.sql',
        '002-admin-sessions.sql',
        '002-business-category.sql',
      ]
      for (const name of priorMigrations) {
        database.exec(readFileSync(join(migrationDirectory, name), 'utf8'))
        database.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)')
          .run(name, new Date().toISOString())
      }

      database.prepare(`
        INSERT INTO businesses (id, name, review_url, category, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'business-existing',
        'Existing Cafe',
        'https://g.page/r/ExistingPlace/review',
        'cafe',
        '2025-01-01T00:00:00.000Z',
        '2025-01-01T00:00:00.000Z',
      )
      database.prepare(`
        INSERT INTO qr_codes (id, status, business_id, created_at, assigned_at)
        VALUES (?, 'assigned', ?, ?, ?)
      `).run(
        'rt-existing-qr',
        'business-existing',
        '2025-01-01T00:00:00.000Z',
        '2025-01-01T00:00:00.000Z',
      )
      database.close()
      database = null

      migrated = openDatabase(databasePath)
      const business = migrated.prepare(
        'SELECT id, name, review_url, category, category_id FROM businesses WHERE id = ?',
      ).get('business-existing')
      const qr = migrated.prepare(
        'SELECT id, status, business_id FROM qr_codes WHERE id = ?',
      ).get('rt-existing-qr')

      expect(business).toEqual({
        id: 'business-existing',
        name: 'Existing Cafe',
        review_url: 'https://g.page/r/ExistingPlace/review',
        category: 'cafe',
        category_id: 'other-general-business',
      })
      expect(qr).toEqual({
        id: 'rt-existing-qr',
        status: 'assigned',
        business_id: 'business-existing',
      })
    } finally {
      database?.close()
      migrated?.close()
      rmSync(databaseDirectory, { recursive: true, force: true })
    }
  })
})
