/**
 * S2.2: Standard amenity catalog data — 50 canonical amenities with aliases.
 * Used for normalizing raw amenity strings from crawlers/LLM extraction.
 *
 * Extracted from amenity-taxonomy.ts to respect the 300-line policy.
 */

import type { AmenityCategory } from "./amenity-taxonomy";

export type AmenityEntry = {
  id: number;
  canonicalName: string;
  category: AmenityCategory;
  iconName: string;
  aliases: string[];
};

export const AMENITY_CATALOG: readonly AmenityEntry[] = [
  // Building Safety
  {
    id: 1,
    canonicalName: "24/7 Security",
    category: "building_safety",
    iconName: "shield",
    aliases: [
      "24 hour security",
      "security guard",
      "24hr security",
      "round-the-clock security",
    ],
  },
  {
    id: 2,
    canonicalName: "CCTV",
    category: "building_safety",
    iconName: "camera",
    aliases: ["security camera", "surveillance", "video surveillance"],
  },
  {
    id: 3,
    canonicalName: "Secure Entry",
    category: "building_safety",
    iconName: "lock",
    aliases: [
      "gated entry",
      "controlled access",
      "key fob entry",
      "buzzer entry",
    ],
  },
  {
    id: 4,
    canonicalName: "Fire Alarm",
    category: "building_safety",
    iconName: "bell",
    aliases: ["fire detection", "smoke alarm system"],
  },
  // Fitness & Recreation
  {
    id: 10,
    canonicalName: "Gym",
    category: "fitness_recreation",
    iconName: "dumbbell",
    aliases: [
      "fitness center",
      "fitness centre",
      "exercise room",
      "workout room",
      "fitness room",
      "weight room",
    ],
  },
  {
    id: 11,
    canonicalName: "Swimming Pool",
    category: "fitness_recreation",
    iconName: "waves",
    aliases: ["pool", "indoor pool", "outdoor pool", "lap pool"],
  },
  {
    id: 12,
    canonicalName: "Yoga Studio",
    category: "fitness_recreation",
    iconName: "heart",
    aliases: ["yoga room", "meditation room", "zen room"],
  },
  {
    id: 13,
    canonicalName: "Game Room",
    category: "fitness_recreation",
    iconName: "gamepad-2",
    aliases: [
      "games room",
      "recreation room",
      "rec room",
      "entertainment room",
    ],
  },
  // Common Areas
  {
    id: 20,
    canonicalName: "Study Room",
    category: "common_areas",
    iconName: "book-open",
    aliases: ["study lounge", "study space", "quiet room", "library"],
  },
  {
    id: 21,
    canonicalName: "Lounge",
    category: "common_areas",
    iconName: "sofa",
    aliases: [
      "common room",
      "community room",
      "resident lounge",
      "social lounge",
    ],
  },
  {
    id: 22,
    canonicalName: "Rooftop Terrace",
    category: "common_areas",
    iconName: "sun",
    aliases: ["rooftop", "sky lounge", "roof deck", "terrace"],
  },
  {
    id: 23,
    canonicalName: "Co-working Space",
    category: "common_areas",
    iconName: "laptop",
    aliases: ["coworking", "work space", "business center", "business centre"],
  },
  // Technology
  {
    id: 30,
    canonicalName: "High-Speed WiFi",
    category: "technology",
    iconName: "wifi",
    aliases: ["wifi", "wi-fi", "internet", "broadband", "fiber internet"],
  },
  {
    id: 31,
    canonicalName: "Smart Lock",
    category: "technology",
    iconName: "key",
    aliases: ["keyless entry", "digital lock", "smart access"],
  },
  {
    id: 32,
    canonicalName: "Package Lockers",
    category: "technology",
    iconName: "package",
    aliases: ["parcel lockers", "package room", "mail room", "amazon locker"],
  },
  // Parking & Transport
  {
    id: 40,
    canonicalName: "Covered Parking",
    category: "parking_transport",
    iconName: "car",
    aliases: [
      "garage parking",
      "indoor parking",
      "underground parking",
      "parking garage",
    ],
  },
  {
    id: 41,
    canonicalName: "Bike Storage",
    category: "parking_transport",
    iconName: "bike",
    aliases: ["bicycle storage", "bike room", "bike rack"],
  },
  {
    id: 42,
    canonicalName: "Shuttle Service",
    category: "parking_transport",
    iconName: "bus",
    aliases: ["campus shuttle", "bus service", "transport service"],
  },
  // Laundry
  {
    id: 50,
    canonicalName: "In-Unit Washer/Dryer",
    category: "laundry",
    iconName: "washing-machine",
    aliases: [
      "washer dryer",
      "in-unit laundry",
      "private laundry",
      "W/D in unit",
    ],
  },
  {
    id: 51,
    canonicalName: "Shared Laundry Room",
    category: "laundry",
    iconName: "washing-machine",
    aliases: [
      "laundry room",
      "communal laundry",
      "laundry facility",
      "laundromat",
    ],
  },
  // Outdoor
  {
    id: 60,
    canonicalName: "BBQ Area",
    category: "outdoor",
    iconName: "flame",
    aliases: ["barbecue", "grill area", "outdoor grill", "BBQ grill"],
  },
  {
    id: 61,
    canonicalName: "Courtyard",
    category: "outdoor",
    iconName: "trees",
    aliases: ["garden", "outdoor area", "green space", "patio"],
  },
  // Pet
  {
    id: 70,
    canonicalName: "Pet Friendly",
    category: "pet",
    iconName: "paw-print",
    aliases: ["pets allowed", "pet policy", "dog friendly", "cat friendly"],
  },
  {
    id: 71,
    canonicalName: "Dog Wash Station",
    category: "pet",
    iconName: "droplets",
    aliases: ["pet wash", "pet spa", "dog grooming"],
  },
  // Accessibility
  {
    id: 80,
    canonicalName: "Wheelchair Accessible",
    category: "accessibility",
    iconName: "accessibility",
    aliases: [
      "ADA compliant",
      "handicap accessible",
      "barrier free",
      "disability access",
    ],
  },
  {
    id: 81,
    canonicalName: "Elevator",
    category: "accessibility",
    iconName: "arrow-up-down",
    aliases: ["lift", "lifts available", "elevators"],
  },
  // Kitchen & Dining
  {
    id: 90,
    canonicalName: "Full Kitchen",
    category: "kitchen_dining",
    iconName: "chef-hat",
    aliases: ["kitchen", "kitchenette", "cooking facilities"],
  },
  {
    id: 91,
    canonicalName: "Dishwasher",
    category: "kitchen_dining",
    iconName: "utensils",
    aliases: ["dish washer", "dishwashing machine"],
  },
] as const;
