# Personal Expense Analyzer and Budget Tracker

A web app that turns raw bank statements into clear spending insights. Upload a
CSV or XLSX file, and the app automatically categorizes every transaction, then
shows where your money goes through interactive charts, monthly trends,
budgets, and forecasts. Each import lives in its own spending profile, so
multiple files never mix.

## Features

**Import and profiles**
- Drag-and-drop or browse upload for `.csv` and `.xlsx` bank statements
- Automatic column detection (date, description, amount, type) with
  duplicate-row skipping and clear error messages for bad files
- Spending profiles: create a new profile per file or append to an existing
  one; switch profiles from the header; open any profile directly from the
  landing page without uploading; delete profiles you no longer need
- Data imported before profiles existed is kept under a "Previous data"
  profile instead of being lost or mixed in

**Automatic categorization**
- Keyword-based categorization into Food, Travel, Shopping, Bills,
  Entertainment, Health, Education, and Income, with custom keyword rules
- Recategorize any transaction inline; the change persists

**Dashboard insights**
- Income vs expenses, net balance, and savings rate
- Spending-by-category pie chart and horizontal bar chart
- Monthly income-vs-expenses trend line
- Day-of-week spending chart
- Top 5 largest expenses table
- Recurring subscription detection
- Next-month spending forecast (average of the last 3 months)

**Transactions**
- Search by description, filter by category
- Inline category editing, row deletion, CSV export

**Budgets**
- Per-category monthly limits with progress bars
- Each budget shows amount used, percent used, the reference month (the
  latest month in that profile's data), and an over-budget alert

**General**
- Dark mode toggle
- Currency-agnostic number formatting (no hardcoded currency symbols)
- Data stored locally in SQLite; nothing leaves your machine

## Tech Stack

| Layer    | Technology                                                              |
|----------|-------------------------------------------------------------------------|
| Backend  | Python, FastAPI, Pandas, SQLModel, SQLite, openpyxl (XLSX parsing)      |
| Frontend | React, TypeScript, Vite, Tailwind CSS v4, Recharts                      |

## Project Structure

```
pyproject/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, all API routes
│   │   ├── db.py                # SQLite engine, init + migrations
│   │   ├── models.py            # Profile, Transaction, Budget, CategoryRule
│   │   └── services/
│   │       ├── parser.py        # CSV/XLSX parsing + column detection
│   │       ├── categorize.py    # Keyword categorization rules
│   │       └── analytics.py     # Summaries, trends, budgets, forecast
│   ├── requirements.txt
│   └── seed/sample.csv          # Demo data (loaded on first run)
├── frontend/
│   └── src/
│       ├── App.tsx              # Shell: tabs, profile switcher, dark mode
│       ├── api.ts               # API client + number formatting
│       └── pages/
│           ├── Landing.tsx      # Upload + profile picker
│           ├── Dashboard.tsx    # Charts and insights
│           ├── Transactions.tsx # Searchable transaction table
│           └── Budgets.tsx      # Monthly budget tracking
└── data/                        # Extra sample statements to try out
```

## Getting Started

**Prerequisites:** Python 3.10+ and Node.js 18+.

**1. Start the backend** (serves the API on http://localhost:8000):

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000
```

**2. Start the frontend** (serves the UI on http://localhost:5173):

```bash
cd frontend
npm install
npm run dev
```

**3. Open http://localhost:5173** in your browser.

On first launch the dashboard is seeded with demo data so you can explore
immediately. Use the profile switcher or landing page to import your own file.

## Usage Flow

1. **Landing page** — either open an existing profile directly, or drop in a
   bank statement file.
2. **Choose a destination** — create a new profile (named after the file by
   default, or type your own name) or append the file to an existing profile.
3. **Analyze** — the file is parsed, categorized, and the dashboard opens with
   your insights.
4. **Explore** — switch between Dashboard, Transactions, and Budgets tabs;
   switch profiles or import more files from the header at any time.

## Accepted File Format

The importer auto-detects common column names, so most bank exports work
without editing. A minimal CSV looks like this:

```csv
date,description,amount,type
2026-09-01,Salary Credit,65000,income
2026-09-02,Swiggy Order,-320,expense
2026-09-03,Uber Ride,-180,expense
```

Recognized headers include `date / transaction_date / posted_date`,
`description / merchant / memo / payee`, `amount / value / amt`, and
`type / transaction_type` (values like `debit/credit` or
`expense/income`). Amount signs are normalized automatically, and
`$` symbols and thousand separators are stripped.

Sample files to try are included in the `data/` folder (CSV and XLSX).

## API Reference

The frontend talks to the backend through these endpoints (all data
endpoints are scoped with `?profile_id=…` so profiles stay isolated):

| Method          | Endpoint                        | Purpose                                  |
|-----------------|---------------------------------|------------------------------------------|
| GET / POST / DELETE | `/api/profiles`             | List, create, and delete profiles        |
| POST            | `/api/upload?profile_id=…`      | Import a CSV/XLSX file into a profile    |
| POST            | `/api/reset?profile_id=…`       | Wipe a profile's transactions + budgets  |
| GET             | `/api/summary?profile_id=…`     | Income, expenses, net, savings rate      |
| GET             | `/api/by-category?profile_id=…` | Spending totals per category             |
| GET             | `/api/monthly-trend?profile_id=…` | Income/expenses per month              |
| GET             | `/api/top-expenses?profile_id=…` | Largest expenses (`n` query param, default 5) |
| GET             | `/api/recurring?profile_id=…`   | Detected repeating subscriptions         |
| GET             | `/api/forecast?profile_id=…`    | Projected next-month spending            |
| GET             | `/api/heatmap?profile_id=…`     | Spending totals by day of week           |
| GET             | `/api/transactions?profile_id=…` | List transactions (`q`, `category`, `type`, `limit` filters) |
| PATCH / DELETE  | `/api/transactions/{id}`        | Recategorize or remove a transaction     |
| GET / POST / DELETE | `/api/budgets?profile_id=…` | Manage per-profile monthly budgets       |
| GET / POST / DELETE | `/api/rules`                | Manage keyword categorization rules      |
| GET             | `/api/meta`                     | Available category list                  |
| GET             | `/api/health`                   | Health check                             |

## Notes

- The Vite dev server proxies `/api` to `http://localhost:8000`, so both
  servers must run during development.
- The SQLite database file (`backend/expenses.db`) is created automatically
  on first run, including migrations for databases created by older versions.
- Budgets are evaluated against the latest month present in each profile's
  data, so imported history always produces meaningful usage bars.
