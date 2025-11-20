import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "public", "drag", "iframe.html");
    const html = await fs.readFile(filePath, "utf8");
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    // Fallback: tenter index.html si iframe.html absent
    try {
      const fallbackPath = path.join(process.cwd(), "public", "drag", "index.html");
      const html = await fs.readFile(fallbackPath, "utf8");
      return new NextResponse(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (err) {
      return new NextResponse("Not found", { status: 404 });
    }
  }
}
