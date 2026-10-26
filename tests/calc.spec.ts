// Lógica pura del motor (js/calc.js), sin navegador.
import { test, expect } from "@playwright/test";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Calc = require("../js/calc.js");

type State = ReturnType<typeof Calc.fresh>;

// Teclea una secuencia como en el teclado de la app: * = ×, / = ÷, s = ±
function keys(seq: string, st: State = Calc.fresh()) {
  const map: Record<string, string> = { "*": "×", "/": "÷", s: "±" };
  let msg: string | undefined;
  for (const ch of seq) msg = Calc.press(st, map[ch] || ch) ?? msg;
  return { st, msg, last: st.hist[st.hist.length - 1] };
}

test.describe("redondeo", () => {
  for (const [seq, res] of [
    ["153.63-108=", "45.63"],
    ["0.1+0.2=", "0.3"],
    ["108-153.63=", "-45.63"],
    ["1.1*3=", "3.3"],
    ["0.3-0.1=", "0.2"],
    ["1/3=", "0.333333333333"],
    ["2-2=", "0"],
  ]) {
    test(`${seq} da ${res}`, () => {
      const { st, last } = keys(seq);
      expect(st.expr).toBe(res);
      expect(last.res).toBe(res);
    });
  }

  test("el negativo se marca como negativo y se muestra con signo menos", () => {
    const { last } = keys("108-153.63=");
    expect(Calc.isNeg(last.res)).toBe(true);
    expect(Calc.show(last.res)).toBe("−45.63");
    expect(last.ex).toBe("108 − 153.63");
  });
});

test.describe("% estilo CalcMem", () => {
  for (const [seq, tag, ex, res] of [
    ["56+23%", "56+23%", "56 + 12.88", "68.88"],
    ["200-10%", "200−10%", "200 − 20", "180"],
    ["50*20%", "50×20%", "50 × 0.2", "10"],
    ["50/20%", "50÷20%", "50 ÷ 0.2", "250"],
    ["23%", "23%", "23 ÷ 100", "0.23"],
    ["10+5*20%", "10+5×20%", "(10 + 5) × 0.2", "3"],
  ]) {
    test(`${seq} = ${res}`, () => {
      const { st, last } = keys(seq);
      expect(last).toMatchObject({ tag, ex, res });
      expect(st.expr).toBe(res);
      expect(st.just).toBe(true);
    });
  }

  test("% de cero dividiendo avisa y no guarda", () => {
    const { st, msg } = keys("50/0%");
    expect(msg).toBe("No se puede dividir por cero");
    expect(st.hist).toHaveLength(0);
  });

  test("% con paréntesis sin cerrar avisa", () => {
    const { st, msg } = keys("(5+3%");
    expect(msg).toBe("Cerrá los paréntesis antes del %");
    expect(st.hist).toHaveLength(0);
  });
});

test.describe("paréntesis", () => {
  test("(2+3)×4 = 20", () => {
    expect(keys("(2+3)*4=").st.expr).toBe("20");
  });

  test("2(3) se toma como 2×(3)", () => {
    const { st, last } = keys("2(3)=");
    expect(st.expr).toBe("6");
    expect(last.ex).toBe("2 × (3)");
  });

  test("(3)2 se toma como (3)×2", () => {
    expect(keys("(3)2=").st.expr).toBe("6");
  });

  test("los paréntesis sin cerrar se cierran solos al apretar =", () => {
    const { st, last } = keys("((2+3)*4=");
    expect(st.expr).toBe("20");
    expect(last.ex).toBe("((2 + 3) × 4)");
  });

  test(") sin paréntesis abierto no hace nada", () => {
    expect(keys("2)").st.expr).toBe("2");
  });
});

test.describe("dividir por cero", () => {
  for (const seq of ["1/0=", "1/(2-2)=", "0/0="]) {
    test(`${seq} avisa y no se guarda`, () => {
      const { st, msg } = keys(seq);
      expect(msg).toBe("No se puede dividir por cero");
      expect(st.hist).toHaveLength(0);
      expect(st.just).toBe(false);
    });
  }
});

test.describe("igual", () => {
  test("= dos veces seguidas no duplica el renglón", () => {
    const { st } = keys("2+3==");
    expect(st.hist).toHaveLength(1);
    expect(st.expr).toBe("5");
  });

  test("un número solo no se guarda en el historial", () => {
    expect(keys("42=").st.hist).toHaveLength(0);
  });

  test("operador colgando se ignora: 5+ = 5", () => {
    const { st } = keys("5+=");
    expect(st.expr).toBe("5");
    expect(st.hist).toHaveLength(0);
  });

  test("después de =, un número empieza otra cuenta y un operador sigue", () => {
    expect(keys("2+3=7").st.expr).toBe("7");
    expect(keys("2+3=+1=").st.expr).toBe("6");
  });
});

