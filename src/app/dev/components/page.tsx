import { notFound } from "next/navigation";
import { GameCard } from "@/components/game-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { Progress } from "@/components/ui/progress";
import { SectionHeader } from "@/components/ui/section-header";
import { Separator } from "@/components/ui/separator";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";

const buttonVariants = [
  "default",
  "secondary",
  "ghost",
  "outline",
  "destructive",
  "link",
] as const;

const badgeVariants = [
  "default",
  "secondary",
  "sky",
  "lavender",
  "outline",
  "destructive",
] as const;

const chipTones = ["neutral", "sage", "blue", "sand", "lavender"] as const;
const statusSamples = [
  "OWNED",
  "WISHLIST",
  "PLAYING",
  "BACKLOG",
  "COMPLETED",
  "FINISHED",
  "PAUSED",
  "DROPPED",
] as const;

const sampleGame = {
  name: "Memory Garden Deluxe Edition",
  slug: "memory-garden-deluxe",
  coverUrl: null,
};

const longTitleGame = {
  name: "The Remarkably Long Journey Across the Soft Library Shelf",
  slug: "long-journey-soft-library",
  coverUrl: null,
};

function ComponentShowcase({ label }: { label: string }) {
  return (
    <section className="rounded-card border border-edge bg-canvas p-6 text-ink shadow-soft">
      <SectionHeader
        eyebrow={`${label} theme`}
        title="Soft-bento components"
        description="Shared UI pieces in their normal, quiet, active, and empty states."
        aside={<Badge variant="lavender">dev only</Badge>}
      />

      <div className="grid gap-6">
        <Card tactile>
          <CardHeader>
            <CardTitle>Cards</CardTitle>
            <CardDescription>
              Resting cards keep their place; interactive cards lift only when
              they invite action.
            </CardDescription>
            <CardAction>
              <Badge>tactile</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Card className="p-5" tactile>
              <CardTitle>Resting surface</CardTitle>
              <CardDescription>Soft edge, warm surface, quiet depth.</CardDescription>
            </Card>
            <Card className="p-5" interactive tactile>
              <CardTitle>Interactive surface</CardTitle>
              <CardDescription>Hover or focus to feel the gentle lift.</CardDescription>
            </Card>
          </CardContent>
          <CardFooter>
            <Button size="sm">Primary action</Button>
            <Button size="sm" variant="ghost">
              Secondary
            </Button>
          </CardFooter>
        </Card>

        <div className="grid gap-5 rounded-card border border-edge bg-surface p-5 shadow-rest">
          <h3 className="section-label !mb-0">Buttons</h3>
          <div className="flex flex-wrap gap-3">
            {buttonVariants.map((variant) => (
              <Button key={variant} variant={variant}>
                {variant}
              </Button>
            ))}
            <Button disabled>disabled</Button>
            <Button loading>loading</Button>
            <Button size="icon" aria-label="Icon button">
              <span aria-hidden>i</span>
            </Button>
          </div>
        </div>

        <div className="grid gap-5 rounded-card border border-edge bg-surface p-5 shadow-rest">
          <h3 className="section-label !mb-0">Badges, chips, and statuses</h3>
          <div className="flex flex-wrap gap-2">
            {badgeVariants.map((variant) => (
              <Badge key={variant} variant={variant}>
                {variant}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {chipTones.map((tone) => (
              <Chip key={tone} tone={tone}>
                {tone}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {statusSamples.map((status) => (
              <StatusBadge key={status} status={status} />
            ))}
          </div>
        </div>

        <div className="grid gap-5 rounded-card border border-edge bg-surface p-5 shadow-rest">
          <h3 className="section-label !mb-0">Game cards</h3>
          <div className="grid gap-4 md:grid-cols-[repeat(3,minmax(0,1fr))]">
            <GameCard
              completionPercent={24}
              game={sampleGame}
              platformName="PS5"
              playtimeMinutes={720}
              status="PLAYING"
              variant="shelf"
            />
            <GameCard
              game={longTitleGame}
              status="WISHLIST"
              variant="shelf"
            />
            <GameCard
              chips={["cozy", "low setup"]}
              description="A gentle pick for tonight when you want something familiar."
              eyebrow="Tonight's pick"
              game={{ ...sampleGame, name: "Lamp Save Slot", slug: "lamp-save-slot" }}
              platformName="Switch"
              playtimeMinutes={95}
              status="BACKLOG"
              variant="slot"
            />
          </div>
          <div className="grid gap-3">
            <GameCard
              game={sampleGame}
              platformName="Steam"
              playtimeMinutes={240}
              status="OWNED"
              variant="row"
            />
            <GameCard
              description="Missing cover, platform, and playtime are intentional quiet states."
              game={{ ...longTitleGame, slug: "missing-data-row" }}
              status="FINISHED"
              variant="row"
            />
          </div>
        </div>

        <div className="grid gap-4">
          <Notice tone="info">A calm info note for context.</Notice>
          <Notice tone="success">A successful sync can feel gentle too.</Notice>
          <Notice tone="error">An actionable problem without alarm color.</Notice>
        </div>

        <div className="grid gap-5 rounded-card border border-edge bg-surface p-5 shadow-rest">
          <h3 className="section-label !mb-0">Progress and observations</h3>
          <Progress value={42} label="achievement progress" />
          <Separator />
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard value="128" label="on the shelf" />
            <StatCard value="12" label="playing now" />
            <StatCard value="34" label="still curious" />
          </div>
        </div>

        <EmptyState
          title="Your shelf is quiet right now."
          illustration={<span aria-hidden>+</span>}
        >
          Add a few games whenever it feels useful. The shelf can start small.
        </EmptyState>
      </div>
    </section>
  );
}

export default function DevComponentsPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <main id="main-content" className="mx-auto grid w-full max-w-[1180px] gap-8 pb-12">
      <ComponentShowcase label="Day" />
      <div data-theme="night">
        <ComponentShowcase label="Night" />
      </div>
    </main>
  );
}
