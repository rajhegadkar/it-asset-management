# Administrator Handbook

Welcome to the **IT Asset Management (ITAM)** Administrator Handbook. This guide details how to configure, administer, and maintain the platform.

---

## 1. Roles & Permissions Architecture

The system provides four default enterprise roles built on an extensible Role-Based Access Control (RBAC) engine:

| Role | Description | Key Capabilities |
|------|-------------|------------------|
| **Super Admin** | Platform Owner | Full administrative control: organization settings, security policies, backup management, user creation, roles & permissions, audit logs, and system health. |
| **IT Admin** | Operational IT Manager | Asset inventory management, assignments, returns, maintenance, license management, consumables, imports/exports, and department/location configuration. |
| **Support Engineer** | Desktop Support / Field Tech | Barcode scanning, asset allocation and return workflows, hardware inspection, maintenance logging, and service ticket handling. |
| **Employee / User** | End User | Self-service portal: view assigned assets, digital signature of handover certificates, report hardware issues, and download handover PDFs. |

---

## 2. Organization Branding & Master Settings

Navigate to **Settings** (`/settings`) to configure:

### Company Information
- **Company Name**: Rendered on all printable barcode labels, PDF handover receipts, and email headers.
- **Tax / VAT / GST ID**: Included in purchase and disposal documentation.
- **Company Logo**: High-resolution PNG/SVG uploaded and displayed in navigation headers and generated PDF documents.
- **Support Contact & Website**: Embedded in employee handover emails and notification footers.

### Asset Auto-Numbering Patterns
Configure automated asset tagging rules:
- **Default Format**: `{PREFIX}-{CAT}-{NUMBER}` (e.g., `ACME-LAP-000042`)
- **Prefix**: Custom corporate prefix (e.g., `IT`, `CORP`, `TECH`).
- **Zero-Padding**: Configurable digit length (4 to 8 digits).
- **Auto-Increment**: Database-enforced atomic increment preventing duplicate tag collision.

---

## 3. Organizational Master Data Setup

Before registering hardware, establish the foundation hierarchy:

### A. Hierarchical Locations
Define physical presence across:
- **Sites / Offices**: e.g., *Headquarters - New York*, *Branch - London*
- **Buildings & Floors**: e.g., *Tower A - Floor 4*
- **Rooms & Racks**: e.g., *Server Room B - Rack 04*

Assets can be allocated to specific physical rooms or data center racks to streamline physical inventory audits.

### B. Departments & Cost Centers
- Establish business units: *Engineering (CC-101)*, *Finance (CC-204)*, *Sales (CC-305)*, *Information Technology (CC-001)*.
- Assets track both the **Assigned Employee's Department** and the **Owner / Financial Department** for depreciation and budget allocation.

### C. Approved Vendors & Service Providers
- Register hardware distributors, OEM providers, and repair facilities.
- Maintain vendor contracts, contact persons, support hotlines, and service level agreements (SLAs).

---

## 4. Asset Taxonomy & Category Management

The system comes pre-seeded with 10 standard category families and over 50 asset types:

1. **Computing**: Laptops, Desktops, Workstations, MacBooks, Tablets, Thin Clients.
2. **Servers**: 1U/2U Rack Servers, Blade Servers, Tower Servers, Storage NAS/SAN, Hypervisors.
3. **Networking**: Managed Switches, Core Routers, Firewalls, Access Points, Wi-Fi Controllers, Patch Panels.
4. **Displays**: LED Monitors, Curved Displays, Conference Projectors, TV Panels.
5. **Peripherals**: Ergonomic Keyboards, Mice, Webcams, USB-C Docks, Barcode Scanners.
6. **Components**: CPUs, RAM Modules, NVMe SSDs, GPUs, Power Supplies, Laptop Batteries.
7. **Mobile**: Corporate Smartphones, 5G Hotspots, SIM Cards.
8. **Power & Facilities**: UPS Systems, Rack PDUs, Surge Protectors, Inverters.
9. **Security**: Biometric Terminals, CCTV Cameras, Access Control Panels.
10. **Software Licenses**: Operating Systems, Productivity Suites, Cloud Subscriptions.

### Custom Fields (Dynamic JSON Attributes)
Categories support dynamic JSON fields:
- *Laptops*: RAM (GB), Storage Size, CPU Model, OS Version, MAC Address.
- *Switches*: Port Count, PoE Wattage, Management IP, Firmware Version.
- *Vehicles / Facilities*: Serial, Registration Number, Odometer.

---

## 5. User & Employee Administration

### Creating Users vs Employees
- **Employees**: Business personnel who can receive hardware allocations. Contain Employee ID, Department, Designation, Manager, and Joining Date.
- **Users**: System login credentials (Email, Password, Role) bound to an Employee record.

### Security & Password Policies
Under **Settings -> Security Policy**:
- **Minimum Password Length**: Default 8 characters (Recommended: 12+).
- **Complexity Requirements**: Upper, lower, numeric, and special character enforcement.
- **Account Lockout**: Automatically locks user after 5 failed login attempts for 15 minutes.
- **Session Duration**: JWT lifetime configuration (Default: 8 hours access, 7-day refresh).
- **Two-Factor Authentication (2FA)**: Support for TOTP standard (Google Authenticator, Microsoft Authenticator, 1Password).

---

## 6. Bulk Data Import & Export

To onboard legacy spreadsheets or thousands of assets:

1. Navigate to **Assets** or **Employees** and click **Import CSV/XLSX**.
2. Download the pre-formatted **Sample Template** (`/api/v1/import-export/template/assets`).
3. Fill in required columns: `Asset Tag`, `Name`, `Category`, `Serial Number`, `Status`, `Vendor`, `Cost`.
4. Upload the file. The validator runs pre-flight checks:
   - Validates existence of Categories, Locations, and Vendors.
   - Flags duplicate Serial Numbers or Asset Tags before writing to the database.
   - Reports rows with errors with specific line-number feedback.

---

## 7. Software Asset Management (SAM)

Manage software license compliance under **Licenses** (`/licenses`):

- **License Models**: Perpetual, Annual Subscription, OEM, Cloud / Per-Seat.
- **Seat Allocation**: Attach license keys to specific assets or employees.
- **Compliance Monitoring**: Real-time counter of `Allocated Seats` vs `Purchased Seats`. The system warns if utilization exceeds 100%.
- **Expiry Notifications**: Built-in cron scheduler triggers alerts at 90, 30, and 7 days prior to license renewal dates.

---

## 8. Consumables & Stock Management

Track items consumed rather than tracked individually (e.g., Cat6 patch cables, toner cartridges, HDMI adapters):

- Set **Minimum Threshold Quantity**.
- When stock falls below threshold, automated alerts are broadcast to the IT Admin dashboard.
- Check-out log records: *Quantity, Checked out by, Given to Employee, Reason/Project*.

---

## 9. Audit Logs & Compliance Reporting

Every mutation across the system generates an immutable audit record:
- **Timestamp**: High-precision UTC timestamp.
- **Actor**: User ID, Name, Role, and client IP address.
- **Action Type**: `CREATE`, `UPDATE`, `DELETE`, `ALLOCATE`, `RETURN`, `MAINTENANCE`, `LOGIN`.
- **Entity**: Table name and record ID.
- **Payload**: Full JSON representation of Before and After states.

Audit logs are exportable to CSV/Excel for compliance, SOC2, ISO 27001, and financial asset depreciation audits.
