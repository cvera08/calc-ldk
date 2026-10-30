# Calc LDK

Calculadora con cinta e historial para el teléfono. Es una app web instalable (PWA)
que funciona sin internet.

**https://cvera08.github.io/calc-ldk/**

Reemplaza a una calculadora de Android que ya no existe. La usamos de guía para el
aspecto y el comportamiento; el código es propio y está escrito de cero.

## Qué hace

- Cinta con las últimas 50 cuentas, separadas por día, con una nota por renglón.
  Queda guardada en el teléfono aunque se cierre la app.
- Los resultados negativos se muestran en rojo.
- Redondeo para que `153.63 − 108` dé `45.63` y no `45.6299999…`.
- `%` como la original: `56 + 23 %` da `56 + 12.88 = 68.88`.
- Paréntesis, con `2(3)` tomado como `2 × (3)`. Los que quedan sin cerrar se cierran al apretar `=`.
- Pesos y dólares: con la cotización guardada, muestra el monto en las dos monedas a la vez.
- No existe un botón para borrar todo el historial. La goma borra solo la cuenta actual.

## Instalar

- **iPhone (Safari):** compartir → *Agregar a pantalla de inicio*.
- **Android (Chrome):** menú ⋮ → *Agregar a pantalla de inicio* / *Instalar app*.

En iPhone, la app instalada guarda su historial aparte del que se ve en Safari:
conviene instalarla primero y usarla siempre desde el ícono.

## Desarrollo

Sin build y sin dependencias en la página: `index.html`, `js/calc.js` (el motor, sin
DOM ni `eval`) y `js/app.js` (pantalla y guardado).

```bash
npm install
npx playwright install chromium webkit
npm test            # lógica + la app en iPhone SE (WebKit) y Galaxy S9+ (Chromium)
npm run serve       # http://127.0.0.1:4173/
node scripts/make-icons.mjs   # regenera los íconos
```

GitHub Actions corre los tests sobre la carpeta exacta que se publica y, si pasan,
despliega a GitHub Pages.

**No cambiar** la clave `calc-casa-v1` de `localStorage` ni la URL sin un plan de
migración: el historial está atado a las dos.
