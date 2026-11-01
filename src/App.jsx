import { lazy, Suspense } from 'react'
import { ReviewAssistant } from './components/ReviewAssistant'

const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(
  ({ AdminDashboard: Component }) => ({ default: Component }),
))
const HomePage = lazy(() => import('./HomePage'))

function App() {
  if (window.location.pathname.startsWith('/r/')) {
    return <ReviewAssistant />
  }

  if (window.location.pathname === '/admin' || window.location.pathname === '/admin/') {
    return (
      <Suspense fallback={null}>
        <AdminDashboard />
      </Suspense>
    )
  }

  return (
    <Suspense fallback={null}>
      <HomePage />
    </Suspense>
  )
}

export default App
