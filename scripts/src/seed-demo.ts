import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
import {
  categoriesTable,
  compatibilityTable,
  db,
  deliveriesTable,
  orderItemsTable,
  ordersTable,
  paymentsTable,
  productImagesTable,
  productsTable,
  storeSettingsTable,
  usersTable,
} from "@workspace/db";

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(sourceDirectory, "../..");
const imageDirectory = resolve(workspaceRoot, "attached_assets/generated_images");

if (process.env.NODE_ENV !== "development") {
  throw new Error("Demo records can only be seeded with NODE_ENV=development.");
}
if (process.env.RANG_DEMO_SEED_CONFIRM !== "development") {
  throw new Error(
    "Set RANG_DEMO_SEED_CONFIRM=development explicitly before seeding sample records.",
  );
}

const categories = [
  {
    name: "ATV Parts & Accessories",
    slug: "atv-parts-accessories",
    description: "Service parts and practical upgrades for all-terrain vehicles.",
  },
  {
    name: "Car Parts",
    slug: "car-parts",
    description: "Everyday replacement parts for passenger vehicles.",
  },
  {
    name: "Motorcycle Parts",
    slug: "motorcycle-parts",
    description: "Controls and service parts for road and utility motorcycles.",
  },
  {
    name: "Other Automotive Products",
    slug: "other-automotive-products",
    description: "Workshop and roadside essentials for powered vehicles.",
  },
  {
    name: "Vehicle Accessories",
    slug: "vehicle-accessories",
    description: "Useful interior, exterior, and lighting upgrades.",
  },
] as const;

const categoryImageBySlug: Record<string,string> = {
  "atv-parts-accessories": "rang-atv-filter.jpg",
  "car-parts": "rang-floor-mats.jpg",
  "motorcycle-parts": "rang-moto-levers.jpg",
  "other-automotive-products": "rang-jump-starter.jpg",
  "vehicle-accessories": "rang-led-headlights.jpg",
};

