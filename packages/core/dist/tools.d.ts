import { ToolDefinition, ToolResult, ToolCall, PermissionsConfig } from '@pulsespark/shared';
export declare const TOOL_DEFINITIONS: ToolDefinition[];
export declare function executeTool(call: ToolCall, workspaceRoot: string, permissions: PermissionsConfig): ToolResult;
export declare function generateDiff(filePath: string, oldContent: string, newContent: string): string;
