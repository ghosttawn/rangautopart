import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetProduct, useGetStorefront } from "@workspace/api-client-react";

const PUBLIC_META: Record<string, { title: string; description: string }> = {
  "/": {
    title: "RANG Auto Parts | ATV, Car and Motorcycle Parts",
    description:
      "Shop reliable ATV, car, motorcycle and utility-vehicle parts. Check product details, stock and pricing with RANG Auto Parts.",
  },
  "/catalog": {
    title: "Shop Auto, ATV and Motorcycle Parts | RANG Auto Parts",
    description:
      "Browse the RANG Auto Parts catalog by category, brand or part number. Review current pricing and compatibility details before ordering.",
  },
  "/about": {
    title: "About RANG Auto Parts",
    description:
      "Learn how RANG Auto Parts helps drivers and repair shops find dependable vehicle parts with clear product information.",
  },
  "/contact": {
    title: "Contact the RANG Parts Desk",
    description:
      "Ask RANG Auto Parts about a product, vehicle fitment, stock or delivery before placing an order.",
  },
  "/privacy": {
    title: "Privacy | RANG Auto Parts",
    description: "Read how RANG Auto Parts handles account and order information.",
  },
  "/terms": {
    title: "Terms | RANG Auto Parts",
    description: "Review the terms for using the RANG Auto Parts storefront.",
  },
};

const PRIVATE_PATHS = [
  "/admin",
  "/account",
  "/cart",
  "/checkout",
  "/orders",
  "/order/",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
];

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`,
  );
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function setCanonical(path: string | null): string | null {
  const existing = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  if (!path) {
    existing?.remove();
    return null;
  }
  const canonical = new URL(path, window.location.origin).toString();
  const link = existing ?? document.createElement("link");
  link.rel = "canonical";
  link.href = canonical;
  if (!existing) document.head.appendChild(link);
  return canonical;
}

export function SeoController() {
  const [location] = useLocation();
  const productMatch = location.match(/^\/product\/([^/]+)\/?$/);
  const slug = productMatch ? productMatch[1] : "";
  const { data: product } = useGetProduct(slug, {
    query: { enabled: Boolean(slug) },
  });
  const { data: storefront } = useGetStorefront({
    query: { enabled: Boolean(slug) },
  });

  useEffect(() => {
    const path = location.split("?")[0] || "/";
    const isPrivate = PRIVATE_PATHS.some(
      (privatePath) =>
        path === privatePath || path.startsWith(`${privatePath}/`),
    );
    const page = product
      ? {
          title: `${product.name} | RANG Auto Parts`,
          description:
            product.description.trim().slice(0, 158) ||
            `See current price and compatibility details for ${product.name} at RANG Auto Parts.`,
        }
      : PUBLIC_META[path] ?? {
          title: "RANG Auto Parts",
          description:
            "Find dependable ATV, car and motorcycle parts with RANG Auto Parts.",
        };
    const canonical = setCanonical(isPrivate ? null : path);
    const robots = isPrivate ? "noindex, nofollow" : "index, follow";
    const imagePath =
      product?.images?.[0]?.url || product?.imageUrl || "/rang-hero.jpg";
    const image = new URL(imagePath, window.location.origin).toString();

    document.title = page.title;
    setMeta("name", "description", page.description);
    setMeta("name", "robots", robots);
    setMeta("property", "og:title", page.title);
    setMeta("property", "og:description", page.description);
    setMeta("property", "og:type", product ? "product" : "website");
    setMeta("property", "og:image", image);
    if (canonical) setMeta("property", "og:url", canonical);
    else document.head.querySelector('meta[property="og:url"]')?.remove();
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", page.title);
    setMeta("name", "twitter:description", page.description);
    setMeta("name", "twitter:image", image);

    let structuredData = document.getElementById("rang-product-jsonld");
    if (product && canonical) {
      if (!structuredData) {
        structuredData = document.createElement("script");
        structuredData.id = "rang-product-jsonld";
        structuredData.setAttribute("type", "application/ld+json");
        document.head.appendChild(structuredData);
      }
      const priceMinor = product.salePriceMinor ?? product.priceMinor;
      const data = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description,
        sku: product.sku,
        brand: {
          "@type": "Brand",
          name: product.brand || "RANG Auto Parts",
        },
        image: product.images?.length
          ? product.images.map((item) =>
              new URL(item.url, window.location.origin).toString(),
            )
          : [image],
        offers: {
          "@type": "Offer",
          url: canonical,
          priceCurrency: storefront?.settings.currency || "XAF",
          price: (priceMinor / 100).toFixed(2),
          availability:
            product.stock > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
        },
      };
      structuredData.textContent = JSON.stringify(data).replaceAll("<", "\\u003c");
    } else {
      structuredData?.remove();
    }
  }, [location, product, storefront?.settings.currency]);

  return null;
}
