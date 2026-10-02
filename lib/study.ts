import { z } from "zod";

export type Contact = { name: string; phone: string; email: string };
export type Site = {
  facility: string;
  status: string;
  place: string;
  contact: Contact | null;
};
export type Study = {
  id: string;
  title: string;
  status: string;
  phase: string;
  conditions: string[];
  minAge: string;
  maxAge: string;
  sex: string;
  criteria: string;
  updated: string;
  locations: Site[];
  centralContact: Contact | null;
};
const contactSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
});
const locationSchema = z.object({
  facility: z.string().optional(),
  status: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  contacts: z.array(contactSchema).optional(),
});
const registryRecordSchema = z.object({
  protocolSection: z.object({
    identificationModule: z.object({
      nctId: z.string().regex(/^NCT\d{8}$/),
      briefTitle: z.string().optional(),
    }),
    statusModule: z.object({
      overallStatus: z.string().optional(),
      lastUpdatePostDateStruct: z.object({ date: z.string().optional() }).optional(),
    }).optional(),
    designModule: z.object({ phases: z.array(z.string()).optional() }).optional(),
    conditionsModule: z.object({ conditions: z.array(z.string()).optional() }).optional(),
    eligibilityModule: z.object({
      minimumAge: z.string().optional(),
      maximumAge: z.string().optional(),
      sex: z.string().optional(),
      eligibilityCriteria: z.string().optional(),
    }).optional(),
    contactsLocationsModule: z.object({
      centralContacts: z.array(contactSchema).optional(),
      locations: z.array(locationSchema).optional(),
    }).optional(),
  }),
});
const searchPayloadSchema = z.object({
  studies: z.array(z.unknown()),
  totalCount: z.number().int().nonnegative().optional(),
  nextPageToken: z.string().optional(),
});
function contact(value?: Partial<Contact>): Contact | null {
  return value
    ? {
        name: String(value.name || ""),
        phone: String(value.phone || ""),
        email: String(value.email || ""),
      }
    : null;
}
export function normalizeStudy(value: unknown): Study | null {
  const parsed = registryRecordSchema.safeParse(value);
  if (!parsed.success) return null;
  const record = parsed.data;
  const section = record.protocolSection;
  const id = section.identificationModule.nctId;
  const eligibility = section?.eligibilityModule;
  const contacts = section?.contactsLocationsModule;
  return {
    id,
    title: String(
      section?.identificationModule?.briefTitle || "Untitled study",
    ),
    status: String(section?.statusModule?.overallStatus || "UNKNOWN"),
    phase: (section?.designModule?.phases || [])
      .map((phase) =>
        phase === "NA" ? "Not applicable" : phase.replaceAll("_", " "),
      )
      .join(", "),
    conditions: (section?.conditionsModule?.conditions || []).slice(0, 12),
    minAge: String(eligibility?.minimumAge || ""),
    maxAge: String(eligibility?.maximumAge || ""),
    sex: String(eligibility?.sex || "UNKNOWN"),
    criteria: String(eligibility?.eligibilityCriteria || ""),
    updated: String(
      section?.statusModule?.lastUpdatePostDateStruct?.date || "",
    ),
    locations: (contacts?.locations || []).map((site) => ({
      facility: String(site.facility || "Facility not listed"),
      status: String(site.status || "STATUS_NOT_LISTED"),
      place: [site.city, site.state, site.country].filter(Boolean).join(", "),
      contact: contact(site.contacts?.[0]),
    })),
    centralContact: contact(contacts?.centralContacts?.[0]),
  };
}

export function normalizeSearchPayload(value: unknown): {
  studies: Study[];
  total: number;
  nextPageToken: string | null;
  omitted: number;
} | null {
  const parsed = searchPayloadSchema.safeParse(value);
  if (!parsed.success) return null;
  const studies = parsed.data.studies
    .map(normalizeStudy)
    .filter((study): study is Study => study !== null);
  return {
    studies,
    total: parsed.data.totalCount || 0,
    nextPageToken: parsed.data.nextPageToken || null,
    omitted: parsed.data.studies.length - studies.length,
  };
}
