import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders every main section without crashing', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: /straight to your google review page/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /create dynamic qr codes/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open qr dashboard/i })).toHaveAttribute('href', '/admin')
    expect(screen.getByRole('heading', { name: /how it works/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /before you print it/i })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /questions before you generate one/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ReviewTap home' }).querySelector('img'))
      .toHaveAttribute('src', '/reviewtap-logo.svg')
    expect(screen.getByText(/not affiliated with, sponsored by, or endorsed by google/i)).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Powered by')
    expect(screen.getByRole('contentinfo')).toHaveTextContent('AIRNOXAE TECHNOLOGIES')
  })
})
