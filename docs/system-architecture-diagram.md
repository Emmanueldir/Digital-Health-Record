# System Architecture Diagram

```mermaid
flowchart TB
    users["System Users<br/>Admin, Doctor, Nurse, Lab Technician, Patient"]

    subgraph frontend["Frontend Layer"]
        ui["HTML, Bootstrap 5, CSS, JavaScript"]
        fetch["Fetch API Requests"]
    end

    subgraph api["API Layer: Node.js and Express.js"]
        app["Express Application<br/>/api routes and /app static frontend"]
        routes["Route Modules<br/>auth, patients, records, care-team, vitals, labs,<br/>audit, break-glass, uploads, roles, permissions, users"]
        controllers["Controller Modules<br/>Request handling and response formatting"]
        validators["express-validator Middleware<br/>Input validation"]
    end

    subgraph security["Security and Access Control Layer"]
        jwt["JWT Authentication Middleware"]
        otp["OTP Verification"]
        rbac["RBAC Middleware"]
        permission["Permission Middleware"]
        careteam["Care-Team Access Middleware"]
        auditmw["Audit Middleware"]
    end

    subgraph business["Business Logic and Service Layer"]
        accessService["accessService<br/>Patient and care-team access checks"]
        permissionService["permissionService<br/>Permission lookup and enforcement"]
        otpService["otpService<br/>OTP generation, expiry, verification"]
        uploadService["uploadService<br/>File validation and storage workflow"]
        breakGlassService["breakGlassService<br/>Emergency access workflow"]
        qrService["qrService<br/>Patient QR identifier generation"]
        notificationService["notificationService / emailService<br/>Email notification delivery"]
    end

    subgraph data["Database and Storage Layer"]
        mysql[("MySQL Database")]
        core["Core Security Tables<br/>users, roles, permissions,<br/>user_roles, role_permissions"]
        clinical["Clinical Tables<br/>patients, medical_records,<br/>vitals, lab_results, attachments"]
        access["Access Tables<br/>patient_care_team"]
        securityTables["Security and Audit Tables<br/>otp_verifications, audit_logs,<br/>break_glass_requests"]
        files[("uploads/ File Storage<br/>PDF, JPG, JPEG, PNG")]
    end

    subgraph external["External Supporting Services"]
        email["Email Service via nodemailer"]
        qrcode["QR Code Library"]
    end

    users --> ui
    ui --> fetch
    fetch --> app
    app --> routes
    routes --> jwt
    routes --> validators
    jwt --> otp
    jwt --> rbac
    rbac --> permission
    permission --> careteam
    careteam --> controllers
    validators --> controllers
    controllers --> business
    business --> mysql
    uploadService --> files
    otpService --> notificationService
    notificationService --> email
    qrService --> qrcode
    auditmw --> mysql
    controllers --> auditmw

    mysql --> core
    mysql --> clinical
    mysql --> access
    mysql --> securityTables

    breakGlassService --> securityTables
    accessService --> access
    permissionService --> core
```

**Figure 4.1: System Architecture of the Digital Health Record System Using Role-Based Access Control.**

The architecture shows the implemented multi-layer structure of the system. Users interact with Bootstrap-based frontend pages, which communicate with the Express API through Fetch API requests. Requests are routed through validation, authentication, role-based authorization, permission checks, care-team access enforcement, and audit logging before reaching the controller and service layers. The business services implement core workflows such as OTP verification, access checking, uploads, QR generation, notification delivery, and emergency break-glass access. Persistent records are stored in the MySQL database, while uploaded clinical files are stored in the local uploads directory.
