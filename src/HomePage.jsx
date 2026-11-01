import { Contact } from './components/Contact'
import { Footer } from './components/Footer'
import { Generator } from './components/Generator'
import { GoodToKnow } from './components/GoodToKnow'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { HowItWorks } from './components/HowItWorks'
import './App.css'

export default function HomePage() {
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
