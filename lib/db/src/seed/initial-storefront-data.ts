export type InitialCategorySeed = {
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  imageFile: string;
  imageSha256: string;
};

export type InitialProductSeed = {
  name: string;
  sku: string;
  slug: string;
  brand: string | null;
  categorySlug: string;
  priceMinor: number;
  salePriceMinor: number | null;
  stock: number;
  published: boolean;
  featured: boolean;
  description: string;
  specifications: Record<string, string | number | boolean>;
  imageFile: string;
  imageAltText: string | null;
  imageSha256: string;
  compatibility: {
    make: string;
    model: string;
    yearFrom: number;
    yearTo: number;
    verified: boolean;
  }[];
};

export const initialSeedKey = "rang-initial-storefront-v1";

export const initialCategories: InitialCategorySeed[] = [
  {
    name: "ATV Parts & Accessories",
    slug: "atv-parts-accessories",
    description: null,
    active: true,
    imageFile: "rang-atv-filter.jpg",
    imageSha256: "d29af51d5472dfa1af066cfa0c4a41ca43cac5754df693921239691585e24167",
  },
  {
    name: "Car Parts",
    slug: "car-parts",
    description: null,
    active: true,
    imageFile: "rang-floor-mats.jpg",
    imageSha256: "bf6552c39908ec63582d498a09a1a6c5bc2056695a34440c7574d7a4c3ab98ac",
  },
  {
    name: "Motorcycle Parts",
    slug: "motorcycle-parts",
    description: null,
    active: true,
    imageFile: "rang-moto-levers.jpg",
    imageSha256: "66d5955a780f23bac401237756772df0f735da3dbc449b0099c015f4e0a6bc47",
  },
  {
    name: "Other Automotive Products",
    slug: "other-automotive-products",
    description: null,
    active: true,
    imageFile: "rang-jump-starter.jpg",
    imageSha256: "5ea43566ca2f672cc654ef1a38685067fd0836b1d0fd4857493a35951499ce2f",
  },
  {
    name: "Vehicle Accessories",
    slug: "vehicle-accessories",
    description: null,
    active: true,
    imageFile: "rang-led-headlights.jpg",
    imageSha256: "11976daaf6e57bdc5118611e80c596f8f998981ba499a82fc9f2eb1dfc8a7e27",
  },
];

