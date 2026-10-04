from datetime import date, datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field


class Profile(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Transaction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    profile_id: Optional[int] = Field(default=None, foreign_key="profile.id", index=True)
    date: date
    description: str
    amount: float  # negative = expense, positive = income
    category: str = "Uncategorized"
    type: str = "expense"  # expense | income


class Budget(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    profile_id: Optional[int] = Field(default=None, foreign_key="profile.id", index=True)
    category: str
    monthly_limit: float


class CategoryRule(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    keyword: str
    category: str
