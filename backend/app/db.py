from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import text
from pathlib import Path

from . import models as _models  # noqa: F401  (register tables on metadata)

DB_PATH = Path(__file__).resolve().parent.parent / "expenses.db"
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})


def init_db():
    SQLModel.metadata.create_all(engine)
    # Migrate old databases that predate the profile feature.
    # NOTE: "transaction" is a reserved word in SQLite, hence the quoting.
    with engine.connect() as conn:
        cols = {r[1] for r in conn.execute(text('PRAGMA table_info("transaction")')).fetchall()}
        if cols and "profile_id" not in cols:
            conn.execute(text('ALTER TABLE "transaction" ADD COLUMN profile_id INTEGER'))
            conn.commit()
        cols = {r[1] for r in conn.execute(text('PRAGMA table_info("budget")')).fetchall()}
        if cols and "profile_id" not in cols:
            conn.execute(text('ALTER TABLE "budget" ADD COLUMN profile_id INTEGER'))
            conn.commit()


def get_session():
    with Session(engine) as session:
        yield session
