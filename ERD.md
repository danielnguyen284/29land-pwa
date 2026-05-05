# Entity-Relationship Diagram (ERD) - 29LAND

Based on the operations management requirements for 29LAND, here is the Database Entity-Relationship design. 

## 1. Mermaid ER Diagram

```mermaid
erDiagram
    USERS {
        uuid id PK
        string role "ADMIN, OWNER, MANAGER, TECHNICIAN"
        string name
        string phone
        string email
        string password_hash
    }

    BUILDINGS {
        uuid id PK
        uuid owner_id FK
        string name
        string address
        string payment_qr_code "Common QR for the building"
        int invoice_closing_date "Fixed day of month, e.g., 1"
        jsonb fee_configs "Array: [{id, name, type(FIXED/CONSUMPTION), unit_price}]"
        datetime created_at
    }

    BUILDING_MANAGERS {
        uuid manager_id FK
        uuid building_id FK
    }

    ROOM_CLASSES {
        uuid id PK
        uuid building_id FK
        string name "e.g., Studio, 1BR"
        decimal default_base_rent
    }

    FLOORS {
        uuid id PK
        uuid building_id FK
        string name
    }

    ROOMS {
        uuid id PK
        uuid floor_id FK
        uuid room_class_id FK "Nullable"
        string name
        decimal base_rent "Specific price for this room"
        string status "EMPTY, DEPOSITED, OCCUPIED"
        jsonb fixed_furniture "Inventory mapping"
        jsonb service_subscriptions "Array: [{fee_id, override_price}]"
    }

    TENANTS {
        uuid id PK
        uuid room_id FK
        string name
        string cccd
        string phone
        boolean is_representative "True for contract holder"
        string status "ACTIVE, INACTIVE"
    }

    CONTRACTS {
        uuid id PK
        uuid room_id FK
        uuid representative_tenant_id FK
        date start_date
        date end_date
        decimal rent_amount
        decimal deposit_amount
        string status "NEW, ACTIVE, EXPIRED, TERMINATED"
        jsonb document_photos "Array of image URLs"
    }

    CONSUMPTION_RECORDS {
        uuid id PK
        uuid room_id FK
        string fee_id "Matches fee_id in building fee_configs"
        string billing_period "e.g., 2026-05"
        int start_index
        int end_index
        int usage_amount
        uuid recorded_by FK "Manager ID"
        datetime created_at "Historical log for tax purposes"
    }

    INVOICES {
        uuid id PK
        uuid room_id FK
        uuid contract_id FK
        date issue_date
        decimal rent_amount
        decimal rolling_balance "Debt (+) or Surplus (-) from previous"
        decimal total_amount
        decimal paid_amount
        string status "UNPAID, PARTIAL, PAID"
    }

    INVOICE_ITEMS {
        uuid id PK
        uuid invoice_id FK
        string fee_id "Nullable for base rent, matches fee config ID"
        string description "e.g., Electricity: 100 * 3500"
        decimal amount
    }

    TICKETS {
        uuid id PK
        uuid room_id FK
        uuid created_by FK "Manager ID"
        uuid assigned_tech_id FK "Nullable"
        string title
        text description
        string status "PENDING, IN_PROGRESS, NEEDS_EXPLANATION, COMPLETED, OVERDUE"
        datetime created_at
    }

    TICKET_EXPENSES {
        uuid id PK
        uuid ticket_id FK
        decimal amount
        text description
        jsonb receipt_photos "Evidence for Owner approval"
        string status "PENDING, APPROVED, REJECTED"
    }

    %% Relationships
    USERS ||--o{ BUILDINGS : "owns (Owner)"
    USERS ||--o{ BUILDING_MANAGERS : "is assigned as Manager"
    BUILDINGS ||--o{ BUILDING_MANAGERS : "has Manager"
    
    BUILDINGS ||--o{ ROOM_CLASSES : "configures"
    ROOM_CLASSES ||--o{ ROOMS : "templates"
    BUILDINGS ||--o{ FLOORS : "has"
    FLOORS ||--o{ ROOMS : "contains"
    
    ROOMS ||--o{ TENANTS : "houses"
    ROOMS ||--o{ CONTRACTS : "leased via"
    TENANTS ||--o{ CONTRACTS : "representative of"
    
    ROOMS ||--o{ CONSUMPTION_RECORDS : "consumes"
    USERS ||--o{ CONSUMPTION_RECORDS : "records"
    
    CONTRACTS ||--o{ INVOICES : "generates"
    ROOMS ||--o{ INVOICES : "billed for"
    INVOICES ||--o{ INVOICE_ITEMS : "contains"
    
    ROOMS ||--o{ TICKETS : "reports issue"
    USERS ||--o{ TICKETS : "creates (Manager) / assigned (Tech)"
    TICKETS ||--o{ TICKET_EXPENSES : "incurs"
```

## 2. Key Domain Concepts Explained

### User & Access Management
- **`USERS`**: A single table handling all roles (`ADMIN`, `OWNER`, `MANAGER`, `TECHNICIAN`). 
- **`BUILDING_MANAGERS`**: A pivot table resolving the Many-to-Many relationship since a Manager can manage multiple buildings across different Owners, ensuring data isolation.

### Assets & Tenancy
- **Hierarchy**: `BUILDINGS` ➔ `FLOORS` ➔ `ROOMS`. 
- **Room Pricing**: `ROOM_CLASSES` acts as a template for prices in a building. However, each `ROOMS` record stores its own `base_rent` directly, allowing users to apply the config class but still input a specific room price independently. Invoices will strictly pull this `base_rent` to calculate bills.
- **`TENANTS`**: Everyone living in the room is logged here for temporary residence registration. However, only **one** tenant is marked as `is_representative = true`.
- **`CONTRACTS`**: Tied directly to the representative tenant and the room. Handover photos are stored directly in `document_photos`.

### Billing & Invoices
- **`fee_configs` & `service_subscriptions` (JSONB)**: To maximize flexibility, buildings define their fee dictionary in `BUILDINGS.fee_configs`. Each room then maintains an array of `service_subscriptions` within `ROOMS` mapping to those fees, allowing easy opt-outs or price overrides without complex relational tables.
- **`CONSUMPTION_RECORDS`**: Tracks the start and end indices of any consumption-based fee (electricity, water, etc.) for each room mapping to a specific JSON `fee_id`. A permanent history is maintained for tax declaration.
- **`INVOICES` & `INVOICE_ITEMS`**: Invoices are dynamically generated. Fixed costs are auto-added based on the room's subscriptions, and consumption costs are calculated from records. Line items (`INVOICE_ITEMS`) store the exact breakdown.
    - `rolling_balance`: Handles over-payment or under-payment, rolling over to the next invoice.

### Maintenance & Ticketing
- **`TICKETS`**: Managed primarily by Manager and assigned to Technician. Tracks the lifecycle of the maintenance task.
- **`TICKET_EXPENSES`**: Separated from the ticket itself so that a single ticket can have multiple expense claims (materials bought). If an expense is `REJECTED` by the Owner, the parent ticket state shifts to `NEEDS_EXPLANATION`.