test.describe("edición", () => {
  test("goma borra solo el cálculo actual", () => {
    const { st } = keys("2+3=4*5");
    Calc.clear(st);
    expect(st.expr).toBe("");
    expect(st.hist).toHaveLength(1);
  });

  test("flecha borra de a un carácter", () => {
    const { st } = keys("123+4");
    Calc.back(st);
    expect(st.expr).toBe("123+");
    Calc.back(st);
    expect(st.expr).toBe("123");
    expect(st.hist).toHaveLength(0);
  });

  test("flecha sobre un resultado no toca el historial", () => {
    const { st } = keys("2+3=");
    Calc.back(st);
    expect(st.hist).toHaveLength(1);
  });

  test("± cambia el signo del último número", () => {
    expect(keys("5s").st.expr).toBe("-5");
    expect(keys("5ss").st.expr).toBe("5");
    expect(keys("8+5s").st.expr).toBe("8-5");
    expect(keys("8-5s").st.expr).toBe("8+5");
    expect(keys("8*5s").st.expr).toBe("8×-5");
    expect(keys("8*5s=").st.expr).toBe("-40");
  });

  test("no acepta dos puntos en un número", () => {
    expect(keys("1.2.3").st.expr).toBe("1.23");
    expect(keys("1.5+2.5=").st.expr).toBe("4");
  });

  test("un punto solo se completa con cero", () => {
    expect(keys(".5").st.expr).toBe("0.5");
  });

  test("no deja ceros a la izquierda", () => {
    expect(keys("007").st.expr).toBe("7");
  });

  test("cambiar de operador reemplaza el anterior", () => {
    expect(keys("5+*3=").st.expr).toBe("15");
    expect(keys("5*-3=").st.expr).toBe("-15");
  });
});

test.describe("historial", () => {
  test(`guarda como máximo ${Calc.MAX_HIST} renglones, descartando los más viejos`, () => {
    const st = Calc.fresh();
    for (let i = 1; i <= 55; i++) keys(`${i}+1=`, st);
    expect(st.hist).toHaveLength(50);
    expect(st.hist[0].ex).toBe("6 + 1");
    expect(st.hist[49].ex).toBe("55 + 1");
  });

  test("cada renglón tiene id único, fecha y nota vacía", () => {
    const { st } = keys("1+1=2+2=");
    expect(st.hist.map((e: { id: number }) => e.id)).toEqual([1, 2]);
    expect(st.hist[0].note).toBe("");
    expect(typeof st.hist[0].t).toBe("number");
  });

  test("usar resultado de un renglón en la cuenta actual", () => {
    const { st } = keys("2+3=");
    keys("10+", st);
    Calc.insertNumber(st, "-4");
    expect(st.expr).toBe("10+-4");
    keys("2", st);
    Calc.insertNumber(st, "5");
    expect(st.expr).toBe("10+-42×5");
  });

  test("usar cálculo de un renglón lo vuelve editable", () => {
    const { st, last } = keys("108-153.63=");
    Calc.useExpr(st, last.ex);
    expect(st.expr).toBe("108-153.63");
    expect(st.just).toBe(false);
  });
});

test.describe("dólar", () => {
  test("lee la cotización con coma o punto", () => {
    expect(Calc.readRate("40,25")).toBe(40.25);
    expect(Calc.readRate("40.25")).toBe(40.25);
    expect(Calc.readRate("0")).toBeNull();
    expect(Calc.readRate("")).toBeNull();
    expect(Calc.readRate("-3")).toBeNull();
  });

  test("guarda la cotización y la fecha en que se cargó", () => {
    const st = Calc.fresh();
    Calc.setRate(st, 40.25);
    expect(st.rate).toBe("40.25");
    expect(st.rateAt).toBeGreaterThan(0);
  });

  test("$U → US$", () => {
    const { st } = keys("1000");
    expect(Calc.convert(st, 40, true)).toBeUndefined();
    expect(st.expr).toBe("25");
    expect(st.hist[0]).toMatchObject({ ex: "1000 ÷ 40", res: "25", tag: "$U → US$" });
  });

  test("US$ → $U", () => {
    const { st } = keys("25");
    Calc.convert(st, 40.25, false);
    expect(st.expr).toBe("1006.25");
    expect(st.hist[0]).toMatchObject({ ex: "25 × 40.25", res: "1006.25", tag: "US$ → $U" });
  });

  test("ida y vuelta da el mismo monto", () => {
    const { st } = keys("1234.5");
    Calc.convert(st, 39.87, true);
    Calc.convert(st, 39.87, false);
    expect(st.expr).toBe("1234.5");
  });

  test("convierte el resultado de la cuenta en curso", () => {
    const { st } = keys("500+500");
    Calc.convert(st, 40, true);
    expect(st.expr).toBe("25");
  });

  test("sin monto avisa", () => {
    expect(Calc.convert(Calc.fresh(), 40, true)).toBe("Primero escribí un monto");
  });
});

test.describe("sin eval", () => {
  test("rechaza cualquier cosa que no sea número u operador", () => {
    expect(() => Calc.calc("alert(1)")).toThrow();
    expect(() => Calc.calc("2+2;1")).toThrow();
    expect(() => Calc.tokenize("1..2")).toThrow();
  });

  test("respeta precedencia: 2+3×4 = 14", () => {
    expect(Calc.calc("2+3×4")).toBe(14);
    expect(Calc.calc("10-4-3")).toBe(3);
    expect(Calc.calc("100÷10÷2")).toBe(5);
  });
});
