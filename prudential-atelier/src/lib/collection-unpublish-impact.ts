export type UnpublishImpactProduct = {
  id: string;
  name: string;
  otherCollectionNames: string[];
};

export type UnpublishImpact = {
  products: UnpublishImpactProduct[];
};

export function formatUnpublishImpactMessage(impact: UnpublishImpact): string {
  const n = impact.products.length;
  if (n === 0) return "No published products will be hidden.";

  const shared = impact.products.filter((p) => p.otherCollectionNames.length > 0);
  const otherNames = Array.from(new Set(shared.flatMap((p) => p.otherCollectionNames)));
  const otherList =
    otherNames.length === 0
      ? ""
      : otherNames.length === 1
        ? otherNames[0]
        : otherNames.length === 2
          ? `${otherNames[0]} and ${otherNames[1]}`
          : `${otherNames.slice(0, -1).join(", ")}, and ${otherNames[otherNames.length - 1]}`;

  const pieceWord = n === 1 ? "piece" : "pieces";
  let head = `This will unpublish ${n} ${pieceWord}.`;
  if (shared.length > 0 && otherList) {
    const verb = shared.length === 1 ? "appears" : "appear";
    head += ` ${shared.length} of them also ${verb} in ${otherList} and will be removed from there too.`;
  }

  const lines = impact.products.map((p) => {
    const extra =
      p.otherCollectionNames.length > 0 ? ` (also in ${p.otherCollectionNames.join(", ")})` : "";
    return `• ${p.name}${extra}`;
  });

  return [head, "", ...lines].join("\n");
}

export function mergeUnpublishImpacts(impacts: UnpublishImpact[]): UnpublishImpact {
  const map = new Map<string, UnpublishImpactProduct>();
  for (const impact of impacts) {
    for (const p of impact.products) {
      const cur = map.get(p.id);
      if (!cur) {
        map.set(p.id, { id: p.id, name: p.name, otherCollectionNames: [...p.otherCollectionNames] });
        continue;
      }
      for (const n of p.otherCollectionNames) {
        if (!cur.otherCollectionNames.includes(n)) cur.otherCollectionNames.push(n);
      }
    }
  }
  return { products: Array.from(map.values()) };
}
