/**
 * One gate for the atelier APIs, the same cell as the pages (Slice T): the page
 * /admin/bespoke opens on the `bespoke` key, so its APIs do too — grants and
 * revokes included, so Kemi's atelier grant reaches both or neither.
 *
 *   read   — see a commission: the key, or STAFF assigned to that commission
 *   work   — stage media, drafts, approval requests, completion: same as read.
 *            The stage gate engine still applies its own role rule after this.
 *   manage — create, edit, assign, specify: the key
 *   money  — record payments or change totals: the key and an AZ8 money role
 *   admin  — revert a stage, delete a commission: ADMIN / SUPER_ADMIN
 *   pipeline — change one commission's steps (move, skip, add, start side by side):
 *            the key and `bespoke.pipeline` (Admins and atelier managers)
 *
 * STAFF hold no admin keys; before this they passed on role alone and could act
 * on any commission by calling the API. Now only on the gowns they are assigned to.
 *
 * Slice BD4 — what a gown needs and what it costs are two gates, not one section:
 *   spec      — read the beads, fabric and lining it needs: the key, the
 *               workroom on it, `bespoke.specification` (Maju), or the store
 *   specEdit  — say what it needs: the key or `bespoke.specification`
 *   storeCost — what the materials cost: `production.cost` or the store
 *   cost      — the whole cost of production, labour included: `production.cost`
 * The price agreed and the balance stay on `money`.
 */
export type BespokeLevel =
  | "read"
  | "work"
  | "manage"
  | "money"
  | "admin"
  | "pipeline"
  | "spec"
  | "specEdit"
  | "storeCost"
  | "cost";

export type BespokeFacts = {
  /** Holds the page's key (`bespoke`, or `clients` for the CRM). */
  house: boolean;
  /** AZ8 money role. */
  money: boolean;
  /** ADMIN / SUPER_ADMIN. */
  admin: boolean;
  /** Has an OrderAssignment on the commission in question. */
  assigned: boolean;
  /** BD4: holds `bespoke.specification`. */
  spec?: boolean;
  /** BD4: holds `store`. */
  store?: boolean;
  /** BD4: holds `production.cost`. */
  cost?: boolean;
  /** Holds `bespoke.pipeline`. */
  pipeline?: boolean;
};

/** Pure: may these facts pass this level? */
export function bespokeAllows(level: BespokeLevel, f: BespokeFacts): boolean {
  switch (level) {
    case "read":
    case "work":
      return f.house || f.assigned;
    case "manage":
      return f.house;
    case "money":
      return f.house && f.money;
    case "admin":
      return f.admin;
    case "pipeline":
      return f.house && Boolean(f.pipeline);
    case "spec":
      return f.house || f.assigned || Boolean(f.spec) || Boolean(f.store);
    case "specEdit":
      return f.house || Boolean(f.spec);
    case "storeCost":
      return Boolean(f.cost) || Boolean(f.store);
    case "cost":
      return Boolean(f.cost);
  }
}

/** What a commission payload may carry for these facts (BD4 + the BC leftovers). */
export type BespokeView = {
  /** Price agreed, paid, balance, payments, receipts. */
  money: boolean;
  /** Material unit and total costs. */
  materialCost: boolean;
  /** Labour lines and the cost-of-production total. */
  labourCost: boolean;
  specEdit: boolean;
  /** May change the commission's steps. */
  pipeline: boolean;
};

export function bespokeView(f: BespokeFacts): BespokeView {
  return {
    money: bespokeAllows("money", f),
    materialCost: bespokeAllows("storeCost", f),
    labourCost: bespokeAllows("cost", f),
    specEdit: bespokeAllows("specEdit", f),
    pipeline: bespokeAllows("pipeline", f),
  };
}
