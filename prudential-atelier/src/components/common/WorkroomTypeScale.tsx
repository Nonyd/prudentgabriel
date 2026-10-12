/**
 * BD8: the admin and staff portals read larger than the storefront.
 * Raises --type-scale (see tailwind.config.ts) on :root while one of those
 * layouts is mounted, so dialogs and toasts outside the shell scale too.
 * Text only — spacing is rem-based and stays put.
 */
export const WORKROOM_TYPE_SCALE = 1.15;

export function WorkroomTypeScale() {
  return <style>{`:root{--type-scale:${WORKROOM_TYPE_SCALE}}`}</style>;
}
