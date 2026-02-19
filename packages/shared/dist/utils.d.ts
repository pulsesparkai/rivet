export declare function generateId(): string;
export declare function timestamp(): string;
export declare function redactSecrets(text: string): string;
export declare function containsSecrets(text: string): boolean;
export declare function interpolateEnvVars(template: string): string;
export declare function getNestedValue(obj: Record<string, unknown>, path: string): unknown;
export declare function formatTimestamp(iso: string): string;
export declare function truncate(str: string, maxLen: number): string;
