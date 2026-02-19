export declare const scaffoldNextjs: {
    name: string;
    description: string;
    steps: {
        description: string;
        actions: {
            tool: string;
            args: {
                command: string;
            };
            description: string;
            risk: "medium";
            requires_approval: boolean;
        }[];
    }[];
};
