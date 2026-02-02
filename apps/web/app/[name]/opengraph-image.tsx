import { ImageResponse } from "next/og";

export const alt = "v1.run - npm package";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Props {
  params: Promise<{ name: string }>;
}

export default async function OGImage({ params }: Props) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);

  // Fetch package data
  let packageName = decodedName;
  let version = "";
  let description = "";
  let downloads = "";
  let license = "";

  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(decodedName)}`, {
      headers: { Accept: "application/json" },
    });

    if (res.ok) {
      const data = await res.json();
      const latestVersion = data["dist-tags"]?.latest;
      if (latestVersion) {
        const versionData = data.versions?.[latestVersion];
        packageName = versionData?.name || decodedName;
        version = latestVersion;
        description = versionData?.description || "";
        license = typeof versionData?.license === "string" ? versionData.license : "";
      }
    }

    // Fetch downloads
    const downloadsRes = await fetch(
      `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(decodedName)}`,
    );
    if (downloadsRes.ok) {
      const downloadsData = await downloadsRes.json();
      const count = downloadsData.downloads || 0;
      if (count >= 1000000) {
        downloads = `${(count / 1000000).toFixed(1)}M`;
      } else if (count >= 1000) {
        downloads = `${(count / 1000).toFixed(1)}K`;
      } else {
        downloads = count.toString();
      }
    }
  } catch {
    // Use defaults if fetch fails
  }

  // Truncate description if too long
  const maxDescLength = 100;
  const truncatedDesc =
    description.length > maxDescLength ? `${description.slice(0, maxDescLength)}...` : description;

  // Build stats string
  const stats = [version ? `v${version}` : "", downloads ? `${downloads}/week` : "", license]
    .filter(Boolean)
    .join("  •  ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#000",
          fontFamily: "monospace",
        }}
      >
        {/* Grid background - static SVG */}
        <svg
          width="1200"
          height="630"
          viewBox="0 0 1200 630"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
          }}
        >
          {/* Horizontal lines with perspective effect */}
          <line x1="0" y1="115" x2="1200" y2="115" stroke="#222" strokeWidth="1" />
          <line x1="0" y1="165" x2="1200" y2="165" stroke="#282828" strokeWidth="1" />
          <line x1="0" y1="210" x2="1200" y2="210" stroke="#2a2a2a" strokeWidth="1" />
          <line x1="0" y1="250" x2="1200" y2="250" stroke="#2d2d2d" strokeWidth="1" />
          <line x1="0" y1="285" x2="1200" y2="285" stroke="#303030" strokeWidth="1" />
          <line x1="0" y1="315" x2="1200" y2="315" stroke="#333" strokeWidth="1" />
          <line x1="0" y1="345" x2="1200" y2="345" stroke="#303030" strokeWidth="1" />
          <line x1="0" y1="380" x2="1200" y2="380" stroke="#2d2d2d" strokeWidth="1" />
          <line x1="0" y1="420" x2="1200" y2="420" stroke="#2a2a2a" strokeWidth="1" />
          <line x1="0" y1="465" x2="1200" y2="465" stroke="#282828" strokeWidth="1" />
          <line x1="0" y1="515" x2="1200" y2="515" stroke="#222" strokeWidth="1" />

          {/* Vertical perspective lines */}
          <line x1="336" y1="0" x2="0" y2="630" stroke="#282828" strokeWidth="1" />
          <line x1="384" y1="0" x2="120" y2="630" stroke="#282828" strokeWidth="1" />
          <line x1="432" y1="0" x2="240" y2="630" stroke="#2a2a2a" strokeWidth="1" />
          <line x1="480" y1="0" x2="360" y2="630" stroke="#2d2d2d" strokeWidth="1" />
          <line x1="528" y1="0" x2="480" y2="630" stroke="#303030" strokeWidth="1" />
          <line x1="576" y1="0" x2="560" y2="630" stroke="#333" strokeWidth="1" />
          <line x1="600" y1="0" x2="600" y2="630" stroke="#333" strokeWidth="1" />
          <line x1="624" y1="0" x2="640" y2="630" stroke="#333" strokeWidth="1" />
          <line x1="672" y1="0" x2="720" y2="630" stroke="#303030" strokeWidth="1" />
          <line x1="720" y1="0" x2="840" y2="630" stroke="#2d2d2d" strokeWidth="1" />
          <line x1="768" y1="0" x2="960" y2="630" stroke="#2a2a2a" strokeWidth="1" />
          <line x1="816" y1="0" x2="1080" y2="630" stroke="#282828" strokeWidth="1" />
          <line x1="864" y1="0" x2="1200" y2="630" stroke="#282828" strokeWidth="1" />
        </svg>

        {/* Logo */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 50,
            display: "flex",
            alignItems: "center",
          }}
        >
          <svg width="40" height="28" viewBox="0 0 129 91" fill="none">
            <path
              d="M4.99974 21.1816H15.0906V51.4543H4.99974V21.1816ZM45.3634 21.1816H55.4543V51.4543H45.3634V21.1816ZM25.1816 71.6361H15.0906V51.4543H25.1816V71.6361ZM25.1816 71.6361H35.2725V81.7271H25.1816V71.6361ZM35.2725 51.4543H45.3634V71.6361H35.2725V51.4543ZM93.6373 21.1816H73.4555V11.0907H93.6373V0.999776H103.728V71.6361H123.91V81.7271H73.4555V71.6361H93.6373V21.1816Z"
              fill="white"
            />
          </svg>
          <span style={{ color: "#666", fontSize: 20, marginLeft: 12 }}>v1.run</span>
        </div>

        {/* Main content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 80px",
          }}
        >
          {/* Package name */}
          <div
            style={{
              fontSize: packageName.length > 25 ? 48 : 64,
              fontWeight: 700,
              color: "#fff",
              marginBottom: 16,
              display: "flex",
            }}
          >
            {packageName}
          </div>

          {/* Stats row */}
          {stats && (
            <div
              style={{
                display: "flex",
                color: "#888",
                fontSize: 22,
                marginBottom: 24,
              }}
            >
              {stats}
            </div>
          )}

          {/* Description */}
          {truncatedDesc && (
            <div
              style={{
                fontSize: 20,
                color: "#666",
                maxWidth: 800,
                display: "flex",
                textAlign: "center",
              }}
            >
              {truncatedDesc}
            </div>
          )}
        </div>

        {/* Bottom URL hint */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            right: 50,
            color: "#444",
            fontSize: 16,
            display: "flex",
          }}
        >
          v1.run/{packageName}
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
