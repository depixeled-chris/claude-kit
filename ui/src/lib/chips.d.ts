// Types for the plain-JS classifier (chips.mjs), so the TS UI consumes it type-safely (KIT-T148).

export type ChipKind = 'item' | 'commit' | 'text';
export declare const ITEM_ID_RE: RegExp;
export declare const COMMIT_SHA_RE: RegExp;
export declare function classifyChip(value: string): ChipKind;
