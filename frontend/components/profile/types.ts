export interface Profile {
  email: string;
  role: string;
  display_name: string;
  avatar?: string | null;
  phone?: string | null;
  location?: string | null;
  organization?: string | null;
  created_at: string | null;
}

export interface SessionResponse {
  access_token: string;
  expires_in?: number;
  user?: {
    email?: string | null;
    role?: string | null;
    display_name?: string | null;
    avatar?: string | null;
    phone?: string | null;
    location?: string | null;
    organization?: string | null;
  };
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  plan: string;
  member_count?: number;
}
