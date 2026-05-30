from app.database import SessionLocal
from app.models import (
    User, 
    Workspace,
    WorkspaceMember, 
    Comment, 
    Asset, 
    Message, 
    ProgressReport, 
    OrganizationInvite,
    Project,
    PayrollAdjustment,
    PayrollExpenseLog,
    FinancialTransaction
)
from sqlmodel import Session, select

def main():
    session = Session(SessionLocal)
    
    # 1. Print all users
    users = session.exec(select(User)).all()
    print("ALL USERS CURRENTLY IN DB:")
    for u in users:
        print(f"- ID: {u.id}, Email: {u.email}, Name: {u.firstName} {u.lastName}, Role: {u.role}")
    
    # 2. Identify users to delete
    seeded_emails = {
        "owner@vantage.io",
        "admin@vantage.io",
        "finance@vantage.io",
        "employee@vantage.io",
        "sarah.chen@vantage.io",
        "marcus.t@vantage.io",
        "elena.r@vantage.io",
        "david.k@vantage.io",
        "james.w@vantage.io",
        "priya.p@vantage.io"
    }
    
    to_delete = []
    for u in users:
        if u.email.lower().strip() not in seeded_emails:
            to_delete.append(u)
            
    if not to_delete:
        print("\nNo custom created accounts found to delete.")
    else:
        print(f"\nFound {len(to_delete)} custom account(s) to delete:")
        for u in to_delete:
            print(f"  * {u.email} ({u.firstName} {u.lastName})")
            
        # 3. Clean up database relations and delete accounts
        for u in to_delete:
            print(f"\nProcessing deletion for: {u.email}")
            
            # Workspace memberships
            memberships = session.exec(select(WorkspaceMember).where(WorkspaceMember.userId == u.id)).all()
            for m in memberships:
                print(f"  - Deleting WorkspaceMember: workspaceId={m.workspaceId}")
                session.delete(m)
                
            # Comments
            comments = session.exec(select(Comment).where(Comment.userId == u.id)).all()
            for c in comments:
                print(f"  - Deleting Comment: id={c.id}")
                session.delete(c)
                
            # Assets
            assets = session.exec(select(Asset).where(Asset.createdById == u.id)).all()
            for a in assets:
                print(f"  - Deleting Asset: name={a.name}")
                session.delete(a)
                
            # Messages
            messages = session.exec(select(Message).where(Message.userId == u.id)).all()
            for msg in messages:
                print(f"  - Deleting Message: id={msg.id}")
                session.delete(msg)
                
            # ProgressReports
            reports = session.exec(select(ProgressReport).where(ProgressReport.authorId == u.id)).all()
            for r in reports:
                print(f"  - Deleting ProgressReport: id={r.id}")
                session.delete(r)
                
            # OrganizationInvites
            invites = session.exec(select(OrganizationInvite).where(OrganizationInvite.createdBy == u.id)).all()
            for inv in invites:
                print(f"  - Deleting OrganizationInvite: code={inv.code}")
                session.delete(inv)
                
            # The User itself
            session.delete(u)
            print(f"  - Deleted User record successfully.")

    # 4. Clean up custom workspaces and related custom entities
    workspaces = session.exec(select(Workspace)).all()
    for w in workspaces:
        if w.id != "operations":
            print(f"\nProcessing deletion for custom workspace: {w.name} ({w.id})")
            
            # Projects in workspace
            projects = session.exec(select(Project).where(Project.workspaceId == w.id)).all()
            for p in projects:
                print(f"  - Deleting Project: {p.name}")
                session.delete(p)
                
            # Payroll adjustments in workspace
            adjs = session.exec(select(PayrollAdjustment).where(PayrollAdjustment.workspaceId == w.id)).all()
            for adj in adjs:
                print(f"  - Deleting PayrollAdjustment: employeeName={adj.employeeName}")
                session.delete(adj)
                
            # Payroll expense logs
            logs = session.exec(select(PayrollExpenseLog).where(PayrollExpenseLog.workspaceId == w.id)).all()
            for log in logs:
                print(f"  - Deleting PayrollExpenseLog: period={log.period}")
                session.delete(log)
                
            # Financial transactions
            txs = session.exec(select(FinancialTransaction).where(FinancialTransaction.workspaceId == w.id)).all()
            for tx in txs:
                print(f"  - Deleting FinancialTransaction: description={tx.description}")
                session.delete(tx)
                
            # Workspace memberships linked to workspace
            m_links = session.exec(select(WorkspaceMember).where(WorkspaceMember.workspaceId == w.id)).all()
            for link in m_links:
                session.delete(link)
                
            # The Workspace itself
            session.delete(w)
            print(f"  - Deleted Workspace record successfully.")

    # 5. Commit changes
    session.commit()
    print("\nCommit successful. Custom accounts and workspaces deleted.")
    
    # 6. Print remaining users
    remaining_users = session.exec(select(User)).all()
    print("\nREMAINING USERS IN DB:")
    for u in remaining_users:
        print(f"- ID: {u.id}, Email: {u.email}, Name: {u.firstName} {u.lastName}, Role: {u.role}")
        
    session.close()

if __name__ == "__main__":
    main()
