import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8">
      <div className="space-y-4">
        <h1 className="text-5xl font-bold tracking-tight">
          Take Me Out to the <span className="text-blue-600">Ballparks</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-lg mx-auto">
          Plan your ultimate MLB ballpark road trip for the 2026 season.
          Visit all 30 ballparks with an optimized itinerary.
        </p>
      </div>
      <div className="relative">
        <Image
          src="/logo.png"
          alt="Take Me Out to the Ballparks"
          width={450}
          height={225}
          className="rounded-3xl opacity-80 drop-shadow-xl"
          priority
        />
      </div>
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
