from app.database import SessionLocal
from app.models import User, WorkspaceMember
from sqlmodel import Session, select

def main():
    session = Session(SessionLocal)
    users = session.exec(select(User)).all()
    print("ALL USERS IN DB:")
    for u in users:
        print(f"- ID: {u.id}, Email: {u.email}, Name: {u.firstName} {u.lastName}, Role: {u.role}")

    # Find lance
    lance_users = [u for u in users if "lance" in u.email.lower() or "lance" in u.firstName.lower() or "lance" in u.lastName.lower()]
    if not lance_users:
        print("No users found containing 'lance'.")
    else:
        for u in lance_users:
            print(f"Deleting user: {u.email} ({u.firstName} {u.lastName})")
            
            # Delete workspace memberships
            memberships = session.exec(select(WorkspaceMember).where(WorkspaceMember.userId == u.id)).all()
            for m in memberships:
                print(f"  Deleting membership in workspace: {m.workspaceId}")
                session.delete(m)
                
            # Delete user
            session.delete(u)
            
        session.commit()
        print("Commit successful. Lance users deleted.")
    session.close()

if __name__ == "__main__":
    main()
