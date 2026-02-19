import { PermissionsConfig } from '@pulsespark/shared';
export declare function loadPermissions(workspaceRoot: string): PermissionsConfig;
export declare function savePermissions(workspaceRoot: string, config: PermissionsConfig): void;
export declare function isPathAllowed(targetPath: string, permissions: PermissionsConfig, workspaceRoot: string): boolean;
export declare function isCommandAllowed(command: string, permissions: PermissionsConfig): {
    allowed: boolean;
    reason?: string;
};
export declare function matchesDenyPattern(command: string, denyPatterns: string[]): string | null;
export declare function isCommandAllowlisted(command: string, allowlist: string[]): boolean;
export declare function requiresApproval(toolName: string, permissions: PermissionsConfig, command?: string): boolean;
