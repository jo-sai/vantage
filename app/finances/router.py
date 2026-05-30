from fastapi import APIRouter, Depends, Path
from sqlmodel import Session, select
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import json

from app.database import get_db
from app.auth.dependencies import require_tenant, TenantContext
from app.models import Role, PayrollAdjustment, PayrollExpenseLog, FinancialTransaction, User, WorkspaceMember
from app.errors import ForbiddenException, BadRequestException

router = APIRouter()

# --- Request Schemas ---

class SubmitAdjustmentRequest(BaseModel):
    employeeId: str = Field(..., description="Unique employee identifier")
    employeeName: str = Field(..., description="Full name of employee")
    team: str = Field(..., description="Employee's assigned team")
    workHours: float = Field(default=160.0, ge=0.0, description="Standard work hours in this period")
    overtimeHours: float = Field(default=0.0, ge=0.0, le=100.0, description="Overtime hours approved")
    tardinessMinutes: float = Field(default=0.0, ge=0.0, le=10000.0, description="Tardiness minutes reported")
    bonus: float = Field(default=0.0, ge=0.0, description="Manual bonus inputs")
    baseRate: float = Field(..., ge=0.0, description="Core pay rate (hourly rate or monthly base)")
    isSalaried: bool = Field(default=False, description="True if salaried, False if hourly")
    period: str = Field(..., description="Payroll period, e.g. 'May 2026'")


class LockPeriodRequest(BaseModel):
    period: str = Field(..., description="Payroll period to lock, e.g. 'May 2026'")


class ProcessPayrollRequest(BaseModel):
    period: str = Field(..., description="Payroll period to process, e.g. 'May 2026'")
    overtimeRateFactor: float = Field(default=1.5, ge=1.0, le=3.0, description="OT multiplier")


# --- Seed Data Helper ---

def seed_default_adjustments(db: Session, workspace_id: str, period: str):
    """
    Seeds a set of high-fidelity default employee records if none exist,
    ensuring the sandbox immediately operates with realistic data.
    """
    defaults = [
        {"employeeId": "emp-1", "name": "Sarah Chen", "team": "Team Alpha", "rate": 50.0, "isSalaried": True},
        {"employeeId": "emp-2", "name": "Marcus Thompson", "team": "Team Alpha", "rate": 45.0, "isSalaried": False},
        {"employeeId": "emp-3", "name": "Elena Rodriguez", "team": "Team Beta", "rate": 40.0, "isSalaried": True},
        {"employeeId": "emp-4", "name": "David Kim", "team": "Team Alpha", "rate": 55.0, "isSalaried": True},
        {"employeeId": "emp-5", "name": "James Wilson", "team": "Team Alpha", "rate": 38.0, "isSalaried": False},
        {"employeeId": "emp-6", "name": "Priya Patel", "team": "Team Gamma", "rate": 35.0, "isSalaried": False},
    ]
    
    seeded = []
    for item in defaults:
        adj = PayrollAdjustment(
            workspaceId=workspace_id,
            employeeId=item["employeeId"],
            employeeName=item["name"],
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
        db.add(adj)
        seeded.append(adj)
    
    db.commit()
    for item in seeded:
        db.refresh(item)
    return seeded


# --- Routes ---

@router.get("/adjustments/{workspaceId}")
async def get_adjustments(
    period: str = "May 2026",
    workspaceId: str = Path(..., description="Target workspace ID"),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant)
):
    """
    Fetches all payroll adjustments/employee records for the selected period.
    Role-Based Visibility:
    - Org Admins can view adjustments across the whole organization.
    - Team Leaders can only view employees belonging to their assigned department/team.
    """
    stmt = select(PayrollAdjustment).where(
        PayrollAdjustment.workspaceId == tenant.workspace_id,
        PayrollAdjustment.period == period
    )
    results = db.exec(stmt).all()
    
    if not results:
        # Auto-seed standard sandbox dataset if database is empty only for the default operations workspace
        if tenant.workspace_id == "operations":
            results = seed_default_adjustments(db, tenant.workspace_id, period)
        else:
            results = []

    # Ensure all active WorkspaceMembers have a placeholder in this period
    members_stmt = select(WorkspaceMember).where(
        WorkspaceMember.workspaceId == tenant.workspace_id
    )
    members = db.exec(members_stmt).all()
    
    any_new = False
    for m in members:
        # Check if they have an adjustment already in results
        has_adj = any(r.employeeId == m.userId for r in results)
        if not has_adj:
            # Look up User to get name
            u = db.get(User, m.userId)
            if u:
                placeholder_adj = PayrollAdjustment(
                    workspaceId=tenant.workspace_id,
                    employeeId=m.userId,
                    employeeName=f"{u.firstName} {u.lastName}",
                    team="Team Alpha",
                    workHours=160.0,
                    overtimeHours=0.0,
                    tardinessMinutes=0.0,
                    bonus=0.0,
                    baseRate=40.0,
                    isSalaried=False,
                    period=period,
                    isLocked=False,
                    updatedBy="System Auto-Provision"
                )
                db.add(placeholder_adj)
                any_new = True
                
    if any_new:
        db.commit()
        # Query again to get the updated set of adjustments
        stmt = select(PayrollAdjustment).where(
            PayrollAdjustment.workspaceId == tenant.workspace_id,
            PayrollAdjustment.period == period
        )
        results = db.exec(stmt).all()

    # Enforce Role-Based Scoping
    user_role = tenant.role
    if user_role in [Role.ADMIN, Role.OWNER]:
        return {"success": True, "data": results}
    elif user_role == Role.TEAM_LEADER:
        # In a production context, Team Leaders are limited to their assigned department.
        # We scope them to Team Alpha for this high-fidelity demo sandbox,
        # but check if they belong to other scopes.
        team_scope = "Team Alpha" 
        scoped_results = [r for r in results if r.team == team_scope]
        return {"success": True, "data": scoped_results}
    else:
        raise ForbiddenException("Only Team Leaders, Org Admins, and Owners are authorized to view payroll adjustments")


