// Shared zod validation for pump create/update, used by the API and forms.
const { z } = require("zod");
const { DEPOTS } = require("./depots");

const depotSlugs = DEPOTS.map((d) => d.slug);

const pumpInputSchema = z.object({
  depot: z.enum(depotSlugs),
  cmsCode: z.string().trim().min(1, "CMS Code is required"),
  roName: z.string().trim().min(1, "RO Name is required"),
  rtkm: z.coerce.number().nonnegative("RTKM must be >= 0"),
  address: z.string().trim().optional().default(""),
  city: z.string().trim().optional().default(""),
  state: z.string().trim().optional().default(""),
  district: z.string().trim().optional().default(""),
  division: z.string().trim().optional().default(""),
  zone: z.string().trim().optional().default(""),
  sourceLocation: z.string().trim().optional().default(""),
  supplyLocationCode: z.string().trim().optional().default(""),
  lat: z.coerce.number().min(-90).max(90).nullable().optional(),
  lng: z.coerce.number().min(-180).max(180).nullable().optional(),
});

// For updates everything is optional.
const pumpUpdateSchema = pumpInputSchema.partial();

module.exports = { pumpInputSchema, pumpUpdateSchema, depotSlugs };
