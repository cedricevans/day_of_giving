import { Hero } from '../components/Hero'
import { Story } from '../components/Story'
import { ProgressBar } from '../components/ProgressBar'
import { LeadCapture } from '../components/LeadCapture'
import { StickyMobileCta } from '../components/StickyMobileCta'
import { Footer } from '../components/Footer'

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <Hero />
      <Story />
      <ProgressBar />
      <LeadCapture />
      <Footer />
      <StickyMobileCta />
    </div>
  )
}