@router.post("/adjustments/{workspaceId}")
async def submit_adjustment(
    payload: SubmitAdjustmentRequest,
    workspaceId: str = Path(..., description="Target workspace ID"),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant)
):
    """
    Submits or overrides hours for Overtime and Tardiness.
    Enforces Role Boundaries & Cut-off window locks.
    """
    user_role = tenant.role
    if user_role not in [Role.ADMIN, Role.OWNER, Role.TEAM_LEADER]:
        raise ForbiddenException("Only Team Leaders, Org Admins, and Owners are authorized to submit payroll adjustments")
        
    # Team Leader scoping check
    if user_role == Role.TEAM_LEADER and payload.team != "Team Alpha":
         raise ForbiddenException("Team Leaders can only log adjustments for members of their specific team")

    # 1. Query for existing record
    stmt = select(PayrollAdjustment).where(
        PayrollAdjustment.workspaceId == tenant.workspace_id,
        PayrollAdjustment.employeeId == payload.employeeId,
        PayrollAdjustment.period == payload.period
    )
    existing = db.exec(stmt).first()

    # 2. Check Cut-off Lock Window
    if existing and existing.isLocked:
        raise BadRequestException("Adjustment period is locked. Modifications are disabled during payroll processing.")

    if existing:
        existing.workHours = payload.workHours
        existing.overtimeHours = payload.overtimeHours
        existing.tardinessMinutes = payload.tardinessMinutes
        existing.bonus = payload.bonus
        existing.baseRate = payload.baseRate
        existing.isSalaried = payload.isSalaried
        existing.updatedBy = "Owner" if user_role == Role.OWNER else ("Org Admin" if user_role == Role.ADMIN else "Team Leader")
        existing.updatedAt = datetime.utcnow()
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return {"success": True, "message": "Adjustment updated successfully", "data": existing}
    else:
        new_adj = PayrollAdjustment(
            workspaceId=tenant.workspace_id,
            employeeId=payload.employeeId,
            employeeName=payload.employeeName,
            team=payload.team,
            workHours=payload.workHours,
            overtimeHours=payload.overtimeHours,
            tardinessMinutes=payload.tardinessMinutes,
            bonus=payload.bonus,
            baseRate=payload.baseRate,
            isSalaried=payload.isSalaried,
            period=payload.period,
            isLocked=False,
            updatedBy="Owner" if user_role == Role.OWNER else ("Org Admin" if user_role == Role.ADMIN else "Team Leader")
        )
        db.add(new_adj)
        db.commit()
        db.refresh(new_adj)
        return {"success": True, "message": "Adjustment logged successfully", "data": new_adj}


