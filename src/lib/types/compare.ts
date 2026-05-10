// Normalized-String-Compare fuer V1.
// Bewusst dumm: kein TS-Parser, kein Generics-Handling, keine Union-Subtype-Checks.
// Trim + Whitespace-Collapse, dann strikter String-Compare. Case-sensitiv.

export function normalizeType(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

export function typesEqual(a: string, b: string): boolean {
  return normalizeType(a) === normalizeType(b);
}