const products = [
  {
    name: "FoamGuard ATV Air Filter",
    sku: "RANG-DEMO-ATV-001",
    slug: "foamguard-atv-air-filter",
    brand: "TrailWorks",
    category: "atv-parts-accessories",
    priceMinor: 2850000,
    stock: 14,
    featured: true,
    image: "rang-atv-filter.jpg",
    description:
      "Washable replacement foam filter for routine ATV service. Confirm the part dimensions and your model before ordering.",
    specifications: { "Filter type": "Dual-stage foam", "Service": "Washable", "Fitment status": "Unverified demo listing" },
    compatibility: [{ make: "Honda", model: "TRX420", yearFrom: 2014, yearTo: 2024, verified: false }],
  },
  {
    name: "SteelTrail Rear Cargo Rack",
    sku: "RANG-DEMO-ATV-002",
    slug: "steeltrail-rear-cargo-rack",
    brand: "TrailWorks",
    category: "atv-parts-accessories",
    priceMinor: 8750000,
    stock: 6,
    featured: true,
    image: "rang-atv-rack.jpg",
    description:
      "Powder-coated rear carrier for added utility on work and trail rides. Check mounting points before purchase.",
    specifications: { Material: "Powder-coated steel", Finish: "Matte black", "Fitment status": "Unverified demo listing" },
    compatibility: [{ make: "Can-Am", model: "Outlander 450", yearFrom: 2017, yearTo: 2024, verified: false }],
  },
  {
    name: "All-Weather Cabin Floor Liners",
    sku: "RANG-DEMO-CAR-001",
    slug: "all-weather-cabin-floor-liners",
    brand: "RoadSure",
    category: "car-parts",
    priceMinor: 6400000,
    stock: 3,
    featured: true,
    image: "rang-floor-mats.jpg",
    description:
      "Deep-channel rubber floor liners designed to catch mud and water. This sample listing is not matched to a specific trim.",
    specifications: { Material: "TPE rubber", Pieces: 4, Color: "Black", "Fitment status": "Unverified demo listing" },
    compatibility: [{ make: "Toyota", model: "RAV4", yearFrom: 2019, yearTo: 2024, verified: false }],
  },
  {
    name: "RoadReady 1000A Jump Starter",
    sku: "RANG-DEMO-MAINT-001",
    slug: "roadready-1000a-jump-starter",
    brand: "VoltMate",
    category: "other-automotive-products",
    priceMinor: 7950000,
    stock: 9,
    featured: true,
    image: "rang-jump-starter.jpg",
    description:
      "Compact 12-volt emergency starter with built-in light for roadside use. Check the vehicle battery requirements before use.",
    specifications: { Voltage: "12 V", "Peak current": "1000 A", "Includes": "Jumper leads and carry case" },
    compatibility: [],
  },
  {
    name: "NightPath LED Headlight Pair",
    sku: "RANG-DEMO-LIGHT-001",
    slug: "nightpath-led-headlight-pair",
    brand: "LumaDrive",
    category: "vehicle-accessories",
    priceMinor: 5200000,
    stock: 11,
    featured: true,
    image: "rang-led-headlights.jpg",
    description:
      "Pair of LED replacement headlamps for improved visibility. Confirm the bulb type and local road-use requirements.",
    specifications: { Quantity: 2, Technology: "LED", "Fitment status": "Unverified demo listing" },
    compatibility: [{ make: "Universal", model: "12V applications", yearFrom: 2000, yearTo: 2025, verified: false }],
  },
  {
    name: "CNC Adjustable Motorcycle Levers",
    sku: "RANG-DEMO-MOTO-001",
    slug: "cnc-adjustable-motorcycle-levers",
    brand: "MotoForm",
    category: "motorcycle-parts",
    priceMinor: 4600000,
    stock: 4,
    featured: true,
    image: "rang-moto-levers.jpg",
    description:
      "Pair of adjustable replacement control levers with a machined finish. Verify the clamp and pivot dimensions.",
    specifications: { Material: "Aluminium alloy", Quantity: 2, Adjustment: "Six-position", "Fitment status": "Unverified demo listing" },
    compatibility: [{ make: "Yamaha", model: "MT-07", yearFrom: 2018, yearTo: 2024, verified: false }],
  },
  {
    name: "GripLock Magnetic Phone Mount",
    sku: "RANG-DEMO-ACC-001",
    slug: "griplock-magnetic-phone-mount",
    brand: "RoadSure",
    category: "vehicle-accessories",
    priceMinor: 1950000,
    stock: 22,
    featured: false,
    image: "rang-phone-mount.jpg",
    description:
      "Compact magnetic mount with an adjustable viewing angle. Use a secure mounting point and keep the driver's view clear.",
    specifications: { Mount: "Vent and dashboard plates", Rotation: "360 degrees", "Phone plate": "Included" },
    compatibility: [],
  },
  {
    name: "AirPath 12V Tire Inflator",
    sku: "RANG-DEMO-MAINT-002",
    slug: "airpath-12v-tire-inflator",
    brand: "VoltMate",
    category: "other-automotive-products",
    priceMinor: 3900000,
    stock: 8,
    featured: true,
    image: "rang-tire-inflator.jpg",
    description:
      "Portable 12-volt compressor for checking and topping up compatible tires. Follow the tire and vehicle pressure guidance.",
    specifications: { Power: "12 V vehicle socket", Display: "Digital pressure readout", "Included": "Air hose and carry bag" },
    compatibility: [],
  },
] as const;

const demoCustomers = [
  { id: "rang-demo-customer-001", email: "nadia.essomba@example.test", name: "Nadia Essomba", phone: "+237 6 70 12 34 51" },
  { id: "rang-demo-customer-002", email: "paul.manga@example.test", name: "Paul Manga", phone: "+237 6 99 41 22 10" },
  { id: "rang-demo-customer-003", email: "mireille.eyenga@example.test", name: "Mireille Eyenga", phone: "+237 6 78 05 82 44" },
  { id: "rang-demo-customer-004", email: "christian.talla@example.test", name: "Christian Talla", phone: "+237 6 55 60 48 17" },
  { id: "rang-demo-customer-005", email: "aline.fotso@example.test", name: "Aline Fotso", phone: "+237 6 81 33 70 29" },
] as const;