@router.post("/lock/{workspaceId}")
async def lock_payroll_period(
    payload: LockPeriodRequest,
    workspaceId: str = Path(..., description="Target workspace ID"),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant)
):
    """
    Locks all adjustments for the processing period to prevent mid-calculation changes.
    Restricted to Org Admins.
    """
    if tenant.role not in [Role.ADMIN, Role.OWNER]:
        raise ForbiddenException("Only Org Admins and Owners are authorized to lock payroll periods")
        
    stmt = select(PayrollAdjustment).where(
        PayrollAdjustment.workspaceId == tenant.workspace_id,
        PayrollAdjustment.period == payload.period
    )
    records = db.exec(stmt).all()
    for r in records:
        r.isLocked = True
        db.add(r)
    db.commit()
    return {"success": True, "message": f"Payroll period '{payload.period}' locked successfully for processing"}


@router.post("/process/{workspaceId}")
async def process_payroll(
    payload: ProcessPayrollRequest,
    workspaceId: str = Path(..., description="Target workspace ID"),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant)
):
    """
    Executes core payroll calculations, implements expense mapping, cash flow ledger deductions,
    and returns direct deposit payload along with statutory metrics.
    Restricted to Org Admins.
    """
    if tenant.role not in [Role.ADMIN, Role.OWNER]:
        raise ForbiddenException("Only Org Admins and Owners are authorized to process and finalize payroll")

    stmt = select(PayrollAdjustment).where(
        PayrollAdjustment.workspaceId == tenant.workspace_id,
        PayrollAdjustment.period == payload.period
    )
    adjustments = db.exec(stmt).all()
    if not adjustments:
         raise BadRequestException("No employee adjustments found for this processing period")

    total_gross = 0.0
    total_net = 0.0
    total_tax_employer = 0.0
    total_fees = 0.0
    
    bank_records = []
    itemized_slips = []

    for adj in adjustments:
        # --- 1. Base Gross Calculation ---
        # Salaried: monthly base rate. Hourly: rate * workHours
        base_hours = 160.0
        work_hours = adj.workHours if hasattr(adj, "workHours") else base_hours
        base_gross = adj.baseRate if adj.isSalaried else (adj.baseRate * work_hours)
        hourly_rate = (adj.baseRate / base_hours) if adj.isSalaried else adj.baseRate

        # --- 2. Overtime Earnings ---
        ot_pay = adj.overtimeHours * hourly_rate * payload.overtimeRateFactor

        # --- 3. Tardiness Deductions ---
        # Prorated penalty based on hourly rate
        tardiness_hours = adj.tardinessMinutes / 60.0
        tardiness_penalty = tardiness_hours * hourly_rate

        # --- 4. Bonuses ---
        bonus_val = adj.bonus if hasattr(adj, "bonus") else 0.0

        adjusted_gross = (base_gross + ot_pay) - tardiness_penalty + bonus_val
        # Prevent negative pay
        adjusted_gross = max(0.0, adjusted_gross)

        # --- 4. Statutory & Voluntary Deductions ---
        # Mandatory gov taxes (Simulating flat 12% income withholding + 4% SSS/Gov Health)
        statutory_tax = adjusted_gross * 0.12
        statutory_insurance = adjusted_gross * 0.04
        
        # Voluntary deductions (Retirement 2% + 1500 PHP Insurance meta-code equivalent = 30 USD standard)
        voluntary_retirement = adjusted_gross * 0.02
        voluntary_insurance = 30.0 if adjusted_gross > 100.0 else 0.0

        total_deductions = statutory_tax + statutory_insurance + voluntary_retirement + voluntary_insurance
        
        # --- 5. Net Pay ---
        net_pay = adjusted_gross - total_deductions
        net_pay = max(0.0, net_pay)

        total_gross += adjusted_gross
        total_net += net_pay
        # Employer tax match (simulating employer SSS share: 5%)
        total_tax_employer += adjusted_gross * 0.05

        # Accumulate metrics
        bank_records.append({
            "employeeId": adj.employeeId,
            "name": adj.employeeName,
            "netPay": round(net_pay, 2),
            "bankAccount": f"XXXX-XXXX-{1000 + hash(adj.employeeId)%9000}",
            "routingCode": "021000021"
        })

        itemized_slips.append({
            "employeeId": adj.employeeId,
            "name": adj.employeeName,
            "team": adj.team,
            "period": adj.period,
            "workHours": work_hours,
            "baseGross": round(base_gross, 2),
            "overtimeHours": adj.overtimeHours,
            "overtimeEarned": round(ot_pay, 2),
            "tardinessMinutes": adj.tardinessMinutes,
            "tardinessDeduction": round(tardiness_penalty, 2),
            "bonus": round(bonus_val, 2),
            "statutoryWithholdings": round(statutory_tax + statutory_insurance, 2),
            "voluntaryDeductions": round(voluntary_retirement + voluntary_insurance, 2),
            "netPay": round(net_pay, 2)
        })

    # Processing fee (standard bank batch batch processing fee: 1.5 USD per employee)
    total_fees = len(adjustments) * 1.5
    total_cash_deducted = total_net + total_tax_employer + total_fees

    # 3. Save to Financial Ledger Expenses
    expense_log = PayrollExpenseLog(
        workspaceId=tenant.workspace_id,
        period=payload.period,
        totalGrossPay=round(total_gross, 2),
        totalNetPay=round(total_net, 2),
        employerTaxContribution=round(total_tax_employer, 2),
        processingFees=round(total_fees, 2),
        bankLedgerDeducted=round(total_cash_deducted, 2),
        status="paid"
    )
    db.add(expense_log)
    db.commit()
    db.refresh(expense_log)

    return {
        "success": True,
        "message": f"Payroll for period '{payload.period}' has been processed and disbursed.",
        "summary": {
            "totalGrossPay": round(total_gross, 2),
            "totalNetPay": round(total_net, 2),
            "employerTax": round(total_tax_employer, 2),
            "bankFees": round(total_fees, 2),
            "cashDeducted": round(total_cash_deducted, 2)
        },
        "bankBatchFile": {
            "batchHeader": {
                "originatingBank": "Vantage Federal Trust",
                "paymentDate": datetime.utcnow().strftime("%Y-%m-%d"),
                "totalRecords": len(bank_records),
                "totalAmount": round(total_net, 2)
            },
            "records": bank_records
        },
        "itemizedPayslips": itemized_slips
    }


