export declare const seoAuditBasic: {
    name: string;
    description: string;
    steps: ({
        description: string;
        actions: {
            tool: string;
            args: {
                query: string;
                globs: string;
            };
            description: string;
            risk: "low";
            requires_approval: boolean;
        }[];
    } | {
        description: string;
        actions: {
            tool: string;
            args: {
                path: string;
                content: string;
            };
            description: string;
            risk: "medium";
            requires_approval: boolean;
        }[];
    })[];
};
