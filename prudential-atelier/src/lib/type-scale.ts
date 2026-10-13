/**
 * BD8: the pixel text sizes that scale with --type-scale (text-9px … text-40px).
 * One list for both tailwind.config.ts (which defines them) and cn()'s
 * tailwind-merge (which must know they are font sizes — otherwise it reads
 * `text-10px` as a colour and drops the real colour class beside it).
 */
export const PX_TEXT_SIZES = [9, 10, 11, 12, 13, 14, 15, 20, 22, 24, 28, 32, 36, 40] as const;
