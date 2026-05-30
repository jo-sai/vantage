from app.database import SessionLocal
from app.models import PayrollAdjustment, PayrollExpenseLog, FinancialTransaction
from sqlmodel import Session, select

def verify():
    session = Session(SessionLocal)
    adjustments = session.exec(select(PayrollAdjustment)).all()
    expense_logs = session.exec(select(PayrollExpenseLog)).all()
    transactions = session.exec(select(FinancialTransaction)).all()
    print(f"Total adjustments seeded: {len(adjustments)}")
    print(f"Total expense logs seeded: {len(expense_logs)}")
    print(f"Total transactions seeded: {len(transactions)}")
    session.close()

if __name__ == "__main__":
    verify()
