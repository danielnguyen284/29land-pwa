export interface User {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: "ADMIN" | "OWNER" | "MANAGER" | "TECHNICIAN";
  payment_qr_code?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface Ticket {
  id: string;
  room_id: string;
  room?: any; // could be typed fully if needed
  created_by: string;
  creator?: User;
  assigned_tech_id: string | null;
  assigned_tech?: User;
  title: string;
  description: string | null;
  status: "PENDING" | "IN_PROGRESS" | "WAITING_APPROVAL" | "NEEDS_EXPLANATION" | "COMPLETED" | "OVERDUE";
  created_at: string;
  updated_at: string;
  expenses?: TicketExpense[];
}

export interface TicketExpense {
  id: string;
  ticket_id: string;
  amount: number;
  description: string | null;
  receipt_photos: string[];
  status: "PENDING" | "APPROVED" | "REJECTED";
  reject_reason: string | null;
  technician_comment: string | null;
  created_at: string;
}
