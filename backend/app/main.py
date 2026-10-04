from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select, delete
from typing import Optional

from .db import init_db, get_session
from .models import Transaction, Budget, CategoryRule, Profile
from .services import analytics
from .services.parser import parse_file
from .services.categorize import CATEGORIES

app = FastAPI(title="Personal Expense Analyzer & Budget Tracker")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def startup():
    init_db()
    # Adopt rows imported before profiles existed into a labeled profile
    # so old data stays visible instead of silently disappearing.
    from .db import engine
    with Session(engine) as s:
        orphans = s.exec(select(Transaction).where(Transaction.profile_id == None)).all()  # noqa: E711
        orphan_budgets = s.exec(select(Budget).where(Budget.profile_id == None)).all()  # noqa: E711
        if orphans or orphan_budgets:
            legacy = s.exec(select(Profile).where(Profile.name == "Previous data")).first()
            if not legacy:
                legacy = Profile(name="Previous data")
                s.add(legacy)
                s.commit()
                s.refresh(legacy)
            for t in orphans:
                t.profile_id = legacy.id
                s.add(t)
            for b in orphan_budgets:
                b.profile_id = legacy.id
                s.add(b)
            s.commit()


# ---------- Profiles ----------

@app.get("/api/profiles")
def list_profiles(session: Session = Depends(get_session)):
    profiles = session.exec(select(Profile).order_by(Profile.id)).all()
    out = []
    for p in profiles:
        n = len(session.exec(select(Transaction).where(Transaction.profile_id == p.id)).all())
        out.append({"id": p.id, "name": p.name, "created_at": p.created_at.isoformat(), "transactions": n})
    return out


@app.post("/api/profiles")
def create_profile(name: str = Query(...), session: Session = Depends(get_session)):
    name = name.strip()
    if not name:
        raise HTTPException(400, "Profile name cannot be empty")
    p = Profile(name=name)
    session.add(p)
    session.commit()
    return {"id": p.id, "name": p.name}


@app.delete("/api/profiles/{id}")
def delete_profile(id: int, session: Session = Depends(get_session)):
    p = session.get(Profile, id)
    if not p:
        raise HTTPException(404)
    session.exec(delete(Transaction).where(Transaction.profile_id == id))
    session.exec(delete(Budget).where(Budget.profile_id == id))
    session.delete(p)
    session.commit()
    return {"ok": True}


# ---------- Import ----------

@app.post("/api/upload")
async def upload(file: UploadFile = File(...), profile_id: int = Query(...),
                 session: Session = Depends(get_session)):
    if not session.get(Profile, profile_id):
        raise HTTPException(404, "Profile not found")
    try:
        added, skipped = parse_file(await file.read(), session,
                                    filename=file.filename or "transactions.csv",
                                    profile_id=profile_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"added": added, "skipped_duplicates": skipped}


@app.post("/api/reset")
def reset_data(profile_id: int = Query(...), session: Session = Depends(get_session)):
    """Delete all transactions and budgets of a profile (profile itself stays)."""
    session.exec(delete(Transaction).where(Transaction.profile_id == profile_id))
    session.exec(delete(Budget).where(Budget.profile_id == profile_id))
    session.commit()
    return {"ok": True}


# ---------- Analytics ----------

@app.get("/api/summary")
def get_summary(profile_id: int = Query(...), session: Session = Depends(get_session)):
    return analytics.summary(session, profile_id)


@app.get("/api/by-category")
def get_by_category(profile_id: int = Query(...), session: Session = Depends(get_session)):
    return analytics.by_category(session, profile_id)


@app.get("/api/monthly-trend")
def get_monthly(profile_id: int = Query(...), session: Session = Depends(get_session)):
    return analytics.monthly_trend(session, profile_id)


@app.get("/api/top-expenses")
def get_top(n: int = 5, profile_id: int = Query(...), session: Session = Depends(get_session)):
    return analytics.top_expenses(session, n, profile_id)


@app.get("/api/recurring")
def get_recurring(profile_id: int = Query(...), session: Session = Depends(get_session)):
    return analytics.recurring(session, profile_id)


@app.get("/api/forecast")
def get_forecast(profile_id: int = Query(...), session: Session = Depends(get_session)):
    return analytics.forecast(session, profile_id)


@app.get("/api/heatmap")
def get_heatmap(profile_id: int = Query(...), session: Session = Depends(get_session)):
    return analytics.heatmap(session, profile_id)


# ---------- Transactions ----------

@app.get("/api/transactions")
def list_transactions(profile_id: int = Query(...), q: Optional[str] = None,
                      category: Optional[str] = None,
                      tx_type: Optional[str] = Query(default=None, alias="type"),
                      limit: int = Query(default=500, le=2000),
                      session: Session = Depends(get_session)):
    q_ = select(Transaction).where(Transaction.profile_id == profile_id).order_by(Transaction.date.desc())
    txns = session.exec(q_).all()
    if q:
        txns = [t for t in txns if q.lower() in t.description.lower()]
    if category:
        txns = [t for t in txns if t.category == category]
    if tx_type:
        txns = [t for t in txns if t.type == tx_type]
    return [t.model_dump() | {"date": t.date.isoformat()} for t in txns[:limit]]


@app.patch("/api/transactions/{id}")
def update_transaction(id: int, category: str = Query(...), session: Session = Depends(get_session)):
    t = session.get(Transaction, id)
    if not t:
        raise HTTPException(404)
    t.category = category
    session.add(t)
    session.commit()
    return {"ok": True}


@app.delete("/api/transactions/{id}")
def delete_transaction(id: int, session: Session = Depends(get_session)):
    t = session.get(Transaction, id)
    if t:
        session.delete(t)
        session.commit()
    return {"ok": True}


# ---------- Budgets ----------

@app.get("/api/budgets")
def get_budgets(profile_id: int = Query(...), session: Session = Depends(get_session)):
    return analytics.budgets_status(session, profile_id)


@app.post("/api/budgets")
def add_budget(category: str, monthly_limit: float, profile_id: int = Query(...),
               session: Session = Depends(get_session)):
    b = session.exec(select(Budget).where(Budget.profile_id == profile_id,
                                          Budget.category == category)).first()
    if b:
        b.monthly_limit = monthly_limit
    else:
        b = Budget(profile_id=profile_id, category=category, monthly_limit=monthly_limit)
    session.add(b)
    session.commit()
    return {"ok": True}


@app.delete("/api/budgets/{id}")
def delete_budget(id: int, session: Session = Depends(get_session)):
    b = session.get(Budget, id)
    if b:
        session.delete(b)
        session.commit()
    return {"ok": True}


# ---------- Rules (global) ----------

@app.get("/api/rules")
def get_rules(session: Session = Depends(get_session)):
    return session.exec(select(CategoryRule)).all()


@app.post("/api/rules")
def add_rule(keyword: str, category: str, session: Session = Depends(get_session)):
    session.add(CategoryRule(keyword=keyword, category=category))
    session.commit()
    return {"ok": True}


@app.delete("/api/rules/{id}")
def delete_rule(id: int, session: Session = Depends(get_session)):
    r = session.get(CategoryRule, id)
    if r:
        session.delete(r)
        session.commit()
    return {"ok": True}


@app.get("/api/meta")
def meta():
    return {"categories": CATEGORIES}


@app.get("/api/health")
def health():
    return {"ok": True}