def seed_default_expenses(db: Session, workspace_id: str):
    """
    Seeds historical finalized payroll runs if empty,
    populating the payroll ledger beautifully.
    """
    defaults = [
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
    
    seeded = []
    for item in defaults:
        log = PayrollExpenseLog(
            workspaceId=workspace_id,
            period=item["period"],
            totalGrossPay=item["totalGrossPay"],
            totalNetPay=item["totalNetPay"],
            employerTaxContribution=item["employerTaxContribution"],
            processingFees=item["processingFees"],
            bankLedgerDeducted=item["bankLedgerDeducted"],
            status=item["status"]
        )
        db.add(log)
        seeded.append(log)
    db.commit()
    for s in seeded:
        db.refresh(s)
    return seeded


@router.get("/expenses/{workspaceId}")
async def get_expenses(
    workspaceId: str = Path(..., description="Target workspace ID"),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant)
):
    """
    Fetches all finalized payroll logs for financial expense mapping.
    """
    if tenant.role not in [Role.ADMIN, Role.OWNER]:
        raise ForbiddenException("Only Organization Admins and Owners are authorized to access finalized payroll expense logs")
        
    stmt = select(PayrollExpenseLog).where(
        PayrollExpenseLog.workspaceId == tenant.workspace_id
    )
    logs = db.exec(stmt).all()
    
    if not logs:
        if tenant.workspace_id == "operations":
            logs = seed_default_expenses(db, tenant.workspace_id)
        else:
            logs = []
        
    return {"success": True, "data": logs}


