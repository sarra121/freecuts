import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { MatchViewLogo } from '@/components/brand/matchview-logo'
import { PitchBackdrop } from '@/components/brand/pitch-backdrop'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 text-foreground select-text">
      <PitchBackdrop />

      <div className="relative z-10 flex max-w-xl flex-col items-center text-center animate-fade-in">
        <MatchViewLogo variant="full" size="lg" className="mb-9" />

        <h1 className="mb-4 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
          Break down the game.
          <br />
          <span className="text-primary">Frame by frame.</span>
        </h1>

        <p className="mb-7 max-w-md text-base text-muted-foreground sm:text-lg">
          Professional match-analysis video tools, right in your browser. Nothing to install.
        </p>

        <Button asChild size="lg" className="gap-2 px-8">
          <Link to="/projects">
            Get started
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
