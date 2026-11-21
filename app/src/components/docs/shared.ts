/** The look of the dictionary's search box (matches the other inputs: height, border, background from the theme). */
export const inputStyleClass = 'h-9 w-72 max-w-full rounded-lg border border-(--pillBorder) bg-(--inputBg) px-3 text-[14px] text-(--text)'

export const chip = 'rounded-full border border-(--border) px-2.5 py-0.5 text-xs text-(--muted)'
export const dictLink = (name: string): string => `#/docs/dictionary?q=${encodeURIComponent(name)}`