export const initialProducts: InitialProductSeed[] = [
  {
    name: "FoamGuard ATV Air Filter",
    sku: "RANG-DEMO-ATV-001",
    slug: "foamguard-atv-air-filter",
    brand: "TrailWorks",
    categorySlug: "atv-parts-accessories",
    priceMinor: 2850000,
    salePriceMinor: null,
    stock: 14,
    published: true,
    featured: true,
    description:
      "Washable replacement foam filter for routine ATV service. Confirm the part dimensions and your model before ordering.",
    specifications: {
      Service: "Washable",
      "Filter type": "Dual-stage foam",
      "Fitment status": "Unverified demo listing",
    },
    imageFile: "rang-atv-filter.jpg",
    imageAltText: "FoamGuard ATV Air Filter",
    imageSha256: "d29af51d5472dfa1af066cfa0c4a41ca43cac5754df693921239691585e24167",
    compatibility: [
      {
        make: "Honda",
        model: "TRX420",
        yearFrom: 2014,
        yearTo: 2024,
        verified: false,
      },
    ],
  },
  {
    name: "SteelTrail Rear Cargo Rack",
    sku: "RANG-DEMO-ATV-002",
    slug: "steeltrail-rear-cargo-rack",
    brand: "TrailWorks",
    categorySlug: "atv-parts-accessories",
    priceMinor: 8750000,
    salePriceMinor: null,
    stock: 6,
    published: true,
    featured: true,
    description:
      "Powder-coated rear carrier for added utility on work and trail rides. Check mounting points before purchase.",
    specifications: {
      Finish: "Matte black",
      Material: "Powder-coated steel",
      "Fitment status": "Unverified demo listing",
    },
    imageFile: "rang-atv-rack.jpg",
    imageAltText: "SteelTrail Rear Cargo Rack",
    imageSha256: "e1164161ffce11542affa398cd48aff1611fb53c127ff26cb4e77e0e1b79de93",
    compatibility: [
      {
        make: "Can-Am",
        model: "Outlander 450",
        yearFrom: 2017,
        yearTo: 2024,
        verified: false,
      },
    ],
  },
  {
    name: "All-Weather Cabin Floor Liners",
    sku: "RANG-DEMO-CAR-001",
    slug: "all-weather-cabin-floor-liners",
    brand: "RoadSure",
    categorySlug: "car-parts",
    priceMinor: 6400000,
    salePriceMinor: null,
    stock: 3,
    published: true,
    featured: true,
    description:
      "Deep-channel rubber floor liners designed to catch mud and water. This sample listing is not matched to a specific trim.",
    specifications: {
      Color: "Black",
      Pieces: 4,
      Material: "TPE rubber",
      "Fitment status": "Unverified demo listing",
    },
    imageFile: "rang-floor-mats.jpg",
    imageAltText: "All-Weather Cabin Floor Liners",
    imageSha256: "bf6552c39908ec63582d498a09a1a6c5bc2056695a34440c7574d7a4c3ab98ac",
    compatibility: [
      {
        make: "Toyota",
        model: "RAV4",
        yearFrom: 2019,
        yearTo: 2024,
        verified: false,
      },
    ],
  },
  {
    name: "RoadReady 1000A Jump Starter",
    sku: "RANG-DEMO-MAINT-001",
    slug: "roadready-1000a-jump-starter",
    brand: "VoltMate",
    categorySlug: "other-automotive-products",
    priceMinor: 7950000,
    salePriceMinor: null,
    stock: 9,
    published: true,
    featured: true,
    description:
      "Compact 12-volt emergency starter with built-in light for roadside use. Check the vehicle battery requirements before use.",
    specifications: {
      Voltage: "12 V",
      Includes: "Jumper leads and carry case",
      "Peak current": "1000 A",
    },
    imageFile: "rang-jump-starter.jpg",
    imageAltText: "RoadReady 1000A Jump Starter",
    imageSha256: "5ea43566ca2f672cc654ef1a38685067fd0836b1d0fd4857493a35951499ce2f",
    compatibility: [],
  },
  {
    name: "NightPath LED Headlight Pair",
    sku: "RANG-DEMO-LIGHT-001",
    slug: "nightpath-led-headlight-pair",
    brand: "LumaDrive",
    categorySlug: "vehicle-accessories",
    priceMinor: 5200000,
    salePriceMinor: null,
    stock: 11,
    published: true,
    featured: true,
    description:
      "Pair of LED replacement headlamps for improved visibility. Confirm the bulb type and local road-use requirements.",
    specifications: {
      Quantity: 2,
      Technology: "LED",
      "Fitment status": "Unverified demo listing",
    },
    imageFile: "rang-led-headlights.jpg",
    imageAltText: "NightPath LED Headlight Pair",
    imageSha256: "11976daaf6e57bdc5118611e80c596f8f998981ba499a82fc9f2eb1dfc8a7e27",
    compatibility: [
      {
        make: "Universal",
        model: "12V applications",
        yearFrom: 2000,
        yearTo: 2025,
        verified: false,
      },
    ],
  },
  {
    name: "CNC Adjustable Motorcycle Levers",
    sku: "RANG-DEMO-MOTO-001",
    slug: "cnc-adjustable-motorcycle-levers",
    brand: "MotoForm",
    categorySlug: "motorcycle-parts",
    priceMinor: 4600000,
    salePriceMinor: null,
    stock: 4,
    published: true,
    featured: true,
    description:
      "Pair of adjustable replacement control levers with a machined finish. Verify the clamp and pivot dimensions.",
    specifications: {
      Material: "Aluminium alloy",
      Quantity: 2,
      Adjustment: "Six-position",
      "Fitment status": "Unverified demo listing",
    },
    imageFile: "rang-moto-levers.jpg",
    imageAltText: "CNC Adjustable Motorcycle Levers",
    imageSha256: "66d5955a780f23bac401237756772df0f735da3dbc449b0099c015f4e0a6bc47",
    compatibility: [
      {
        make: "Yamaha",
        model: "MT-07",
        yearFrom: 2018,
        yearTo: 2024,
        verified: false,
      },
    ],
  },
  {
    name: "GripLock Magnetic Phone Mount",
    sku: "RANG-DEMO-ACC-001",
    slug: "griplock-magnetic-phone-mount",
    brand: "RoadSure",
    categorySlug: "vehicle-accessories",
    priceMinor: 1950000,
    salePriceMinor: null,
    stock: 22,
    published: true,
    featured: false,
    description:
      "Compact magnetic mount with an adjustable viewing angle. Use a secure mounting point and keep the driver's view clear.",
    specifications: {
      Mount: "Vent and dashboard plates",
      Rotation: "360 degrees",
      "Phone plate": "Included",
    },
    imageFile: "rang-phone-mount.jpg",
    imageAltText: "GripLock Magnetic Phone Mount",
    imageSha256: "4bdfbd96618ad67320d844b0f5ca16ab619072358d2f0179c4889fca7a8d6c03",
    compatibility: [],
  },
  {
    name: "AirPath 12V Tire Inflator",
    sku: "RANG-DEMO-MAINT-002",
    slug: "airpath-12v-tire-inflator",
    brand: "VoltMate",
    categorySlug: "other-automotive-products",
    priceMinor: 3900000,
    salePriceMinor: null,
    stock: 8,
    published: true,
    featured: true,
    description:
      "Portable 12-volt compressor for checking and topping up compatible tires. Follow the tire and vehicle pressure guidance.",
    specifications: {
      Power: "12 V vehicle socket",
      Display: "Digital pressure readout",
      Included: "Air hose and carry bag",
    },
    imageFile: "rang-tire-inflator.jpg",
    imageAltText: "AirPath 12V Tire Inflator",
    imageSha256: "a5ce5d1ada894218c18d4e6a2488da81d8525a0b9aa76b351f046b618821d16b",
    compatibility: [],
  },
];

export const initialStoreSettings = {
  id: 1,
  storeName: "RANG Auto Parts",
  currency: "XAF",
  deliveryFeeMinor: 150000,
  deliveryRegions: ["Littoral", "Centre", "Ouest", "Nord-Ouest"],
  cashOnDeliveryEnabled: true,
  onlinePaymentsEnabled: false,
  supportEmail: null,
  contactPhone: null,
  whatsAppCheckoutEnabled: false,
  whatsAppContactNumber: null,
  heroTitle: "Keep your",
  heroHighlight: "machine moving.",
  heroDescription:
    "Reliable parts for ATVs, cars, motorcycles and utility vehicles. Find the right piece, know what you are getting, and get on with the repair.",
  heroImageFile: "rang-hero.jpg",
  heroImageSha256:
    "34e5033831e34d706b9fa01a198a5de3c96b4437c6ce52e57eb04073a7630df8",
  promotionalTitle: "Not sure it fits? Ask first.",
  promotionalBody:
    "Send us the make, model and year. We will help you narrow it down before you order.",
  promotionalActionLabel: "Talk to our parts desk",
  promotionalUrl: "/contact",
};