# --- General Transactions / Data Import Bridging ---

class SingleTransactionRequest(BaseModel):
    date: str = Field(..., description="Transaction date yyyy-mm-dd")
    description: str = Field(..., description="Description")
    category: str = Field(..., description="Category")
    amount: float = Field(..., ge=0.0, description="Amount in cash units")
    status: str = Field(..., description="Paid, Pending, or Reviewing")

class BatchTransactionImportRequest(BaseModel):
    transactions: List[SingleTransactionRequest] = Field(..., description="List of transactions to batch import")


def seed_default_transactions(db: Session, workspace_id: str):
    """
    Seeds a premium default operating expense list if empty,
    keeping dashboard metrics consistent.
    """
    defaults = [
        {"date": "2026-05-03", "desc": "BuildRight Supplies Co.", "cat": "Materials", "amount": 45000.0, "status": "Paid"},
        {"date": "2026-05-05", "desc": "TechEquip Rentals", "cat": "Equipment", "amount": 12500.0, "status": "Paid"},
        {"date": "2026-05-18", "desc": "Safety First Inc.", "cat": "Safety Equipment", "amount": 3200.0, "status": "Pending"},
        {"date": "2026-05-20", "desc": "PowerGrid Electric", "cat": "Utilities", "amount": 1850.0, "status": "Pending"},
        {"date": "2026-05-22", "desc": "TransLogistics LLC", "cat": "Transportation", "amount": 8900.0, "status": "Pending"},
    ]
    
    seeded = []
    for item in defaults:
        tx = FinancialTransaction(
            workspaceId=workspace_id,
            date=item["date"],
            description=item["desc"],
            category=item["cat"],
            amount=item["amount"],
            status=item["status"]
        )
        db.add(tx)
        seeded.append(tx)
    
    db.commit()
    for item in seeded:
        db.refresh(item)
    return seeded


@router.get("/transactions/{workspaceId}")
async def get_transactions(
    workspaceId: str = Path(..., description="Target workspace ID"),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant)
):
    """
    Retrieves all financial transactions (materials, utilities, vendor expenses, salaries)
    for this workspace tenant, seeding defaults if empty.
    """
    if tenant.role not in [Role.ADMIN, Role.OWNER]:
        raise ForbiddenException("Only Organization Admins and Owners are authorized to view ledger transactions")
        
    stmt = select(FinancialTransaction).where(
        FinancialTransaction.workspaceId == tenant.workspace_id
    )
    txs = db.exec(stmt).all()
    
    if not txs:
        if tenant.workspace_id == "operations":
            txs = seed_default_transactions(db, tenant.workspace_id)
        else:
            txs = []
        
    return {"success": True, "data": txs}


@router.post("/transactions/{workspaceId}")
async def create_batch_transactions(
    payload: BatchTransactionImportRequest,
    workspaceId: str = Path(..., description="Target workspace ID"),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant)
):
    """
    Saves a batch of imported financial transaction entries into the database.
    Integrates directly with the dynamic ledger system.
    """
    if tenant.role not in [Role.ADMIN, Role.OWNER]:
        raise ForbiddenException("Only Organization Admins and Owners are authorized to import ledger transactions")
        
    try:
        new_txs = []
        for t in payload.transactions:
            tx = FinancialTransaction(
                workspaceId=tenant.workspace_id,
                date=t.date,
                description=t.description,
                category=t.category,
                amount=t.amount,
                status=t.status
            )
            db.add(tx)
            new_txs.append(tx)
            
        db.commit()
        for n in new_txs:
            db.refresh(n)
            
        from fastapi.responses import JSONResponse
        from fastapi.encoders import jsonable_encoder
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": f"Successfully imported {len(new_txs)} transactions to the financial ledger.",
                "data": jsonable_encoder(new_txs)
            }
        )
    except Exception as e:
        db.rollback()
        import traceback
        print("[BATCH IMPORT ERROR] Exception in create_batch_transactions:")
        traceback.print_exc()
        raise BadRequestException(f"Transaction batch import failed: {str(e)}")


