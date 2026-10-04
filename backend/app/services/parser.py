import io
import pandas as pd
from typing import Optional
from sqlmodel import Session, select
from ..models import Transaction, CategoryRule
from .categorize import categorize, DEFAULT_RULES

DATE_CANDIDATES = ["date", "transaction_date", "txn_date", "posted_date", "time"]
DESC_CANDIDATES = ["description", "desc", "merchant", "name", "details", "memo", "payee"]
AMOUNT_CANDIDATES = ["amount", "value", "amt", "transaction_amount"]
TYPE_CANDIDATES = ["type", "transaction_type", "category_type"]


def _find(cols, candidates):
    lower = {c.lower().strip(): c for c in cols}
    for cand in candidates:
        if cand in lower:
            return lower[cand]
    for c in cols:
        for cand in candidates:
            if cand in c.lower():
                return c
    return None


def _detect_filetype(filename: str) -> str:
    """Return file extension ('csv', 'xlsx', 'xls', ...) based on filename."""
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else "csv"


def parse_file(content: bytes, session: Session, filename: str = "transactions.csv",
               profile_id: Optional[int] = None) -> tuple[int, int]:
    """Returns (added, skipped_duplicates). Handles CSV and XLSX."""
    ftype = _detect_filetype(filename)
    if ftype in ("xls", "xlsm"):
        raise ValueError("Legacy .xls files are not supported. Please save the file as .xlsx or .csv and try again.")
    if ftype == "xlsx":
        try:
            df = pd.read_excel(io.BytesIO(content))
        except Exception:
            raise ValueError("Could not read this Excel file. Make sure it contains a proper spreadsheet with headers.")
    else:
        try:
            df = pd.read_csv(io.BytesIO(content))
        except Exception:
            raise ValueError("Could not parse this file as CSV. Check the file encoding/format.")
    if df.empty or len(df.columns) < 2:
        raise ValueError("The file appears to be empty or has no columns.")
    df.columns = [str(c).strip() for c in df.columns]

    date_col = _find(df.columns, DATE_CANDIDATES)
    desc_col = _find(df.columns, DESC_CANDIDATES)
    amount_col = _find(df.columns, AMOUNT_CANDIDATES)
    type_col = _find(df.columns, TYPE_CANDIDATES)
    if not (date_col and desc_col and amount_col):
        raise ValueError(f"Could not detect columns. Found: {list(df.columns)}")

    rules = session.exec(select(CategoryRule)).all()
    base = select(Transaction)
    if profile_id is not None:
        base = base.where(Transaction.profile_id == profile_id)
    existing = session.exec(base).all()
    existing_keys = {(t.date.isoformat(), t.description.strip().lower(), round(t.amount, 2)) for t in existing}

    added, skipped = 0, 0
    for _, row in df.iterrows():
        try:
            d = pd.to_datetime(row[date_col], errors="coerce")
            if pd.isna(d):
                continue
            desc = str(row[desc_col]).strip()
            amount = float(str(row[amount_col]).replace("$", "").replace(",", "").strip())
            if type_col and str(row[type_col]).strip().lower() in ("debit", "expense", "withdrawal"):
                amount = -abs(amount)
            elif type_col and str(row[type_col]).strip().lower() in ("credit", "income", "deposit"):
                amount = abs(amount)
            category = categorize(desc, rules)
            if category == "Income":
                amount = abs(amount)
            ttype = "income" if amount > 0 or category == "Income" else "expense"
            if ttype == "expense":
                amount = -abs(amount)
            key = (d.date().isoformat(), desc.lower(), round(amount, 2))
            if key in existing_keys:
                skipped += 1
                continue
            session.add(Transaction(
                profile_id=profile_id,
                date=d.date(), description=desc, amount=amount,
                category=category, type=ttype,
            ))
            existing_keys.add(key)
            added += 1
        except (ValueError, TypeError):
            continue
    session.commit()
    return added, skipped


DEFAULT_CATEGORIES = list(DEFAULT_RULES.keys()) + ["Other", "Uncategorized"]
