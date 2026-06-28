export interface CustomDomain {
  id: number;
  business: number;
  domain: string;
  is_primary: boolean;
  is_verified: boolean;
  verification_method: 'dns_txt' | 'dns_cname';
  verification_status: 'pending' | 'verified' | 'failed';
  verification_token: string;
  verification_record_name: string;
  verification_record_value: string;
  last_verification_attempt: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  verification_instructions?: VerificationInstructions;
}

export interface VerificationInstructions {
  record_type: string;
  record_name: string;
  record_value: string;
  ttl: number;
  instructions: string;
}

export interface DomainSetupGuide {
  domain: string;
  verification_method: string;
  dns_instructions: {
    record_type: string;
    record_name: string;
    record_value: string;
    ttl: number;
  };
  routing_instructions: {
    record_type: string;
    record_name: string;
    record_value: string;
    ttl: number;
  };
  provider_guides: {
    [provider: string]: string[];
  };
  verification_commands: string[];
}

export interface DomainStatus {
  has_verified_domain: boolean;
  verified_domain: string | null;
  pending_domains: number;
  can_add_domain: boolean;
}

export interface DomainCheckRequest {
  domain: string;
  record_type: 'A' | 'CNAME' | 'TXT' | 'MX';
}

export interface DomainCheckResponse {
  domain: string;
  record_type: string;
  records_found: string[];
  dns_propagated: boolean;
  error?: string;
}

export interface CreateDomainRequest {
  domain: string;
  verification_method: 'dns_txt' | 'dns_cname';
}

export interface VerifyDomainResponse {
  success: boolean;
  message: string;
  domain?: CustomDomain;
}