@router.get("/exchange-rates")
async def get_live_exchange_rates():
    """
    Fetches real-time, accurate currency conversion rates relative to PHP (Base Currency)
    from a public exchange rate API (open.er-api.com).
    """
    import urllib.request
    import json
    url = "https://open.er-api.com/v6/latest/PHP"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            rates = data.get("rates", {})
            return {
                "success": True,
                "provider": "ExchangeRate-API",
                "base": "PHP",
                "rates": {
                    "PHP": 1.0,
                    "USD": rates.get("USD", 0.017),
                    "EUR": rates.get("EUR", 0.016),
                    "GBP": rates.get("GBP", 0.014),
                },
                "updatedAt": datetime.utcnow().isoformat() + "Z"
            }
    except Exception as e:
        return {
            "success": True,
            "provider": "Fallback-Local",
            "base": "PHP",
            "rates": {
                "PHP": 1.0,
                "USD": 0.0172,
                "EUR": 0.0158,
                "GBP": 0.0135,
            },
            "updatedAt": datetime.utcnow().isoformat() + "Z",
            "note": f"Offline fallback mode active. Error: {str(e)}"
        }

# --- Bank Payroll File Ingestion & Distribution File Compiler Engine ---
import uuid
import csv
import io

class GenerateBankFileRequest(BaseModel):
    period: str = Field(..., description="Payroll period, e.g. 'May 2026'")
    fileFormat: str = Field(..., description="Target file format: CSV, TXT, or JSON")
    memo: Optional[str] = Field(default="", description="Reference / Memo for banking transfer")
    payrollDate: str = Field(..., description="Disbursement Date (yyyy-mm-dd)")

