from collections import defaultdict
from datetime import date
from typing import Optional
from sqlmodel import Session, select
from ..models import Transaction, Budget


def _txns(session: Session, profile_id: Optional[int] = None):
    q = select(Transaction)
    if profile_id is not None:
        q = q.where(Transaction.profile_id == profile_id)
    return session.exec(q).all()


def summary(session: Session, profile_id: Optional[int] = None):
    txns = _txns(session, profile_id)
    income = sum(t.amount for t in txns if t.type == "income")
    expenses = sum(t.amount for t in txns if t.type == "expense")
    return {
        "income": round(income, 2),
        "expenses": round(abs(expenses), 2),
        "net": round(income + expenses, 2),
        "savings_rate": round((income + expenses) / income * 100, 1) if income > 0 else 0,
        "count": len(txns),
    }


def by_category(session: Session, profile_id: Optional[int] = None):
    totals = defaultdict(float)
    for t in _txns(session, profile_id):
        if t.type == "expense":
            totals[t.category] += abs(t.amount)
    return [{"category": k, "amount": round(v, 2)} for k, v in sorted(totals.items(), key=lambda x: -x[1])]


def monthly_trend(session: Session, profile_id: Optional[int] = None):
    months = defaultdict(lambda: {"income": 0.0, "expenses": 0.0})
    for t in _txns(session, profile_id):
        key = t.date.strftime("%Y-%m")
        if t.type == "income":
            months[key]["income"] += t.amount
        else:
            months[key]["expenses"] += abs(t.amount)
    return [{"month": m, "income": round(months[m]["income"], 2), "expenses": round(months[m]["expenses"], 2)} for m in sorted(months)]


def top_expenses(session: Session, n=5, profile_id: Optional[int] = None):
    txns = [t for t in _txns(session, profile_id) if t.type == "expense"]
    txns.sort(key=lambda t: t.amount)
    return [{"id": t.id, "date": t.date.isoformat(), "description": t.description, "amount": round(abs(t.amount), 2), "category": t.category} for t in txns[:n]]


def budgets_status(session: Session, profile_id: Optional[int] = None):
    base = select(Budget)
    if profile_id is not None:
        base = base.where(Budget.profile_id == profile_id)
    budgets = session.exec(base).all()
    txns = _txns(session, profile_id)
    # Reference month = latest month present in this profile's data, so
    # budgets always reflect the active period (not the wall-clock month,
    # which may have no transactions yet, e.g. freshly imported history).
    months = sorted({t.date.strftime("%Y-%m") for t in txns if t.type == "expense"})
    ref_month = months[-1] if months else date.today().strftime("%Y-%m")
    spent = defaultdict(float)
    for t in txns:
        if t.type == "expense" and t.date.strftime("%Y-%m") == ref_month:
            spent[t.category] += abs(t.amount)
    out = []
    for b in budgets:
        s = round(spent.get(b.category, 0.0), 2)
        out.append({"id": b.id, "category": b.category, "limit": b.monthly_limit, "spent": s,
                    "month": ref_month,
                    "pct": round(s / b.monthly_limit * 100, 1) if b.monthly_limit > 0 else 0,
                    "alert": s > b.monthly_limit})
    return out


def recurring(session: Session, profile_id: Optional[int] = None):
    groups = defaultdict(list)
    for t in _txns(session, profile_id):
        if t.type == "expense":
            groups[t.description.lower().strip()].append(t)
    out = []
    for desc, ts in groups.items():
        if len(ts) >= 2:
            amounts = {round(abs(t.amount), 2) for t in ts}
            if len(amounts) == 1:
                out.append({"description": ts[0].description, "amount": amounts.pop(), "category": ts[0].category, "count": len(ts)})
    return sorted(out, key=lambda x: -x["amount"])


def forecast(session: Session, profile_id: Optional[int] = None):
    monthly = monthly_trend(session, profile_id)
    if len(monthly) < 2:
        return {"next_month_expenses": None, "based_on_months": len(monthly)}
    last3 = monthly[-3:]
    avg = sum(m["expenses"] for m in last3) / len(last3)
    return {"next_month_expenses": round(avg, 2), "based_on_months": len(last3)}


def heatmap(session: Session, profile_id: Optional[int] = None):
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    grid = {d: 0.0 for d in days}
    for t in _txns(session, profile_id):
        if t.type == "expense":
            grid[days[t.date.weekday()]] += abs(t.amount)
    return [{"day": d, "amount": round(grid[d], 2)} for d in days]
