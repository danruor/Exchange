# Dólar MX

Aplicación web estática para consultar el tipo de cambio de referencia del dólar estadounidense frente al peso mexicano (USD/MXN), revisar su comportamiento reciente y convertir importes.

**Aplicación:** https://dolar-mx-daniel.danruor-0137.chatgpt.site

**GitHub Pages:** https://danruor.github.io/Exchange/

## Funciones

- Tipo de cambio del último día hábil disponible.
- Variación respecto al día hábil anterior.
- Historial de 30, 90 y 180 días hábiles.
- Máximo, mínimo y promedio del periodo.
- Conversión USD → MXN y MXN → USD.
- Respaldo local de la última consulta para fallas temporales de conexión.
- Diseño adaptable, accesible y compatible con modo claro u oscuro.

## Fuente de datos

La aplicación consume la API pública de [Frankfurter](https://frankfurter.dev/), que agrega tipos de cambio de proveedores públicos. No requiere llave de API. Los datos son informativos y no representan el precio de compra o venta de una institución bancaria.

## Ejecutar localmente

Sirve la carpeta `dist` con cualquier servidor HTTP estático. Por ejemplo:

```bash
python3 -m http.server 8000 --directory dist
```

Después abre `http://localhost:8000`.

## Publicación

El flujo incluido en `.github/workflows/pages.yml` publica automáticamente la carpeta `dist` en GitHub Pages cada vez que se actualiza la rama `main`, una vez que GitHub Pages está configurado para usar **GitHub Actions** como fuente.

## Licencia

MIT
