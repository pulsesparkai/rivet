import { GenerateResponse } from '@pulsespark/shared';
import { ProviderAdapter, ProviderRequest, AnthropicConfig } from './types';
export declare class AnthropicProvider implements ProviderAdapter {
    name: string;
    private config;
    constructor(config: AnthropicConfig);
    generate(request: ProviderRequest): Promise<GenerateResponse>;
    private formatMessage;
}
