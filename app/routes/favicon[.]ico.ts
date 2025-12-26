import type { LoaderFunction } from "react-router";
import fs from "fs";
import path from "path";

export const loader: LoaderFunction = async () => {
  // Try to serve favicon.png as ico
  const faviconPath = path.join(process.cwd(), "public", "favicon.png");

  try {
    if (fs.existsSync(faviconPath)) {
      const favicon = fs.readFileSync(faviconPath);
      return new Response(favicon, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=31536000",
        },
      });
    }
  } catch (error) {
    console.error("Favicon error:", error);
  }

  // Return 204 No Content if no favicon found
  return new Response(null, { status: 204 });
};
