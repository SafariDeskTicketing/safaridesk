from datetime import date

HOLIDAYS = [
    # --- Common Holidays (Kenya + US) ---
    {"name": "New Year's Day", "date": date(date.today().year, 1, 1)},
    {"name": "Christmas Day", "date": date(date.today().year, 12, 25)},

    # --- Kenya ---
    {"name": "Labour Day (Kenya)", "date": date(date.today().year, 5, 1)},
    {"name": "Madaraka Day", "date": date(date.today().year, 6, 1)},
    {"name": "Huduma Day", "date": date(date.today().year, 10, 10)},
    {"name": "Mashujaa Day", "date": date(date.today().year, 10, 20)},
    {"name": "Jamhuri Day", "date": date(date.today().year, 12, 12)},
    {"name": "Boxing Day", "date": date(date.today().year, 12, 26)},

    # --- United States ---
    {"name": "Independence Day", "date": date(date.today().year, 7, 4)},
    {"name": "Juneteenth National Independence Day", "date": date(date.today().year, 6, 19)},
    {"name": "Veterans Day", "date": date(date.today().year, 11, 11)}
]
