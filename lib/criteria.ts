export type Criterion = {
  group: "Inclusion" | "Exclusion" | "Other";
  text: string;
};

/** Split the registry's free-text criteria into reviewable lines without inferring eligibility. */
export function parseCriteria(raw: string): Criterion[] {
  const items: Criterion[] = [];
  let group: Criterion["group"] = "Other";

  for (const sourceLine of raw.split(/\r?\n/)) {
    // The registry sometimes escapes Markdown punctuation in otherwise plain text.
    // Keep the raw record available separately and display readable review lines.
    const line = sourceLine.trim().replace(/\\([<>\[\]*_])/g, "$1");
    if (!line) continue;
    const inclusion = line.match(/^inclusion criteria\s*:\s*(.*)$/i);
    if (inclusion) {
      group = "Inclusion";
      if (inclusion[1]) items.push({ group, text: inclusion[1] });
      continue;
    }
    const exclusion = line.match(/^exclusion criteria\s*:\s*(.*)$/i);
    if (exclusion) {
      group = "Exclusion";
      if (exclusion[1]) items.push({ group, text: exclusion[1] });
      continue;
    }

    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
    if (bullet) {
      items.push({ group, text: bullet[1].trim() });
    } else if (items.length) {
      items[items.length - 1].text += ` ${line}`;
    } else {
      items.push({ group, text: line });
    }
  }

  return items;
}
