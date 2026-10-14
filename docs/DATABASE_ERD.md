# Enterprise ITAM - Database Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    ORGANIZATION ||--o{ USER : contains
    ORGANIZATION ||--o{ ROLE : defines
    ORGANIZATION ||--o{ DEPARTMENT : organizes
    ORGANIZATION ||--o{ LOCATION : operates
    ORGANIZATION ||--o{ VENDOR : contracts
    ORGANIZATION ||--o{ CATEGORY : categorizes
    ORGANIZATION ||--o{ ASSET : owns
    ORGANIZATION ||--o{ EMPLOYEE : employs
    ORGANIZATION ||--o{ SOFTWARE_LICENSE : subscribes
    ORGANIZATION ||--o{ CONSUMABLE : stocks
    ORGANIZATION ||--o{ TICKET : handles
    ORGANIZATION ||--o{ AUDIT_LOG : tracks

    ROLE ||--o{ ROLE_PERMISSION : has
    PERMISSION ||--o{ ROLE_PERMISSION : grants
    ROLE ||--o{ USER : assigns

    USER ||--o| EMPLOYEE : profiles
    USER ||--o{ LOGIN_HISTORY : logs
    USER ||--o{ TICKET : assigned_to
    USER ||--o{ NOTIFICATION : receives

    CATEGORY ||--o{ ASSET : classifies
    DEPARTMENT ||--o{ ASSET : allocates_to
    LOCATION ||--o{ ASSET : houses
    VENDOR ||--o{ ASSET : supplies

    EMPLOYEE ||--o{ ASSET : holds_custody
    EMPLOYEE ||--o{ ASSET_ASSIGNMENT : receives
    ASSET ||--o{ ASSET_ASSIGNMENT : issued_in
    ASSET_ASSIGNMENT ||--o{ ASSET_RETURN : returned_via

    ASSET ||--o{ ASSET_TRANSFER : moves
    ASSET ||--o{ ASSET_LIFECYCLE_LOG : chronicles
    ASSET ||--o{ MAINTENANCE_RECORD : undergoes
    ASSET ||--o{ TICKET : reported_in

    SOFTWARE_LICENSE ||--o{ LICENSE_ASSIGNMENT : provisions
    EMPLOYEE ||--o{ LICENSE_ASSIGNMENT : allocated
    ASSET ||--o{ LICENSE_ASSIGNMENT : activated_on

    CONSUMABLE ||--o{ CONSUMABLE_TRANSACTION : audits
    EMPLOYEE ||--o{ CONSUMABLE_TRANSACTION : issued_to
```

## Key Entities & Constraints
1. **Organization**: Multi-tenancy root entity with isolated branding, currency, and settings.
2. **Asset**: Core entity with unique constraints on `assetId`, `assetTag`, `barcode`, and `serialNumber`.
3. **AssetAssignment**: Immutable historical log of all handovers with accessories and digital signatures.
4. **AssetLifecycleLog**: Append-only event history (`PURCHASE`, `RECEIVING`, `ALLOCATION`, `MAINTENANCE`, `RETURN`, `DISPOSAL`).
5. **SoftwareLicense**: SAM tracker maintaining `quantityPurchased` vs. `quantityUsed` quotas.
6. **Consumable**: Inventory items with minimum alert thresholds and inward/outward movement ledgers.
7. **AuditLog**: Security log capturing operator username, IP address, timestamp, old values, and new values.
