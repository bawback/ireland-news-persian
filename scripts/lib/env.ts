export function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") throw new Error(`Missing environment variable: ${name}`);
  return v;
}

export function envOptional(name: string): string | undefined {
  const v = process.env[name];
  return v ? v : undefined;
}

export function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  return v ? Number.parseInt(v, 10) : fallback;
}

export function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (!v) return fallback;
  return ["1", "true", "yes"].includes(v.toLowerCase());
}
