DEFAULT_RULES = {
    "Food": ["grocery", "restaurant", "cafe", "coffee", "uber eats", "doordash", "pizza", "mcdonald", "starbucks", "dining", "food", "bakery", "burger", "subway"],
    "Travel": ["uber", "lyft", "airline", "flight", "hotel", "airbnb", "gas", "fuel", "parking", "train", "taxi", "car rental", "delta", "united", "expedia"],
    "Shopping": ["amazon", "walmart", "target", "ebay", "clothing", "zara", "h&m", "mall", "store", "shopping", "best buy", "ikea"],
    "Bills": ["electric", "water", "internet", "phone", "utility", "rent", "mortgage", "insurance", "verizon", "at&t", "comcast", "bill"],
    "Entertainment": ["netflix", "spotify", "hulu", "movie", "cinema", "concert", "game", "steam", "youtube", "disney", "theater"],
    "Health": ["pharmacy", "doctor", "hospital", "clinic", "gym", "fitness", "medical", "dental", "cvs", "walgreens", "health"],
    "Education": ["tuition", "course", "udemy", "coursera", "book", "school", "university", "udemy", "tutor"],
    "Income": ["salary", "payroll", "deposit", "refund", "interest", "dividend", "freelance", "bonus", "income", "paycheck"],
}

CATEGORIES = list(DEFAULT_RULES.keys()) + ["Other", "Uncategorized"]


def categorize(description: str, extra_rules=None) -> str:
    d = description.lower()
    if extra_rules:
        for r in extra_rules:
            if r.keyword.lower() in d:
                return r.category
    for cat, keywords in DEFAULT_RULES.items():
        if any(k in d for k in keywords):
            return cat
    return "Other"
