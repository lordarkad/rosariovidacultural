import unittest
from datetime import date

from scrapers.common import parse_range_ddmm, parse_spanish_dates

TODAY = date(2026, 9, 29)


def iso(spec):
    return [d.isoformat() for d in spec.dates]


class SpanishDates(unittest.TestCase):
    def test_single(self):
        s = parse_spanish_dates("Sábado 3 de octubre", TODAY)
        self.assertEqual(iso(s), ["2026-10-03"])
        self.assertFalse(s.ranged)

    def test_setiembre_variant(self):
        self.assertEqual(iso(parse_spanish_dates("Martes 29 de setiembre", TODAY)), ["2026-09-29"])

    def test_two_days_one_month(self):
        s = parse_spanish_dates("Viernes 2 y sábado 3 de octubre", TODAY)
        self.assertEqual(iso(s), ["2026-10-02", "2026-10-03"])

    def test_list(self):
        s = parse_spanish_dates("23, 24 y 25 de octubre", TODAY)
        self.assertEqual(iso(s), ["2026-10-23", "2026-10-24", "2026-10-25"])

    def test_two_months(self):
        s = parse_spanish_dates("31 de octubre y 1 de noviembre", TODAY)
        self.assertEqual(iso(s), ["2026-10-31", "2026-11-01"])

    def test_recurring_saturdays(self):
        s = parse_spanish_dates("Sábados de octubre", TODAY)
        self.assertEqual(iso(s), ["2026-10-03", "2026-10-10", "2026-10-17", "2026-10-24", "2026-10-31"])

    def test_range(self):
        s = parse_spanish_dates("Del 2 al 15 de octubre", TODAY)
        self.assertTrue(s.ranged)
        self.assertEqual((s.start.isoformat(), s.end.isoformat()), ("2026-10-02", "2026-10-15"))

    def test_year_rollover(self):
        s = parse_spanish_dates("15 de enero", TODAY)
        self.assertEqual(iso(s), ["2027-01-15"])

    def test_no_month_is_undated(self):
        self.assertIsNone(parse_spanish_dates("Próximamente", TODAY).start)

    def test_covers(self):
        s = parse_spanish_dates("Viernes 2 y sábado 3 de octubre", TODAY)
        self.assertTrue(s.covers(date(2026, 10, 3)))
        self.assertFalse(s.covers(date(2026, 10, 4)))


class MuniDates(unittest.TestCase):
    def test_range(self):
        s = parse_range_ddmm("30.09 al 11.10", TODAY)
        self.assertTrue(s.ranged)
        self.assertEqual((s.start.isoformat(), s.end.isoformat()), ("2026-09-30", "2026-10-11"))

    def test_single(self):
        s = parse_range_ddmm("02.10", TODAY)
        self.assertEqual(iso(s), ["2026-10-02"])

    def test_crosses_year(self):
        s = parse_range_ddmm("03.10 al 04.04", TODAY)
        self.assertEqual(s.end.isoformat(), "2027-04-04")


if __name__ == "__main__":
    unittest.main()
