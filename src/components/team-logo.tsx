"use client";

import Image from "next/image";
import { getTeamLogoPath } from "@/lib/team-logos";

interface TeamLogoProps {
  /** 3-letter team abbreviation (e.g. NYY, BOS). */
  abbr: string;
  /** Size in pixels. Default 24. */
  size?: number;
  /** Optional title/alt text. */
  title?: string;
  /** Extra class names. */
  className?: string;
}

/**
 * Renders the MLB team logo for a 3-letter team code. Falls back to showing
 * the abbreviation if no logo is found.
 */
export function TeamLogo({ abbr, size = 24, title, className }: TeamLogoProps) {
  const src = getTeamLogoPath(abbr);
  const normalizedAbbr = abbr?.toUpperCase() || "";
  const alt = title ?? `${normalizedAbbr} logo`;

  if (!src) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded bg-muted text-[10px] font-medium ${className ?? ""}`}
        style={{ width: size, height: size }}
        title={title ?? normalizedAbbr}
      >
        {normalizedAbbr.slice(0, 2)}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      title={title ?? normalizedAbbr}
      unoptimized
    />
  );
}

/** Renders "AWAY @ HOME" with team logos. Use wherever we show a matchup. */
export function GameMatchup({
  awayTeam,
  homeTeam,
  awayName,
  homeName,
  size = 20,
  className,
}: {
  awayTeam: string;
  homeTeam: string;
  awayName?: string;
  homeName?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${className ?? ""}`}>
      <TeamLogo abbr={awayTeam} size={size} title={awayName} />
      <span>{awayName ?? awayTeam}</span>
      <span className="text-muted-foreground">@</span>
      <TeamLogo abbr={homeTeam} size={size} title={homeName} />
      <span>{homeName ?? homeTeam}</span>
    </span>
  );
}
