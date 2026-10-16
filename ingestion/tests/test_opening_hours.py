import unittest

from opening_hours import parse


def p(day, opens, closes):
    return {"day": day, "opens": opens, "closes": closes}


class Horarios(unittest.TestCase):
    def test_rango_de_dias_y_un_tramo(self):
        self.assertEqual(parse("Mo-Fr 09:00-18:00"), [p(d, "09:00", "18:00") for d in range(5)])

    def test_lista_de_dias_con_o_sin_espacios(self):
        self.assertEqual(parse("Mo,We 10:00-12:00"), [p(0, "10:00", "12:00"), p(2, "10:00", "12:00")])
        self.assertEqual(parse("We, Th, Su 19:00-22:30"),
                         [p(2, "19:00", "22:30"), p(3, "19:00", "22:30"), p(6, "19:00", "22:30")])

    def test_dos_tramos_el_mismo_dia(self):
        self.assertEqual(parse("Mo 11:30-15:00,19:00-23:00"), [p(0, "11:30", "15:00"), p(0, "19:00", "23:00")])

    def test_la_ultima_regla_pisa_a_las_anteriores(self):
        # «Mo-Sa …; Sa …»: el sábado queda solo con la segunda
        got = parse("Mo-Sa 08:00-21:00; Sa 08:30-13:00,17:00-21:00")
        self.assertEqual([x for x in got if x["day"] == 5], [p(5, "08:30", "13:00"), p(5, "17:00", "21:00")])
        self.assertEqual(len([x for x in got if x["day"] != 5]), 5)

    def test_sin_dias_es_todos_los_dias(self):
        self.assertEqual(parse("18:00-02:00"), [p(d, "18:00", "02:00") for d in range(7)])

    def test_cierra_pasada_la_medianoche(self):
        self.assertEqual(parse("Fr,Sa 20:00-02:00"), [p(4, "20:00", "02:00"), p(5, "20:00", "02:00")])

    def test_24_horas_en_punto_es_medianoche(self):
        self.assertEqual(parse("Mo 08:00-24:00"), [p(0, "08:00", "00:00")])

    def test_abierto_24_horas(self):
        self.assertEqual(parse("24/7"), [p(d, "00:00", "00:00") for d in range(7)])
        self.assertEqual(parse("Mo 00:00-24:00"), [p(0, "00:00", "00:00")])

    def test_dias_cerrados(self):
        self.assertEqual(parse("Mo,Tu off; We-Su 18:30-23:30"), [p(d, "18:30", "23:30") for d in range(2, 7)])

    def test_rango_que_cruza_el_domingo(self):
        self.assertEqual([x["day"] for x in parse("Fr-Mo 10:00-12:00")], [0, 4, 5, 6])

    def test_ignora_feriados_fijos(self):
        self.assertEqual(parse('Mo-Su 09:00-23:00; May 1 off "Día del trabajador"; Dec 8 off "Inmaculada"'),
                         [p(d, "09:00", "23:00") for d in range(7)])
        self.assertEqual(parse('Mo 09:00-12:00; Jan 01: off "Nuevo Año"'), [p(0, "09:00", "12:00")])
        self.assertEqual(parse("Mo 09:00-12:00; Dec 24-25 off; Dec 31-Jan 1 off"), [p(0, "09:00", "12:00")])

    def test_ph_se_ignora_pero_los_demas_dias_valen(self):
        self.assertEqual(parse("Fr,Sa,PH 10:00-01:00"), [p(4, "10:00", "01:00"), p(5, "10:00", "01:00")])

    def test_sin_horario_o_sin_nada_abierto_es_null(self):
        for text in ("", "   ", "Su off", 'May 1 off "Día del Trabajador"'):
            self.assertIsNone(parse(text), msg=text)

    def test_lo_que_no_entiende_es_null(self):
        for text in ("We-Su 19:00+", "Sa,Su,PH 12:00+", "sunrise-sunset", "Mo-Fr 09:00-18:00; Sa [1] 10:00-12:00",
                     "Mo-Fr 25:00-26:00", "Mo 08:00-08:00", "por turnos", "Mo-Fr 09:00-18:00 open",
                     "Mo-Su 10:00-20:00; Jun-Aug off", "Mo-Fr 10:00-20:00; Dec off",
                     "Mo-Su 10:00-20:00; Dec Mo-Fr off", "Mo-Su 10:00-20:00; Jan 2-Feb 28 off",
                     "Mo-Su 10:00-20:00; Dec 1-15 off", "Mo-Su 10:00-20:00; Jan 1-Dec 31 off",
                     "Mo-Su 10:00-20:00; Dec 25-20 off"):
            self.assertIsNone(parse(text), msg=text)

    def test_horas_de_un_digito(self):
        self.assertEqual(parse("Mo 9:00-18:00"), [p(0, "09:00", "18:00")])


if __name__ == "__main__":
    unittest.main()
