# Hormigón Lab Mobile

Simulador académico de ensayos de concreto para teléfonos Android, desarrollado con **JavaScript, Vite, Three.js y Capacitor**.

## Funciones

- Ensayo de **compresión axial de cilindros** y cálculo de esfuerzos.
- Ensayo de **flexión de viguetas**, con carga central o a tercios.
- Modelación simplificada de viguetas **armadas con barras y estribos**.
- Dosificación por masa, absorción y humedad de agregados, tamaño máximo nominal, módulo de finura, edad y curado.
- **Máquina de ensayo 3D** con interacción táctil, pistón y representación visual de falla.
- Control de **tasa de aplicación de carga** y resultados desarrollados paso a paso.
- Registro de **lecturas reales**, historial experimental y comparación con valores indicativos.
- Exportación de resultados y memorias.

## Estado verificado

- Motor de cálculo: **25 pruebas locales aprobadas**.
- La compilación automática del APK se ejecuta desde **Actions**.
- El funcionamiento del modelo 3D y la instalación deben probarse en un Android real.
- No confundir resultados **estimados** de simulación con mediciones reales.

## Descargar APK

1. Entra en **Actions** en este repositorio.
2. Abre la ejecución más reciente de **Compilar APK Hormigon Lab**.
3. Si concluye en **Success**, abre **Artifacts**.
4. Descarga **Hormigon-Lab-Android-APK**, descomprime y extrae `app-debug.apk`.
5. Instálalo en un teléfono Android de prueba.

## Usar en PC

Requiere Node.js 22:

```bash
npm install
npm test
npm run dev
```

Para generar la interfaz web:

```bash
npm run build
```

## Archivos principales

- `src/engine.js`: motor matemático de ensayos.
- `src/main.js`: formularios, resultados, cálculos e historial.
- `src/machine3d.js`: máquina 3D con Three.js.
- `src/style.css`: diseño visual móvil.
- `tests/engine.test.js`: pruebas automáticas.
- `.github/workflows/import-android.yml`: compilación APK.
- `capacitor.config.json`: configuración Android.

## Referencias y límites

Basado en aspectos de ASTM C39/C39M (compresión), C78/C78M y C293/C293M (flexión), C469/C469M (módulo), y ACI PRC-211.1 (dosificación).

**No sustituye ensayos de laboratorio, la calibración de equipos ni un diseño estructural conforme a NSR-10.** Predicciones de carga o resistencia se presentan como modelos didácticos hasta calibrarlas con experimentos documentados.

Desarrollo académico para la asignatura **Hormigón I**.
