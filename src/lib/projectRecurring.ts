export function projectRecurringInRange<T extends { data: string; recorrente?: boolean }>(
  physical: T[],
  recurring: T[],
  startISO: string,
  endISO: string,
  skipped?: Set<string>
): T[] {
  const startD = new Date(startISO + "T00:00:00");
  const endD = new Date(endISO + "T00:00:00");
  const result: T[] = physical.filter((p: any) => {
    if (p.is_parcelada) return true;
    if (!p.recorrente) return true;
    const mesAno = (p.data || "").substring(0, 7);
    const key = `${p.id}:${mesAno}`;
    return !skipped?.has(key);
  });
  const physicalKeys = new Set(physical.map((p: any) => `${p.id}:${(p.data || "").substring(0, 7)}`));
  const cursor = new Date(startD.getFullYear(), startD.getMonth(), 1);
  while (cursor <= endD) {
    const mesAno = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    recurring.forEach(rec => {
      const id = (rec as any).id;
      const rMes = ((rec as any).data || "").substring(0, 7);
      if (rMes && rMes > mesAno) return;
      const ate = (rec as any).recorrente_ate;
      if (ate && mesAno > ate) return;
      if (physicalKeys.has(`${id}:${mesAno}`)) return;
      if (skipped?.has(`${id}:${mesAno}`)) return;
      const rDay = ((rec as any).data || "").substring(8, 10) || "01";
      result.push({ ...(rec as any), id: `virtual_${id}_${mesAno}`, data: `${mesAno}-${rDay}`, _virtual: true, _originalId: id });
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return result;
}
