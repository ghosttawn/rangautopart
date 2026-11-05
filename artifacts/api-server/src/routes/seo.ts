import { asc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import { db, productsTable } from "@workspace/db";

const router: IRouter = Router();
const PUBLIC_PATHS = ["/", "/catalog", "/about", "/contact", "/privacy", "/terms"];

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function requestOrigin(req: Request): string | null {
  const rawForwardedHost = req.headers["x-forwarded-host"];
  const forwardedHost = Array.isArray(rawForwardedHost)
    ? rawForwardedHost[0]
    : rawForwardedHost?.split(",")[0];
  const host = (forwardedHost || req.headers.host || "").trim();
  if (!/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(host)) return null;
  const rawProtocol = req.headers["x-forwarded-proto"];
  const protocol = (Array.isArray(rawProtocol) ? rawProtocol[0] : rawProtocol)
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  return `${protocol === "http" ? "http" : "https"}://${host}`;
}

router.get("/sitemap.xml", async (req, res): Promise<void> => {
  const origin = requestOrigin(req);
  if (!origin) {
    res.status(400).type("text/plain").send("Unable to determine the public site host.");
    return;
  }
  const products = await db
    .select({ slug: productsTable.slug, updatedAt: productsTable.updatedAt })
    .from(productsTable)
    .where(eq(productsTable.published, true))
    .orderBy(asc(productsTable.slug))
    .limit(49_990);
  const urls = [
    ...PUBLIC_PATHS.map((path) => ({
      loc: `${origin}${path}`,
      lastmod: null as string | null,
    })),
    ...products.map((product) => ({
      loc: `${origin}/product/${encodeURIComponent(product.slug)}`,
      lastmod: product.updatedAt.toISOString(),
    })),
  ];
  const entries = urls
    .map(
      ({ loc, lastmod }) =>
        `  <url><loc>${xmlEscape(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`,
    )
    .join("\n");
  res
    .status(200)
    .setHeader("Cache-Control", "public, max-age=1800, stale-while-revalidate=3600")
    .type("application/xml")
    .send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`,
    );
});

export default router;
