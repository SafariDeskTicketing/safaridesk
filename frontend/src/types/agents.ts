export interface AgentDepartment {
  id: number;
  name: string;
}

export interface AgentType {
  id: number;
  name: string;
  email: string;
  phone_number: string;
  gender: string;
  department: AgentDepartment[];
  department_name: string;
  role: string;
  status: string;
  is_active: boolean;
  date_joined: string;
  avatar_url?: string;
  csat_avg?: number | null; // Average CSAT score (0–10) for this agent
}
export interface ApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: AgentType[];
}