export function groupSas(sas: string): string {
  return sas.length === 6 ? `${sas.slice(0, 3)} ${sas.slice(3)}` : sas;
}