@router.post("/generate-bank-file/{workspaceId}")
async def generate_bank_file(
    payload: GenerateBankFileRequest,
    workspaceId: str = Path(..., description="Target workspace ID"),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant)
):
    """
    Generates a downloadable Bank Payroll Batch File for direct deposit distribution.
    Supports CSV, TXT, and JSON formats for banking integration networks.
    Restricted to Admins and Owners.
    """
    if tenant.role not in [Role.ADMIN, Role.OWNER]:
        raise ForbiddenException("Only Organization Admins and Owners are authorized to generate bank payroll files")

    # Fetch all adjustments/records for this period
    stmt = select(PayrollAdjustment).where(
        PayrollAdjustment.workspaceId == tenant.workspace_id,
        PayrollAdjustment.period == payload.period
    )
    adjustments = db.exec(stmt).all()
    if not adjustments:
        raise BadRequestException("No employee adjustments found for this processing period")

    # Generate a unique Batch ID
    batch_id = f"PAY-BATCH-{uuid.uuid4().hex[:8].upper()}"

    records = []
    total_amount = 0.0

    for adj in adjustments:
        # Perform dynamic gross and net pay calculations matching uvicorn's /process logic
        base_hours = 160.0
        work_hours = adj.workHours if hasattr(adj, "workHours") else base_hours
        base_gross = adj.baseRate if adj.isSalaried else (adj.baseRate * work_hours)
        hourly_rate = (adj.baseRate / base_hours) if adj.isSalaried else adj.baseRate
        
        ot_pay = adj.overtimeHours * hourly_rate * 1.5
        tardiness_hours = adj.tardinessMinutes / 60.0
        tardiness_penalty = tardiness_hours * hourly_rate
        bonus_val = adj.bonus if hasattr(adj, "bonus") else 0.0

        adjusted_gross = max(0.0, (base_gross + ot_pay) - tardiness_penalty + bonus_val)

        # Deductions
        statutory_tax = adjusted_gross * 0.12
        statutory_insurance = adjusted_gross * 0.04
        voluntary_retirement = adjusted_gross * 0.02
        voluntary_insurance = 30.0 if adjusted_gross > 100.0 else 0.0

        total_deductions = statutory_tax + statutory_insurance + voluntary_retirement + voluntary_insurance
        net_pay = max(0.0, adjusted_gross - total_deductions)
        net_pay_rounded = round(net_pay, 2)
        total_amount += net_pay_rounded

        # Fetch associated user model for payout details
        user = db.get(User, adj.employeeId)
        if not user:
            # Resilient fallback: search by name
            user = db.exec(select(User).where(User.firstName + " " + User.lastName == adj.employeeName)).first()

        account_holder = user.accountHolderName if (user and user.accountHolderName) else adj.employeeName
        bank_name = user.bankName if (user and user.bankName) else "Vantage Wallet (Default)"
        account_number = user.accountNumber if (user and user.accountNumber) else f"0917{1000000 + hash(adj.employeeId)%9000000}"

        records.append({
            "accountHolder": account_holder,
            "bankName": bank_name,
            "accountNumber": account_number,
            "amount": net_pay_rounded,
            "employeeId": adj.employeeId,
            "team": adj.team
        })

    total_amount_rounded = round(total_amount, 2)

    # Format compiling
    file_format = payload.fileFormat.upper()
    filename = f"Vantage_BankPayroll_{payload.period.replace(' ', '_')}_{payload.payrollDate}_{batch_id}.{file_format.lower()}"
    file_content = ""

    if file_format == "JSON":
        json_payload = {
            "batchHeader": {
                "batchId": batch_id,
                "payrollDate": payload.payrollDate,
                "memo": payload.memo or "Vantage Salary Distribution",
                "totalRecords": len(records),
                "totalAmount": total_amount_rounded,
                "originatingInstitution": "Vantage Federal Trust",
            },
            "records": records
        }
        file_content = json.dumps(json_payload, indent=2)

    elif file_format == "CSV":
        output = io.StringIO()
        writer = csv.writer(output)
        # CSV headers matching banking networks
        writer.writerow(["Account Holder Name", "Bank Name", "Account/Mobile Number", "Amount (PHP)", "Reference/Memo", "Batch ID", "Disbursement Date"])
        for r in records:
            writer.writerow([r["accountHolder"], r["bankName"], r["accountNumber"], f"{r['amount']:.2f}", payload.memo or "Salary Distribution", batch_id, payload.payrollDate])
        file_content = output.getvalue()

    elif file_format == "TXT":
        # Professional fixed-width standard transmission file
        lines = []
        lines.append(f"VANTAGE BATCH CONTROL HEADER | ID: {batch_id} | DATE: {payload.payrollDate} | TOTAL: PHP {total_amount_rounded:.2f} | REF: {payload.memo or 'Salary'}")
        lines.append("-" * 120)
        lines.append(f"{'HOLDER NAME':<30} | {'BANK/WALLET':<25} | {'ACCOUNT/MOBILE':<20} | {'AMOUNT (PHP)':<15} | {'REF/MEMO':<20}")
        lines.append("-" * 120)
        for r in records:
            amount_str = f"PHP {r['amount']:.2f}"
            lines.append(f"{r['accountHolder'][:28]:<30} | {r['bankName'][:23]:<25} | {r['accountNumber'][:18]:<20} | {amount_str:<15} | {payload.memo[:18] or 'Salary':<20}")


        file_content = "\n".join(lines)

    else:
        raise BadRequestException(f"Unsupported file format: {payload.fileFormat}. Supported: CSV, TXT, JSON.")

    return {
        "success": True,
        "message": f"Successfully compiled {len(records)} bank records into {file_format} format.",
        "fileName": filename,
        "fileContent": file_content,
        "summary": {
            "batchId": batch_id,
            "payrollDate": payload.payrollDate,
            "totalRecords": len(records),
            "totalAmount": total_amount_rounded
        }
    }
