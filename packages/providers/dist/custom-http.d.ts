import { GenerateResponse } from '@pulsespark/shared';
import { ProviderAdapter, ProviderRequest, CustomHttpConfig } from './types';
export declare class CustomHttpProvider implements ProviderAdapter {
    name: string;
    private config;
    constructor(config: CustomHttpConfig);
    generate(request: ProviderRequest): Promise<GenerateResponse>;
    private buildBody;
    private parseResponse;
}
