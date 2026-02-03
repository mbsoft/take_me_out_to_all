import { NextRequest, NextResponse } from "next/server";

const NBAI_API_KEY = process.env.NEXT_PUBLIC_NBAI_API_KEY || process.env.NBAI_API_KEY;
const NBAI_BASE_URL = "https://api.nextbillion.io";

/**
 * Proxy for NextBillion.ai map requests.
 * Keeps the API key server-side and hidden from network logs.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  
  if (!NBAI_API_KEY) {
    return NextResponse.json(
      { error: "Map API key not configured" },
      { status: 500 }
    );
  }

  // Reconstruct the path
  const pathStr = path.join("/");
  
  // Get query params from the original request (excluding any key param)
  const searchParams = new URL(request.url).searchParams;
  searchParams.delete("key"); // Remove any key if present
  searchParams.set("key", NBAI_API_KEY); // Add our server-side key
  
  const targetUrl = `${NBAI_BASE_URL}/${pathStr}?${searchParams.toString()}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "Accept": request.headers.get("Accept") || "*/*",
        "Accept-Encoding": request.headers.get("Accept-Encoding") || "gzip, deflate, br",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("Content-Type") || "application/octet-stream";
    
    // For style.json, we need to rewrite URLs to go through our proxy
    if (pathStr.includes("style.json")) {
      const styleJson = await response.json();
      const rewrittenStyle = rewriteStyleUrls(styleJson, request);
      return NextResponse.json(rewrittenStyle, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // For binary data (tiles, sprites, glyphs), stream through
    const data = await response.arrayBuffer();
    
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400", // Cache tiles for 24 hours
      },
    });
  } catch (error) {
    console.error("Map proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch map data" },
      { status: 500 }
    );
  }
}

/**
 * Rewrite URLs in the style.json to go through our proxy
 */
function rewriteStyleUrls(style: any, request: NextRequest): any {
  const origin = request.headers.get("origin") || request.headers.get("host") || "";
  const protocol = request.headers.get("x-forwarded-proto") || "https";
  const baseUrl = origin.startsWith("http") ? origin : `${protocol}://${origin}`;
  const proxyBase = `${baseUrl}/api/map-proxy`;

  // Deep clone to avoid mutating original
  const rewritten = JSON.parse(JSON.stringify(style));

  // Rewrite sprite URL
  if (rewritten.sprite && typeof rewritten.sprite === "string") {
    rewritten.sprite = rewriteUrl(rewritten.sprite, proxyBase);
  }

  // Rewrite glyphs URL
  if (rewritten.glyphs && typeof rewritten.glyphs === "string") {
    rewritten.glyphs = rewriteUrl(rewritten.glyphs, proxyBase);
  }

  // Rewrite source tile URLs
  if (rewritten.sources) {
    for (const sourceKey of Object.keys(rewritten.sources)) {
      const source = rewritten.sources[sourceKey];
      if (source.tiles && Array.isArray(source.tiles)) {
        source.tiles = source.tiles.map((tile: string) => rewriteUrl(tile, proxyBase));
      }
      if (source.url && typeof source.url === "string") {
        source.url = rewriteUrl(source.url, proxyBase);
      }
    }
  }

  return rewritten;
}

/**
 * Rewrite a NextBillion.ai URL to go through our proxy
 * Preserves MapLibre GL template tokens like {fontstack} and {range}
 */
function rewriteUrl(url: string, proxyBase: string): string {
  if (!url) return url;

  // Handle NextBillion.ai URLs
  if (url.includes("api.nextbillion.io")) {
    // Extract path after the domain - preserve template tokens
    const urlObj = new URL(url.replace(/{/g, "%7B").replace(/}/g, "%7D"));
    const path = urlObj.pathname.replace(/^\//, "").replace(/%7B/g, "{").replace(/%7D/g, "}");
    // Preserve query params except key
    urlObj.searchParams.delete("key");
    const queryStr = urlObj.searchParams.toString();
    return `${proxyBase}/${path}${queryStr ? `?${queryStr}` : ""}`;
  }

  // Handle relative URLs or other CDN URLs that need the key
  if (url.includes("nextbillion") || url.includes("nbai")) {
    try {
      const urlObj = new URL(url.replace(/{/g, "%7B").replace(/}/g, "%7D"));
      const path = urlObj.pathname.replace(/^\//, "").replace(/%7B/g, "{").replace(/%7D/g, "}");
      urlObj.searchParams.delete("key");
      const queryStr = urlObj.searchParams.toString();
      return `${proxyBase}/${path}${queryStr ? `?${queryStr}` : ""}`;
    } catch {
      return url;
    }
  }

  return url;
}
