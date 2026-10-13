import { describe, expect, it, vi } from 'vitest'
import { createDataStore } from './database.js'

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
})