const orderDemos = [
  { number: "RANG-DEMO-1001", customer: 0, product: "RANG-DEMO-ATV-001", quantity: 1, daysAgo: 0, status: "submitted", payment: "cod_due", fulfillment: "unfulfilled", city: "Douala", region: "Littoral" },
  { number: "RANG-DEMO-1002", customer: 1, product: "RANG-DEMO-MAINT-002", quantity: 2, daysAgo: 0, status: "confirmed", payment: "cod_due", fulfillment: "processing", city: "Douala", region: "Littoral" },
  { number: "RANG-DEMO-1003", customer: 2, product: "RANG-DEMO-CAR-001", quantity: 1, daysAgo: 3, status: "confirmed", payment: "cod_due", fulfillment: "processing", city: "Yaoundé", region: "Centre" },
  { number: "RANG-DEMO-1004", customer: 3, product: "RANG-DEMO-ATV-002", quantity: 1, daysAgo: 8, status: "confirmed", payment: "paid", fulfillment: "fulfilled", city: "Bafoussam", region: "Ouest" },
  { number: "RANG-DEMO-1005", customer: 4, product: "RANG-DEMO-LIGHT-001", quantity: 1, daysAgo: 14, status: "cancelled", payment: "cod_due", fulfillment: "unfulfilled", city: "Douala", region: "Littoral" },
  { number: "RANG-DEMO-1006", customer: 0, product: "RANG-DEMO-MOTO-001", quantity: 1, daysAgo: 21, status: "confirmed", payment: "paid", fulfillment: "fulfilled", city: "Yaoundé", region: "Centre" },
  { number: "RANG-DEMO-1007", customer: 1, product: "RANG-DEMO-ACC-001", quantity: 2, daysAgo: 30, status: "confirmed", payment: "paid", fulfillment: "fulfilled", city: "Douala", region: "Littoral" },
  { number: "RANG-DEMO-1008", customer: 2, product: "RANG-DEMO-MAINT-001", quantity: 1, daysAgo: 45, status: "confirmed", payment: "cod_due", fulfillment: "unfulfilled", city: "Bamenda", region: "Nord-Ouest" },
] as const;

function dateDaysAgo(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
}

