export const SUPPLIER_TYPES = [
  "Purpose Built Student Accommodation Provider",
  "Property Management Company",
  "Lettings Agent/Broker",
  "Hotel Provider",
  "New homes developer",
  "Sublessor",
  "Individual landlord",
  "Built to Rent Accommodation Provider",
  "Co-living Provider",
] as const;

export type SupplierType = (typeof SUPPLIER_TYPES)[number];
