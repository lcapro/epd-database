export function extractDatabaseVersions(text: string): { nmd?: string; ecoinvent?: string } {
  const nmd = text.match(/nationale\s+milieudatabase\s+v?\s*([0-9]+(?:\.[0-9]+)*)/i)?.[1];
  const ecoinvent = text.match(/ecoinvent\s*v?\s*([0-9]+(?:\.[0-9]+)*)/i)?.[1];
  return { nmd, ecoinvent };
}
