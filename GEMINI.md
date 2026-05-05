# Project Spec: 29LAND Operations Management System

## 1. Project Overview
- **Name:** 29LAND
- **Domain:** PropTech / Boarding House Management
- **Core Objective:** Digitalize rental operations, ensure financial transparency, and optimize incident response between Owners, Managers, and Technicians.

### Associated Documents
- **Database Schema:** [ERD.md](./ERD.md)
- **UI/UX Guidelines:** [DESIGN.md](./DESIGN.md)

## 2. Tech Stack Context (Internal Reference)
- **Frontend:** Next.js, Tailwind CSS, shadcn/ui. (Invoice images generated natively on FE).
- **Backend:** Node.js, Express, TypeORM.
- **Database:** PostgreSQL.
- **Storage:** ImgBB (for room handovers, receipts, and contract photos).
- **Auth:** Custom JWT, Phone Number + Password. Centralized provisioning (Admin creates all accounts).
- **Deployment:** Docker & Docker Compose (for easy VPS deployment).
- **Features:** PWA (for mobile usage), Web Push Notifications, Static QR Code Image Integration.

## 3. User Roles & Access Control (RBAC)
| Role | Primary Goal | Key Permissions |
| :--- | :--- | :--- |
| **Admin** | System Governance | Initialize Buildings/Rooms/Fees, User Provisioning (Admin is the only pre-existing account and creates all other accounts). |
| **Owner** | ROI Tracking | Real-time Financial Reports, Occupancy Rates, Maintenance Costs. Can own multiple buildings. |
| **Manager** | Daily Operations | Contract Mgmt, Meter Reading (Power/Water), Invoice Issuance (Zalo/Msg). Can manage multiple buildings across different Owners (filtered views). |
| **Technician**| Maintenance | Job Reception, Progress Updates, Expense Reporting with Evidence. |

## 4. Functional Domain Models

### 4.1 Asset Management
- **Hierarchy:** Building -> Floor -> Room.
- **Room Pricing:** Buildings can configure Room Classes (default prices). Each room stores its own specific `base_rent`, which can be initialized from the building's config and then manually customized.
- **Attributes:** Room status (Empty, Deposited, Occupied), Fixed Furniture Inventory, Base Rent.
- **Inventory:** Image/Video gallery for room handovers (Check-in/Check-out).

### 4.2 Utility & Billing Engine
- **Fee Configuration (JSONB):** Buildings store their custom fee structures as a JSON array (`fee_configs`) strictly categorized into 2 types (`FIXED` and `CONSUMPTION`). 
    - **Service Subscription:** Rooms subscribe to building fees using a JSON array (`service_subscriptions`), allowing them to opt-out or override default prices seamlessly without relational overhead.
    - **Consumption Tracking:** For variable costs (e.g., Electricity, Water), the system records the starting and ending index every month mapping to the specific JSON `fee_id`. A full history is saved permanently to facilitate tax declarations.
- **Invoice Generation:** 
    - Auto-calculate: Room Base Rent (calculated strictly by the room's individual price) + Fixed Costs + Consumption Costs +/- Rolling Balance (Debt/Surplus from previous months).
    - Export: Professional **Shareable Image Cards**.
    - Payment: **Static QR Code Image**. Supports uploading 1 common payment QR image per building, falling back to the owner's default QR image. No dynamic generation or bank API integration.

### 4.3 Ticketing System (Maintenance)
- **Workflow:** Manager Create -> Push Notification -> Technician Accept -> Progress Update -> Completion Report (with Receipt Photos/Costs for claims).
- **Approval Flow:** If Owner rejects a claim, status changes to "Needs Explanation". Manager mediates between Owner and Technician.
- **Status Tracking:** Pending, In Progress, Needs Explanation, Completed, Overdue.

### 4.4 Contract & Tenant Management
- **Tenant Data:** Identity (CCCD), Contact, History. 1 Representative per room for billing; others stored for temporary residence registration.
- **Contract Lifecycle:** New, Renewal (flexible months), Termination. Supports multi-page contract photo uploads.
- **Deposit Handling:** On termination, Manager confirms financial status. Formula: (Deposit) - (Last Month Rent/Utilities) - (Damage Fees) = Actual Refund. Handled gracefully for mid-term room passes or abandonments.
- **Alerts:** Notify when contracts have <30 days remaining.

## 5. Business Logic & Constraints
- **Financial Integrity:** All expenses reported by Technicians must have photo evidence for Owner approval.
- **Communication:** System-wide announcements (e.g., Power outage notices) with image support.
- **Rolling Balance:** Under/over payments are automatically tracked and applied to the next billing cycle.

## 6. Development Principles
- **No Technical Sprawl:** Focus on management business flows and user roles as defined.
- **Visual-First:** Invoices must be aesthetically professional for sharing on messaging apps.
- **Data Isolation:** Ensure Tenant and Financial data are strictly partitioned by Building/Owner, especially for multi-owner Managers.
- **Consistent Design:** Luôn dùng màu xanh chủ đạo (primary color) của dự án, không tuân theo màu của các mockup (mockup chỉ dùng để tham khảo layout). Đảm bảo không bao giờ để xảy ra tình trạng có 2 thanh tiêu đề (header) cùng tồn tại (ví dụ: một cái của layout, một cái của page).
- **UI Components:** Luôn hiển thị tên (name/label) thay vì ID khi sử dụng component Select. Cần truyền tường minh children cho `<SelectValue>` nếu component mặc định hiển thị ID.