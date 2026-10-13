import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Generator } from './Generator'

describe('Generator', () => {
  it('directs code creation to the authenticated dynamic QR dashboard', () => {
    render(<Generator />)

    expect(screen.getByRole('heading', { name: /create dynamic qr codes/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open qr dashboard/i })).toHaveAttribute('href', '/admin')
  })
})