async function seed() {
  const categoryBySlug = new Map<string, string>();
  for (const category of categories) {
    const image = await readFile(
      resolve(imageDirectory, categoryImageBySlug[category.slug]),
    );
    await db
      .insert(categoriesTable)
      .values({
        ...category,
        active: true,
        imageData: image,
        imageContentType: "image/jpeg",
        imageSize: image.byteLength,
      })
      .onConflictDoNothing();
    let [stored] = await db
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .where(eq(categoriesTable.slug, category.slug))
      .limit(1);
    if (!stored) throw new Error(`Could not load sample category ${category.slug}.`);
    categoryBySlug.set(category.slug, stored.id);
    const [existingImage] = await db
      .select({ imageData: categoriesTable.imageData })
      .from(categoriesTable)
      .where(eq(categoriesTable.id, stored.id))
      .limit(1);
    if (!existingImage?.imageData) {
      await db
        .update(categoriesTable)
        .set({
          imageData: image,
          imageContentType: "image/jpeg",
          imageSize: image.byteLength,
        })
        .where(eq(categoriesTable.id, stored.id));
    }
  }

  const productBySku = new Map<string, (typeof productsTable.$inferSelect)>();
  for (const product of products) {
    const categoryId = categoryBySlug.get(product.category);
    if (!categoryId) throw new Error(`Missing category for ${product.sku}.`);
    await db
      .insert(productsTable)
      .values({
        name: product.name,
        sku: product.sku,
        slug: product.slug,
        brand: product.brand,
        categoryId,
        priceMinor: product.priceMinor,
        salePriceMinor: null,
        stock: product.stock,
        published: true,
        featured: product.featured,
        description: product.description,
        specifications: product.specifications,
      })
      .onConflictDoNothing();
    const [stored] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.sku, product.sku))
      .limit(1);
    if (!stored) throw new Error(`Could not load sample product ${product.sku}.`);
    productBySku.set(product.sku, stored);

    const [existingImage] = await db
      .select({ id: productImagesTable.id })
      .from(productImagesTable)
      .where(eq(productImagesTable.productId, stored.id))
      .limit(1);
    if (!existingImage) {
      const data = await readFile(resolve(imageDirectory, product.image));
      await db.insert(productImagesTable).values({
        productId: stored.id,
        contentType: "image/jpeg",
        size: data.byteLength,
        altText: product.name,
        data,
      });
    }
    if (product.compatibility.length > 0) {
      const sampleFitment = product.compatibility[0];
      if (!sampleFitment) continue;
      const [fitment] = await db
        .select({ id: compatibilityTable.id })
        .from(compatibilityTable)
        .where(
          and(
            eq(compatibilityTable.productId, stored.id),
            eq(compatibilityTable.make, sampleFitment.make),
            eq(compatibilityTable.model, sampleFitment.model),
          ),
        )
        .limit(1);
      if (!fitment) {
        await db.insert(compatibilityTable).values(
          product.compatibility.map((item) => ({
            productId: stored.id,
            ...item,
          })),
        );
      }
    }
  }

  const [settings] = await db.select().from(storeSettingsTable).limit(1);
  if (!settings) {
    const heroImage = await readFile(resolve(imageDirectory, "rang-hero.jpg"));
    await db.insert(storeSettingsTable).values({
      id: 1,
      currency: "XAF",
      deliveryFeeMinor: 150000,
      deliveryRegions: ["Littoral", "Centre", "Ouest", "Nord-Ouest"],
      cashOnDeliveryEnabled: true,
      onlinePaymentsEnabled: false,
      heroImageData: heroImage,
      heroImageContentType: "image/jpeg",
      heroImageSize: heroImage.byteLength,
    });
  } else if (!settings.heroImageData) {
    const heroImage = await readFile(resolve(imageDirectory, "rang-hero.jpg"));
    await db
      .update(storeSettingsTable)
      .set({
        heroImageData: heroImage,
        heroImageContentType: "image/jpeg",
        heroImageSize: heroImage.byteLength,
      })
      .where(eq(storeSettingsTable.id, settings.id));
  }

  const customerByIndex: string[] = [];
  for (const customer of demoCustomers) {
    await db
      .insert(usersTable)
      .values({ ...customer, role: "customer" })
      .onConflictDoNothing();
    const [stored] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, customer.email))
      .limit(1);
    if (!stored) throw new Error(`Could not load sample customer ${customer.email}.`);
    customerByIndex.push(stored.id);
  }

  for (let index = 0; index < orderDemos.length; index += 1) {
    const demo = orderDemos[index];
    const customer = demoCustomers[demo.customer];
    const userId = customerByIndex[demo.customer];
    const product = productBySku.get(demo.product);
    if (!customer || !userId || !product) {
      throw new Error(`Missing sample order relationship for ${demo.number}.`);
    }
    const unitPrice = product.salePriceMinor ?? product.priceMinor;
    const subtotal = unitPrice * demo.quantity;
    const deliveryFee = 150000;
    const createdAt = dateDaysAgo(demo.daysAgo);
    const idempotencyKey = `00000000-0000-4000-8000-${String(1001 + index).padStart(12, "0")}`;
    await db
      .insert(ordersTable)
      .values({
        orderNumber: demo.number,
        idempotencyKey,
        userId,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        orderStatus: demo.status,
        paymentStatus: demo.payment,
        paymentMethod: "cash_on_delivery",
        fulfillmentStatus: demo.fulfillment,
        subtotalMinor: subtotal,
        deliveryFeeMinor: deliveryFee,
        totalMinor: subtotal + deliveryFee,
        currency: "XAF",
        createdAt,
        updatedAt: createdAt,
      })
      .onConflictDoNothing();
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.orderNumber, demo.number))
      .limit(1);
    if (!order) throw new Error(`Could not load sample order ${demo.number}.`);

    const [existingItem] = await db
      .select({ id: orderItemsTable.id })
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, order.id))
      .limit(1);
    if (!existingItem) {
      await db.insert(orderItemsTable).values({
        orderId: order.id,
        productId: product.id,
        name: product.name,
        sku: product.sku,
        quantity: demo.quantity,
        unitPriceMinor: unitPrice,
        lineTotalMinor: subtotal,
      });
    }
    const [existingPayment] = await db
      .select({ id: paymentsTable.id })
      .from(paymentsTable)
      .where(eq(paymentsTable.orderId, order.id))
      .limit(1);
    if (!existingPayment) {
      await db.insert(paymentsTable).values({
        orderId: order.id,
        method: "cash_on_delivery",
        status: demo.payment,
        amountMinor: order.totalMinor,
        createdAt,
        updatedAt: createdAt,
      });
    }
    const [existingDelivery] = await db
      .select({ id: deliveriesTable.id })
      .from(deliveriesTable)
      .where(eq(deliveriesTable.orderId, order.id))
      .limit(1);
    if (!existingDelivery) {
      await db.insert(deliveriesTable).values({
        orderId: order.id,
        address: index % 2 === 0 ? "Akwa, Boulevard de la Liberté" : "Bonanjo, Rue Ivy",
        city: demo.city,
        region: demo.region,
        deliveryNotes: "Demonstration order record.",
        deliveryMethod: "delivery",
        createdAt,
        updatedAt: createdAt,
      });
    }
  }

  process.stdout.write(
    `Demo seed complete: ${categories.length} categories, ${products.length} products, ${demoCustomers.length} customers, ${orderDemos.length} orders. Existing records were preserved.\n`,
  );
}

try {
  await seed();
} finally {
  await db.$client.end();
}
