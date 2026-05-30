from sqlmodel import SQLModel, create_engine, Session, select

from sqlalchemy.orm import sessionmaker
from app.config import settings
from typing import Generator

# Global placeholders for the database engine and session maker
engine = None
SessionLocal = None

def init_db():
    global engine, SessionLocal
    db_url = settings.DATABASE_URL
    
    # Try custom external database (PostgreSQL / MySQL / MariaDB) if configured
    if db_url and (db_url.startswith("postgresql") or db_url.startswith("mysql") or db_url.startswith("mariadb")):
        try:
            # Pre-check driver imports based on scheme
            if db_url.startswith("postgresql"):
                import psycopg2
            elif "pymysql" in db_url:
                import pymysql
                
            print(f"[DB] Attempting to connect to external database...")
            # SkySQL and cloud MariaDB hosts require SSL — auto-detect and enable
            connect_args = {}
            if "skysql.com" in db_url or "skysql.io" in db_url:
                connect_args = {"ssl": {"ssl_disabled": False}}
                print("[DB] SkySQL cloud host detected — enabling SSL.")
            engine = create_engine(db_url, pool_pre_ping=True, connect_args=connect_args)
            # Test connectivity
            with engine.connect() as conn:
                pass
            SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, class_=Session)
            
            # Auto-create tables for the external database if they do not exist
            from app.models import (
                User, Workspace, WorkspaceMember, Project, Board,
                BoardVersion, Asset, Comment, Subscription, Message, ProgressReport,
                GanttProgressOverride, GanttTimelineShift, PayrollAdjustment, PayrollExpenseLog, FinancialTransaction,
                OrganizationInvite
            )
            SQLModel.metadata.create_all(engine)
            print("[DB] Database connection established and tables verified/created successfully.")
            return
        except (ImportError, Exception) as e:
            print("[DB] External database driver or connection failed:")
            print(f"   Error: {e}")
            print("[DB] Falling back to zero-config offline persistent developer sandbox...")
            
    # Fallback to local SQLite database in the workspace for resilient sandboxing
    import os
    db_file_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "vantage_offline.db")
    sqlite_url = f"sqlite:///{db_file_path}"
    # SQLite requires check_same_thread=False for FastAPI multithreaded requests
    engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, class_=Session)
    
    # Auto-create tables for SQLite sandbox to ensure instant usability
    try:
        # Import all models to register their metadata schemas
        from app.models import (
            User, Workspace, WorkspaceMember, Project, Board,
            BoardVersion, Asset, Comment, Subscription, Message, ProgressReport,
            GanttProgressOverride, GanttTimelineShift, PayrollAdjustment, PayrollExpenseLog, FinancialTransaction,
            OrganizationInvite
        )
        SQLModel.metadata.create_all(engine)
        print("[DB] Zero-config SQLite database initialized and tables generated.")
        
        # Resilient SQLite migration check for new columns
        try:
            from sqlalchemy import text
            with engine.connect() as conn:
                # Check User table columns
                cursor = conn.execute(text("PRAGMA table_info(User)"))
                user_cols = [row[1] for row in cursor.fetchall()]
                if "accountHolderName" not in user_cols:
                    conn.execute(text("ALTER TABLE User ADD COLUMN accountHolderName TEXT"))
                    print("[MIGRATION] Added accountHolderName column to User table.")
                if "bankName" not in user_cols:
                    conn.execute(text("ALTER TABLE User ADD COLUMN bankName TEXT"))
                    print("[MIGRATION] Added bankName column to User table.")
                if "accountNumber" not in user_cols:
                    conn.execute(text("ALTER TABLE User ADD COLUMN accountNumber TEXT"))
                    print("[MIGRATION] Added accountNumber column to User table.")

                # Check PayrollAdjustment table columns
                cursor = conn.execute(text("PRAGMA table_info(PayrollAdjustment)"))
                adj_cols = [row[1] for row in cursor.fetchall()]
                if "workHours" not in adj_cols:
                    conn.execute(text("ALTER TABLE PayrollAdjustment ADD COLUMN workHours REAL DEFAULT 160.0"))
                    print("[MIGRATION] Added workHours column to PayrollAdjustment table.")

                # Check Workspace table columns
                cursor = conn.execute(text("PRAGMA table_info(Workspace)"))
                ws_cols = [row[1] for row in cursor.fetchall()]
                if "ganttCustomData" not in ws_cols:
                    conn.execute(text("ALTER TABLE Workspace ADD COLUMN ganttCustomData TEXT"))
                    print("[MIGRATION] Added ganttCustomData column to Workspace table.")
        except Exception as mig_err:
            print(f"[MIGRATION] Resilient SQLite column check skipped or failed: {mig_err}")
    except Exception as create_err:
        print(f"[DB] Failed to create SQLite tables: {create_err}")

    # Resilient Automatic Demo Seeder for Sandbox Accounts
    try:
        from sqlmodel import select
        from app.auth.service import AuthService
        from app.models import Role
        session = SessionLocal()
        
        # Check if default workspace exists
        ws = session.exec(select(Workspace).where(Workspace.id == "operations")).first()
        if not ws:
            ws = Workspace(id="operations", name="Operations Workspace", slug="operations")
            session.add(ws)
            session.flush()

        # Seed default users
        demo_users = [
            {"email": "owner@vantage.io", "firstName": "Vantage", "lastName": "Owner", "role": Role.OWNER},
            {"email": "admin@vantage.io", "firstName": "Vantage", "lastName": "Admin", "role": Role.ADMIN},
            {"email": "finance@vantage.io", "firstName": "Vantage", "lastName": "Finance", "role": Role.FINANCE_ADMIN},
            {"email": "employee@vantage.io", "firstName": "Vantage", "lastName": "Employee", "role": Role.EMPLOYEE},
        ]

        for du in demo_users:
            u = session.exec(select(User).where(User.email == du["email"])).first()
            if not u:
                u = User(
                    email=du["email"],
                    passwordHash=AuthService.hash_password("vantage123"),
                    firstName=du["firstName"],
                    lastName=du["lastName"],
                    role=du["role"]
                )
                session.add(u)
                session.flush()

            # Add membership
            m = session.exec(
                select(WorkspaceMember).where(
                    WorkspaceMember.workspaceId == ws.id,
                    WorkspaceMember.userId == u.id
                )
            ).first()
            if not m:
                m = WorkspaceMember(
                    workspaceId=ws.id,
                    userId=u.id,
                    role=du["role"]
                )
                session.add(m)
        session.commit()
        print("[DB] Demo sandbox users and workspace seeded successfully.")

        # Seed default employee profiles, workspace memberships, and adjustments
        period = "May 2026"
        adj_exists = session.exec(select(PayrollAdjustment).where(PayrollAdjustment.workspaceId == ws.id)).first()
        if not adj_exists:
            defaults = [
                {"email": "sarah.chen@vantage.io", "firstName": "Sarah", "lastName": "Chen", "team": "Team Alpha", "rate": 50.0, "isSalaried": True, "holder": "Sarah Chen", "bank": "BDO Unibank", "accNum": "1092837465"},
                {"email": "marcus.t@vantage.io", "firstName": "Marcus", "lastName": "Thompson", "team": "Team Alpha", "rate": 45.0, "isSalaried": False, "holder": "Marcus Thompson", "bank": "GCash", "accNum": "09171234567"},
                {"email": "elena.r@vantage.io", "firstName": "Elena", "lastName": "Rodriguez", "team": "Team Beta", "rate": 40.0, "isSalaried": True, "holder": "Elena Rodriguez", "bank": "Bank of the Philippine Islands (BPI)", "accNum": "3049582736"},
                {"email": "david.k@vantage.io", "firstName": "David", "lastName": "Kim", "team": "Team Alpha", "rate": 55.0, "isSalaried": True, "holder": "David Kim", "bank": "UnionBank of the Philippines", "accNum": "9081726354"},
                {"email": "james.w@vantage.io", "firstName": "James", "lastName": "Wilson", "team": "Team Alpha", "rate": 38.0, "isSalaried": False, "holder": "James Wilson", "bank": "Metrobank", "accNum": "2059384756"},
                {"email": "priya.p@vantage.io", "firstName": "Priya", "lastName": "Patel", "team": "Team Gamma", "rate": 35.0, "isSalaried": False, "holder": "Priya Patel", "bank": "PayMaya / Maya", "accNum": "09189876543"},
            ]
            for item in defaults:
                emp = session.exec(select(User).where(User.email == item["email"])).first()
                if not emp:
                    emp = User(
                        email=item["email"],
                        passwordHash=AuthService.hash_password("vantage123"),
                        firstName=item["firstName"],
                        lastName=item["lastName"],
                        role=Role.EMPLOYEE,
                        accountHolderName=item["holder"],
                        bankName=item["bank"],
                        accountNumber=item["accNum"]
                    )
                    session.add(emp)
                    session.flush()
                else:
                    if not emp.accountNumber:
                        emp.accountHolderName = item["holder"]
                        emp.bankName = item["bank"]
                        emp.accountNumber = item["accNum"]
                        session.add(emp)
                        session.flush()
                
                m = session.exec(
                    select(WorkspaceMember).where(
                        WorkspaceMember.workspaceId == ws.id,
                        WorkspaceMember.userId == emp.id
                    )
                ).first()
                if not m:
                    session.add(WorkspaceMember(workspaceId=ws.id, userId=emp.id, role=Role.EMPLOYEE))
                    session.flush()

                adj = PayrollAdjustment(
                    workspaceId=ws.id,
                    employeeId=emp.id,
                    employeeName=f"{emp.firstName} {emp.lastName}",
                    team=item["team"],
                    overtimeHours=0.0,
                    tardinessMinutes=0.0,
                    bonus=0.0,
                    baseRate=item["rate"],
                    isSalaried=item["isSalaried"],
                    period=period,
                    isLocked=False,
                    updatedBy="System Auto-Seed"
                )
                session.add(adj)
            session.commit()
            print("[DB] Default employee adjustments and profiles seeded successfully.")

        # Seed default Payroll Expense Logs
        exp_exists = session.exec(select(PayrollExpenseLog).where(PayrollExpenseLog.workspaceId == ws.id)).first()
        if not exp_exists:
            exp_defaults = [
                {
                    "period": "April 2026",
                    "totalGrossPay": 245000.00,
                    "totalNetPay": 196000.00,
                    "employerTaxContribution": 12250.00,
                    "processingFees": 9.00,
                    "bankLedgerDeducted": 208259.00,
                    "status": "paid"
                },
                {
                    "period": "March 2026",
                    "totalGrossPay": 238000.00,
                    "totalNetPay": 190400.00,
                    "employerTaxContribution": 11900.00,
                    "processingFees": 9.00,
                    "bankLedgerDeducted": 202309.00,
                    "status": "paid"
                }
            ]
            for item in exp_defaults:
                log = PayrollExpenseLog(
                    workspaceId=ws.id,
                    period=item["period"],
                    totalGrossPay=item["totalGrossPay"],
                    totalNetPay=item["totalNetPay"],
                    employerTaxContribution=item["employerTaxContribution"],
                    processingFees=item["processingFees"],
                    bankLedgerDeducted=item["bankLedgerDeducted"],
                    status=item["status"]
                )
                session.add(log)
            session.commit()
            print("[DB] Default payroll expense logs seeded successfully.")

        # Seed default Financial Transactions (General Ledgers)
        tx_exists = session.exec(select(FinancialTransaction).where(FinancialTransaction.workspaceId == ws.id)).first()
        if not tx_exists:
            tx_defaults = [
                {"date": "2026-05-03", "desc": "BuildRight Supplies Co.", "cat": "Materials", "amount": 45000.0, "status": "Paid"},
                {"date": "2026-05-05", "desc": "TechEquip Rentals", "cat": "Equipment", "amount": 12500.0, "status": "Paid"},
                {"date": "2026-05-18", "desc": "Safety First Inc.", "cat": "Safety Equipment", "amount": 3200.0, "status": "Pending"},
                {"date": "2026-05-20", "desc": "PowerGrid Electric", "cat": "Utilities", "amount": 1850.0, "status": "Pending"},
                {"date": "2026-05-22", "desc": "TransLogistics LLC", "cat": "Transportation", "amount": 8900.0, "status": "Pending"},
            ]
            for item in tx_defaults:
                tx = FinancialTransaction(
                    workspaceId=ws.id,
                    date=item["date"],
                    description=item["desc"],
                    category=item["cat"],
                    amount=item["amount"],
                    status=item["status"]
                )
                session.add(tx)
            session.commit()
            print("[DB] Default financial transactions seeded successfully.")

        # Promote arkin flores to OWNER
        users = session.exec(select(User)).all()
        for u in users:
            if "arkin" in u.email.lower() or "arkin" in u.firstName.lower() or "flores" in u.lastName.lower():
                u.role = Role.OWNER
                session.add(u)
                
                memberships = session.exec(select(WorkspaceMember).where(WorkspaceMember.userId == u.id)).all()
                for m in memberships:
                    m.role = Role.OWNER
                    session.add(m)
                print(f"[MIGRATION] Promoted user {u.email} to OWNER of all workspaces.")
        session.commit()

    except Exception as seed_err:
        session.rollback()
        print(f"[DB] Resilient seed skipped: {seed_err}")
    finally:
        session.close()

# Execute database initialization
init_db()

def get_db() -> Generator[Session, None, None]:
    """
    FastAPI session dependency injector. Ensures session is strictly closed after the request completes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
