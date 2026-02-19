import { GenerateResponse } from '@pulsespark/shared';
import { ProviderAdapter, ProviderRequest, OpenAICompatibleConfig } from './types';
export declare class OpenAICompatibleProvider implements ProviderAdapter {
    name: string;
    private config;
    constructor(config: OpenAICompatibleConfig);
    generate(request: ProviderRequest): Promise<GenerateResponse>;
    private formatMessage;
}
