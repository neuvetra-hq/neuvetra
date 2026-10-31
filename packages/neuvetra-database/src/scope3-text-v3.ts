/** Presentation for newly prepared v3 reports. Persisted screening tokens and earlier report bytes stay unchanged. */
export const SCOPE3_REPORT_TEXT_V3 = {
  screening: { included: 'Included', excluded: 'Excluded', not_relevant: 'Not applicable', not_screened: 'Not screened' },
  status: { excluded: 'Excluded', not_relevant: 'Not applicable' } as Readonly<Record<string, string>>,
  screeningConflict: 'Records exist in a category screened as excluded or not applicable. Their calculated figures remain in the known-source subtotal until the screening or records are corrected.',
  processingPartnerDataOnly: 'Category 10 supports partner-reported processing emissions and metered processing-site energy. A general average-data processing estimate is unavailable in this beta. Obtain processor data; missing data remains an open issue, not zero.',
} as const

/** Group an exact decimal string for narrative display; never round or recalculate the figure. */
export function scope3GroupDecimal(text: string): string {
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return text
  const [whole, fraction] = text.split('.')
  return whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : `.${fraction}`)
}
