import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "public", "drag", "style.css");
    const css = await fs.readFile(filePath, "utf8");
    return new NextResponse(css, {
      status: 200,
      headers: { "Content-Type": "text/css; charset=utf-8" },
    });
  } catch (e) {
    return new NextResponse("Not found", { status: 404 });
  }
}
