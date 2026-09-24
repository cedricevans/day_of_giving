import { SiteHeader } from '../components/SiteHeader'
import { Hero } from '../components/Hero'
import { ValuesMarquee } from '../components/ValuesMarquee'
import { Stats } from '../components/Stats'
import { Audiences } from '../components/Audiences'
import { Heritage } from '../components/Heritage'
import { GivingTiers } from '../components/GivingTiers'
import { ProgressBar } from '../components/ProgressBar'
import { PhotoWall } from '../components/PhotoWall'
import { LeadCapture } from '../components/LeadCapture'
import { FinalCta } from '../components/FinalCta'
import { StickyMobileCta } from '../components/StickyMobileCta'
import { Footer } from '../components/Footer'

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <SiteHeader />
      <Hero />
      <ValuesMarquee />
      <Stats />
      <Audiences />
      <Heritage />
      <GivingTiers />
      <ProgressBar />
      <PhotoWall />
      <LeadCapture />
      <FinalCta />
      <Footer />
      <StickyMobileCta />
    </div>
  )
}
