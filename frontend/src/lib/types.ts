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

export interface Tenant {
  id: string;
  name: string;
  phone: string;
}

export interface Ticket {
  id: string;
  building_id: string;
  building?: any;
  room_id?: string | null;
  room?: any; // could be typed fully if needed
  representative_tenant?: Tenant | null;
  created_by: string;
  creator?: User;
  assigned_tech_id: string | null;
  assigned_tech?: User;
  title: string;
  description: string | null;
  priority: string;
  evidence_photos: string[];
  status: "PENDING" | "WAITING_APPROVAL" | "COMPLETED" | "OVERDUE";
  created_at: string;
  updated_at: string;
  expenses?: TicketExpense[];
}

export interface TicketExpense {
  id: string;
  ticket_id: string;
  amount: number;
  description: string | null;
  accounting_period: string | null;
  receipt_photos: string[];
  status: "PENDING" | "APPROVED";
  created_at: string;
}

export interface TransactionCategory {
  id: string;
  building_id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  created_at: string;
}

export interface Transaction {
  id: string;
  building_id: string;
  building?: any;
  room_id?: string | null;
  room?: any;
  category_id: string;
  category?: TransactionCategory;
  amount: number;
  type: "INCOME" | "EXPENSE";
  accounting_period: string;
  description: string | null;
  invoice_photos: string[];
  product_photos: string[];
  created_by: string;
  creator?: User;
  created_at: string;
}
