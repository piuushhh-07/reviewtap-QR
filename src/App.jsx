import { Contact } from './components/Contact'
import { Footer } from './components/Footer'
import { Generator } from './components/Generator'
import { GoodToKnow } from './components/GoodToKnow'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { HowItWorks } from './components/HowItWorks'
import { AdminDashboard } from './components/AdminDashboard'
import { ReviewAssistant } from './components/ReviewAssistant'
import './App.css'

function App() {
  if (window.location.pathname.startsWith('/r/')) {
    return <ReviewAssistant />
  }

  if (window.location.pathname === '/admin' || window.location.pathname === '/admin/') {
    return <AdminDashboard />
  }

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <div id="top" />
      <Header />
      <main id="main">
        <section className="hero" aria-labelledby="hero-heading">
          <div className="hero__inner">
            <Hero />
            <Generator />
          </div>
        </section>
        <HowItWorks />
        <GoodToKnow />
        <Contact />
      </main>
      <Footer />
    </>
  )
}

export default App
