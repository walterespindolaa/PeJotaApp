// Merge recurring items started in prior months into the target month view.
// Extras receive a virtual id and _virtual/_originalId markers so downstream
// helpers (deriveItemStatus, upsertPagamento) can resolve the real record.

export type RecurringItem = {
  id: string;
  recorrente?: boolean;
  [key: string]: any;
};

export const mergeRecurring = <T extends RecurringItem>(
  monthItems: T[],
  allRecurring: T[],
  dateField: string,
  mesAnoTarget: string
): T[] => {
  const existingOriginalIds = new Set(monthItems.map(i => i.id));
  const extras: T[] = [];
  allRecurring.forEach(item => {
    if (existingOriginalIds.has(item.id)) return;
    const itemMes = item[dateField]?.substring(0, 7);
    if (itemMes && itemMes <= mesAnoTarget) {
      const ate = (item as any).recorrente_ate;
      if (ate && mesAnoTarget > ate) return;
      const day = item[dateField]?.substring(8, 10) || "01";
      extras.push({
        ...item,
        id: `virtual_${item.id}_${mesAnoTarget}`,
        [dateField]: `${mesAnoTarget}-${day}`,
        _virtual: true,
        _originalId: item.id,
      } as T);
    }
  });
  return [...monthItems, ...extras];
};
