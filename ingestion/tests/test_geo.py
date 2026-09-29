import unittest

from scrapers import geocode
from scrapers.muni import _is_date_line


class Geocode(unittest.TestCase):
    def test_swapped_name(self):
        self.assertEqual(geocode._swapped("LOPEZ ESTANISLAO 2250"), "ESTANISLAO LOPEZ 2250")
        self.assertEqual(geocode._swapped("FRANCIA 4435"), "")  # una sola palabra: nada que invertir

    def test_strip_parens(self):
        self.assertEqual(geocode._strip_parens("Junín 501 (Alto Rosario Shopping)"), "Junín 501")
        self.assertEqual(geocode._strip_parens("Sala (a (b)) Norte"), "Sala Norte")

    def test_date_fragments_are_not_venues(self):
        for text in ("29 DE Septiembre", "2 DE Octubre", "DE 09:30", "DE 18"):
            self.assertTrue(geocode._looks_like_date(text) or _is_date_line(text), text)
        self.assertFalse(_is_date_line("Teatro El Círculo"))

    def test_uses_cache_without_network(self):
        cache = {"teatro el circulo": [-32.95, -60.63], "nada": None}
        self.assertEqual(geocode.locate("Teatro El Círculo", "", cache), (-32.95, -60.63))
        self.assertIsNone(geocode.locate("Nada", "", cache))
        self.assertIsNone(geocode.locate("29 DE Septiembre", "", cache))


if __name__ == "__main__":
    unittest.main()
