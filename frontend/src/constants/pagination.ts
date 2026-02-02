/** Default number of rows per page for entity tables */
export const DEFAULT_PAGE_SIZE = 10

/** Options for "rows per page" selector (used across entity pages) */
export const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100] as const

export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]
