import { SiteHeader } from '../components/SiteHeader'
import { Hero } from '../components/Hero'
import { ValuesMarquee } from '../components/ValuesMarquee'
import { Stats } from '../components/Stats'
import { Audiences } from '../components/Audiences'
import { Heritage } from '../components/Heritage'
import { GivingTiers } from '../components/GivingTiers'
import { Scoreboard } from '../components/Scoreboard'
import { HonorRoll } from '../components/HonorRoll'
import { SupporterMap } from '../components/SupporterMap'
import { CommunityWall } from '../components/CommunityWall'
import { MemberStories } from '../components/MemberStories'
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
      <Scoreboard />
      <HonorRoll />
      <SupporterMap />
      <ValuesMarquee />
      <CommunityWall />
      <MemberStories />
      <GivingTiers />
      <Stats />
      <Audiences />
      <Heritage />
      <PhotoWall />
      <LeadCapture />
      <FinalCta />
      <Footer />
      <StickyMobileCta />
    </div>
  )
}
