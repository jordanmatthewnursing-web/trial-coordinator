import type { Contact, Site, Study } from "./study.ts";

export type StudySnapshot = Pick<
  Study,
  | "id"
  | "title"
  | "status"
  | "phase"
  | "conditions"
  | "minAge"
  | "maxAge"
  | "sex"
  | "criteria"
  | "updated"
  | "locations"
  | "centralContact"
>;
export type SourceChange = {
  key: string;
  label: string;
  before: string;
  after: string;
  priority: "review" | "context";
};

function isContact(value: unknown): boolean {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const contact = value as Partial<Contact>;
  return typeof contact.name === "string" && typeof contact.email === "string" && typeof contact.phone === "string";
}
export function isStudySnapshot(value: unknown): value is StudySnapshot {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<StudySnapshot>;
  return (
    typeof item.id === "string" &&
    /^NCT\d{8}$/.test(item.id) &&
    typeof item.title === "string" &&
    typeof item.status === "string" &&
    typeof item.phase === "string" &&
    typeof item.minAge === "string" &&
    typeof item.maxAge === "string" &&
    typeof item.sex === "string" &&
    typeof item.criteria === "string" &&
    typeof item.updated === "string" &&
    Array.isArray(item.conditions) &&
    item.conditions.every((part) => typeof part === "string") &&
    isContact(item.centralContact) &&
    Array.isArray(item.locations) &&
    item.locations.every(
      (site) =>
        site &&
        typeof site.facility === "string" &&
        typeof site.place === "string" &&
        typeof site.status === "string" && isContact(site.contact),
    )
  );
}

export function snapshotStudy(study: Study): StudySnapshot {
  return {
    id: study.id,
    title: study.title,
    status: study.status,
    phase: study.phase,
    conditions: [...study.conditions],
    minAge: study.minAge,
    maxAge: study.maxAge,
    sex: study.sex,
    criteria: study.criteria,
    updated: study.updated,
    locations: study.locations.map((site) => ({
      ...site,
      contact: site.contact ? { ...site.contact } : null,
    })),
    centralContact: study.centralContact ? { ...study.centralContact } : null,
  };
}

function contactText(value: Contact | null): string {
  return value
    ? [value.name, value.phone, value.email].filter(Boolean).join(" · ") ||
        "Not listed"
    : "Not listed";
}
function siteKey(site: Site): string {
  return `${site.facility.trim().toLowerCase()}|${site.place.trim().toLowerCase()}`;
}
function siteText(site: Site): string {
  return `${site.facility} · ${site.place || "Place not listed"} · ${site.status} · ${contactText(site.contact)}`;
}
function indexSites(sites: Site[]): Map<string, Site> {
  const counts = new Map<string, number>();
  const indexed = new Map<string, Site>();
  for (const site of sites) {
    const base = siteKey(site);
    const occurrence = (counts.get(base) || 0) + 1;
    counts.set(base, occurrence);
    indexed.set(`${base}#${occurrence}`, site);
  }
  return indexed;
}

/** Compare public registry fields without treating a changed posted date as proof of clinical change. */
export function diffStudySnapshots(
  previous: StudySnapshot,
  current: StudySnapshot,
): SourceChange[] {
  if (previous.id !== current.id) {
    return [
      {
        key: "study-id",
        label: "Study identity",
        before: previous.id,
        after: current.id,
        priority: "review",
      },
    ];
  }
  const changes: SourceChange[] = [];
  const add = (
    key: string,
    label: string,
    before: string,
    after: string,
    priority: SourceChange["priority"],
  ) => {
    if (before !== after)
      changes.push({
        key,
        label,
        before: before || "Not listed",
        after: after || "Not listed",
        priority,
      });
  };
  add("title", "Study title", previous.title, current.title, "context");
  add(
    "status",
    "Overall recruitment",
    previous.status,
    current.status,
    "review",
  );
  add("phase", "Study phase", previous.phase, current.phase, "context");
  add(
    "conditions",
    "Conditions",
    previous.conditions.join(" · "),
    current.conditions.join(" · "),
    "context",
  );
  add("min-age", "Minimum age", previous.minAge, current.minAge, "review");
  add("max-age", "Maximum age", previous.maxAge, current.maxAge, "review");
  add("sex", "Sex criterion", previous.sex, current.sex, "review");
  add(
    "criteria",
    "Eligibility criteria",
    previous.criteria,
    current.criteria,
    "review",
  );
  add(
    "central-contact",
    "Study contact",
    contactText(previous.centralContact),
    contactText(current.centralContact),
    "context",
  );

  const oldSites = indexSites(previous.locations);
  const newSites = indexSites(current.locations);
  for (const key of [
    ...new Set([...oldSites.keys(), ...newSites.keys()]),
  ].sort()) {
    const oldSite = oldSites.get(key);
    const newSite = newSites.get(key);
    if (!oldSite || !newSite) {
      add(
        `site:${key}`,
        oldSite ? "Site removed" : "Site added",
        oldSite ? siteText(oldSite) : "Not listed",
        newSite ? siteText(newSite) : "Not listed",
        "review",
      );
    } else {
      add(
        `site-status:${key}`,
        `${newSite.facility}: recruitment`,
        oldSite.status,
        newSite.status,
        "review",
      );
      add(
        `site-contact:${key}`,
        `${newSite.facility}: contact`,
        contactText(oldSite.contact),
        contactText(newSite.contact),
        "context",
      );
    }
  }
  if (changes.length === 0) {
    add(
      "posted",
      "Record posted date",
      previous.updated,
      current.updated,
      "context",
    );
  }
  return changes;
}
