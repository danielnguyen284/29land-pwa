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
