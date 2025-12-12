export interface ApprovedCoursesParser {
  parse(input: unknown): Set<string>;
}

export class DefaultApprovedCoursesParser implements ApprovedCoursesParser {
  constructor(private readonly normalizeCode: (value: unknown) => string) {}

  parse(input: unknown): Set<string> {
    const codes = new Set<string>();

    const process = (value: unknown) => {
      if (value === null || value === undefined) return;
      if (Array.isArray(value)) {
        value.forEach(process);
        return;
      }
      if (typeof value === "string") {
        value
          .split(/[;,]|\s+y\s+|\s+o\s+|\s*\+\s*|\s*\/\s*/i)
          .map((item) => item.trim())
          .filter(Boolean)
          .forEach((item) => {
            const normalized = this.normalizeCode(item);
            if (normalized) codes.add(normalized);
          });
        return;
      }
      if (typeof value === "number") {
        const normalized = this.normalizeCode(value);
        if (normalized) codes.add(normalized);
        return;
      }
      if (typeof value === "object") {
        Object.values(value as Record<string, unknown>).forEach(process);
      }
    };

    process(input);
    return codes;
  }
}