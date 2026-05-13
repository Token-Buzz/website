import Nav from './_components/Nav'
import Hero from './_components/Hero'
import LiveTicker from './_components/LiveTicker'
import StatStrip from './_components/StatStrip'
import Features from './_components/Features'
import HowItWorks from './_components/HowItWorks'
import Pricing from './_components/Pricing'
import FAQ from './_components/FAQ'
import CTA from './_components/CTA'
import Footer from './_components/Footer'

export default function Page() {
  return (
    <>
      <Nav />
      <Hero />
      <LiveTicker />
      <StatStrip />
      <Features />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
    </>
  )
}
