# UI/UX Design System: 29LAND

## 1. Design Philosophy
- **Vibe:** Minimalist & Speed-focused, mixed with **Banking App Layouts** for the main dashboard. Clean typography (using Plus Jakarta Sans font), high contrast, focused entirely on data readability and operational efficiency. The main dashboard should feature a clean summary of key metrics followed by a grid of "Quick Actions" (Tiện ích) similar to modern banking apps (e.g., MBBank, TPBank).
- **Primary Color:** `#15803D` (Tailwind Green 700). Used for primary buttons, active states, and brand highlights.
- **Theme:** Full support for both **Light Mode** and **Dark Mode** (implemented via Tailwind CSS and `next-themes`).
- **Iconography:** Strict use of a dedicated icon library (e.g., `lucide-react`). **No raw inline SVGs** are allowed in the codebase to ensure consistency and clean component structures.

## 2. Layout & Responsiveness
- **Responsive PWA:** The application is built as a Progressive Web App. It must fully support the "Add to Home Screen" prompt with a valid `manifest.json` and service worker, providing a native-app-like experience on mobile.
- **Adaptive UI:**
    - **Mobile:** Touch-friendly interfaces, bottom navigation bar for core screens, and banking-style quick action grids.
    - **Desktop:** Expanded dashboard layout with a persistent sidebar, utilizing the extra screen space for complex reporting.

## 3. Core Component Patterns
- **Room Display (Card-Based):** 
    - Rooms are visualized as interactive **Cards** rather than dense tables.
    - Each card surfaces critical information at a glance: Room Status (colored badges), Base Rent, and current Tenant.
    - Touch targets on cards must be large enough for easy tapping on mobile.
- **Data Entry (Meters & Billing):**
    - Numeric inputs (electricity, water) must trigger the numeric keypad on mobile devices.
    - Clean forms leveraging `shadcn/ui` components for consistency.

## 4. Invoice Image Design (Shareable)
- **Format:** Generated natively on the Frontend (e.g., via `html2canvas` or `satori`) and exportable as an image for Zalo/Messenger sharing.
- **Vibe:** **Formal & Detailed (EVN Bill Style)**.
    - Structured tabular layout.
    - Explicit itemization: Base Rent, Fixed Costs, Consumption Costs (must show Start Index ➔ End Index = Usage), and Rolling Balance (Debt/Surplus).
    - Clear Total Amount.
    - Attached Static QR Code image at the bottom for easy payment scanning.
