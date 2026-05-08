export interface LicenseVerificationResult {
  leadId: string;
  status:
    | 'Found'
    | 'Not Found'
    | 'Multiple Matches'
    | 'Needs Manual Review'
    | 'Error';
  profession?: string;
  licenseType?: string;
  licenseNumber?: string;
  licenseStatus?: string;
  expirationDate?: string;
  nameMatched?: string;
  city?: string;
  state?: string;
  source: string;
  verifiedAt: string;
  notes?: string;
}
