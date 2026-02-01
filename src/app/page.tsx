import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-6">
      <h1 className="text-5xl font-bold tracking-tight">
        Take Me Out To <span className="text-blue-600">All</span>
      </h1>
      <p className="text-xl text-muted-foreground max-w-lg">
        Plan your ultimate MLB ballpark road trip for the 2026 season.
        Visit all 30 stadiums with an optimized itinerary.
      </p>
      <div className="flex gap-4">
        <Link href="/register">
          <Button size="lg">Get Started</Button>
        </Link>
        <Link href="/login">
          <Button size="lg" variant="outline">Log In</Button>
        </Link>
      </div>
    </div>
  );
}
