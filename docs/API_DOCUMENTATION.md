# Enterprise ITAM - REST API Documentation

The ITAM system exposes a RESTful API with JSON envelopes, HTTP status codes, and JWT Bearer authentication.

Interactive Swagger UI documentation is available at:
```
http://localhost:5000/api/docs
```

## Standard Response Envelopes

### Success Envelope
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "pagination": {
    "total": 120,
    "page": 1,
    "limit": 20,
    "totalPages": 6
  }
}
```

### Error Envelope
```json
{
  "success": false,
  "message": "Asset cannot be allocated because it is already assigned.",
  "code": "ASSET_ALREADY_ASSIGNED",
  "errors": []
}
```

## Key API Endpoints

### 1. Authentication (`/api/v1/auth`)
- `POST /login`: Authenticate with email/username and password. Optional TOTP `totpCode`.
- `POST /refresh-token`: Refresh expired JWT access token.
- `GET /profile`: Retrieve current session details and permissions.
- `POST /setup-2fa`: Generate TOTP 2FA secret and QR code URI.
- `POST /enable-2fa`: Verify and activate two-factor authentication.
- `POST /change-password`: Update account password.

### 2. IT Assets (`/api/v1/assets`)
- `GET /`: Search and paginate assets (`?search=&status=&categoryId=&departmentId=&page=&limit=`).
- `GET /dashboard-metrics`: Aggregated KPI counts, chart series, and alerts.
- `GET /:id`: Full asset details with hardware specs, custody, tickets, and lifecycle logs.
- `POST /`: Create asset with auto-generated Asset ID and barcode.
- `PUT /:id`: Update asset specifications.
- `DELETE /:id`: Archive asset from active inventory.
- `POST /labels/pdf`: Generate printable Code128 & QR label sheet PDF.

### 3. Allocations & Handover (`/api/v1/allocations`)
- `GET /assignments`: List active and historical custody allocations.
- `POST /allocate`: Issue asset to employee with accessories and email notice.
- `POST /acknowledge/:id`: Submit digital custody acceptance and signature.
- `GET /handover-pdf/:id`: Stream official Handover Certificate PDF.
- `POST /return`: Process hardware return with condition inspection.
- `POST /transfer`: Reassign asset between employees or departments.
- `POST /dispose`: Permanently dispose of retired asset.

### 4. Helpdesk Support (`/api/v1/tickets`)
- `GET /`: List tickets with status and priority filtering.
- `GET /:id`: View ticket discussion thread.
- `POST /`: Raise new ticket with SLA assignment.
- `PUT /:id`: Update ticket status or assigned engineer.
- `POST /:id/comments`: Add comment or internal troubleshooting note.

### 5. Maintenance (`/api/v1/maintenance`)
- `GET /`: List maintenance work orders.
- `POST /`: Schedule preventive or corrective servicing.
- `PUT /:id/complete`: Record work performed, parts replaced, and cost.

### 6. Software Asset Management (`/api/v1/licenses`)
- `GET /`: List software licenses and seat quotas.
- `POST /`: Register software license.
- `POST /:id/assign`: Assign seat to employee or device.
- `DELETE /assignment/:assignmentId`: Revoke seat quota.

### 7. Consumables & Spares (`/api/v1/consumables`)
- `GET /`: List spare parts with low stock indicators (`?lowStockOnly=true`).
- `POST /`: Add new consumable item.
- `POST /:id/transaction`: Record inward restock or outward dispatch.

### 8. Reports & Data Import/Export (`/api/v1/reports`, `/api/v1/imports`)
- `GET /reports/inventory`: Complete asset fleet audit.
- `GET /reports/warranty`: Warranties expiring in 90, 30, or 7 days.
- `GET /reports/export?entity=assets&format=xlsx|csv`: Export data.
- `GET /imports/template/:type`: Download pre-formatted Excel template (`assets`, `employees`, etc.).
- `POST /imports/upload/:type`: Upload XLSX/CSV file with live validation and duplicate detection.
