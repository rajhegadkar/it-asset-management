# User & Support Engineer Handbook

This guide instructs **Support Engineers** and **End Employees** on utilizing the **IT Asset Management (ITAM)** web application for day-to-day operations.

---

# Part 1: Support Engineer Guide

As a Support Engineer, your responsibilities include auditing inventory, issuing laptops and peripherals, receiving returned hardware, and performing repairs.

---

## 1. Finding & Scanning Assets

The system supports multiple fast lookup methods:

### Method A: Camera / Webcam Scanner
1. Click the **Scan Barcode** button in the top navigation bar or under the **Assets** page.
2. Allow browser camera permissions.
3. Align the asset's QR code or Code 128 / Code 39 barcode within the viewfinder box.
4. The scanner automatically detects the tag and opens the asset detail sheet.

### Method B: Physical USB Hardware Scanner Gun
1. Connect any plug-and-play USB barcode gun or Bluetooth scanner.
2. The application listens globally for high-speed scanner keyboard emulation.
3. Pull the trigger on any asset label: the modal opens automatically with full asset specs.

### Method C: Universal Search
Type into the global search bar:
- Asset Tag (e.g., `IT-LAP-000001`)
- Serial Number (e.g., `SN-DELL-98721`)
- MAC Address or Hostname
- Assigned Employee Name

---

## 2. Asset Allocation Workflow

To issue hardware to an employee:

1. Navigate to **Allocations** (`/allocations`) and click **New Allocation** (or click **Allocate** on the Asset Details page).
2. **Select Asset**: Only items in `Available` or `In Stock` status can be selected.
3. **Select Employee**: Search by employee name or Employee ID.
4. **Choose Allocation Type**:
   - `Permanent`: Standard employee workstation or laptop.
   - `Temporary / Loaner`: Short-term loaner while primary device is in repair.
   - `Remote Work`: Equipment dispatched for home office use.
   - `Project`: Hardware assigned to a specific client engagement.
5. **Set Expected Return Date**: Optional for permanent, required for temporary/loaners.
6. **Include Accessories**: Check off accessories provided (e.g., *65W USB-C Charger, Laptop Bag, HDMI Cable, Wireless Mouse*).
7. Click **Confirm Allocation**.

---

## 3. Digital Handover & Electronic Signature

To maintain chain of custody and avoid physical paper forms:

1. After confirming the allocation, the **Handover Signature Modal** opens (or click **Sign Handover** on the allocation record).
2. Have the employee sign on the touch screen, tablet, or with the mouse.
3. Click **Submit Signature**.
4. The backend automatically renders a tamper-evident **Asset Handover Certificate (PDF)** containing:
   - Corporate header with logo and address.
   - Asset serial number, specifications, and accessories list.
   - Terms of usage and hardware custody agreement.
   - Digitally timestamped employee signature.
5. Click **Download Handover PDF** or send it to the employee's inbox with one click.

---

## 4. Asset Return Workflow

When an employee departs, changes roles, or returns a loaner device:

1. Navigate to **Allocations**, locate the active assignment, and click **Process Return**.
2. **Inspect Hardware Condition**:
   - `Good`: Normal wear and tear; ready to return to stock.
   - `Damaged / Repair Required`: Hardware fault, cracked screen, or liquid damage.
   - `Retired`: Device has reached End-of-Life.
3. **Verify Accessories**: Check off returned accessories. Note any missing chargers or dongles.
4. **Photos & Notes**: Upload photos of any damage.
5. Click **Complete Return**:
   - The asset status reverts immediately to `Available` (or `Under Maintenance` if damaged).
   - An official **Return Receipt** is generated and archived.

---

## 5. Maintenance & Repair Logs

Record all servicing and upgrades under **Maintenance** (`/maintenance`):

1. Click **Schedule Maintenance**.
2. Select the asset and enter:
   - **Maintenance Type**: Preventive, Hardware Repair, Upgrade (RAM/SSD), Calibration.
   - **Provider**: Internal IT Team or External Authorized Service Center (Vendor).
   - **Cost**: Total parts and labor expense.
   - **Parts Replaced**: e.g., *Replaced 256GB SSD with 1TB NVMe, new battery*.
3. Marking maintenance as **Completed** updates the asset status back to `Available` and recalculates total cost of ownership (TCO).

---

## 6. Service Tickets & Helpdesk

1. Under **Tickets** (`/tickets`), view issues reported by employees.
2. Assign the ticket to yourself or a colleague.
3. Update ticket status: `Open` -> `In Progress` -> `Resolved` -> `Closed`.
4. Log internal technician notes or post customer-visible updates.

---

# Part 2: Employee Portal Guide

The Employee Portal provides a clean self-service experience for all company staff.

---

## 1. Logging In
1. Visit the corporate ITAM URL (e.g., `https://itam.yourcompany.com`).
2. Log in using your corporate email address and password.
3. If logging in as an employee, you are automatically directed to **My Assets** (`/my-assets`).

---

## 2. Viewing Assigned Hardware
Under **My Assigned Assets**, you can view all equipment currently in your custody:
- Laptops, monitors, mobile phones, security badges.
- Serial numbers, specifications, and assignment dates.

---

## 3. Signing Handover Certificates
1. When IT issues new hardware, a notification prompt will appear: *"Action Required: Please sign handover certificate"*.
2. Review the equipment specs and listed accessories.
3. Sign using your finger or mouse cursor in the signature box.
4. Click **Confirm & Accept Custody**.
5. You can download a signed copy of the PDF certificate at any time for your personal records.

---

## 4. Reporting an Issue / Requesting Support
If your hardware is malfunctioning, damaged, or stolen:
1. Click **Report Issue** next to the affected device.
2. Select the issue category (e.g., *Battery not charging, Broken screen, Software crash, Lost/Stolen*).
3. Describe the problem in detail and attach screenshots or photos.
4. Click **Submit Ticket**.
5. Track the engineer's response and resolution in real time under **My Tickets**.
