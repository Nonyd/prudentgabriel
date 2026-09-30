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
 *
 * STAFF hold no admin keys; before this they passed on role alone and could act
 * on any commission by calling the API. Now only on the gowns they are assigned to.
 */
export type BespokeLevel = "read" | "work" | "manage" | "money" | "admin";

export type BespokeFacts = {
  /** Holds the page's key (`bespoke`, or `clients` for the CRM). */
  house: boolean;
  /** AZ8 money role. */
  money: boolean;
  /** ADMIN / SUPER_ADMIN. */
  admin: boolean;
  /** Has an OrderAssignment on the commission in question. */
  assigned: boolean;
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
  }
}
