export interface HubspotObject {
    id: string;
    name: string;
    type: 'deal' | 'ticket' | 'contact' | 'company';
    properties?: Record<string, string>;
} 