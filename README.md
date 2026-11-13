# HORMIGÓN LAB · Simulador virtual de ensayos de concreto

Aplicación de simulación **Android** con interfaz táctil, máquina **3D rotatoria** creada mediante Three.js, calculadora técnica, laboratorio de mezclas, resultados paso a paso y registro histórico. Implementado en JavaScript + Vite + Capacitor 7.

> **Estado:** prototipo académico funcional de código; se completaron pruebas unitarias del motor. **No hay APK compilado ni prueba en teléfono dentro de este paquete**. Compilar con GitHub Actions o Android Studio. El proyecto no sustituye equipos reales, normas completas, procedimientos de acreditación o cálculo profesional.

## Funciones incorporadas

- **Compresión de cilindros:** diámetro/altura, edad, resistencia objetivo, carga máxima modelada, tasa de esfuerzo de compresión, cálculo de carga a partir de lectura experimental (ASTM C39/C39M).
- **Flexión de concreto simple:** cargas a tercios (ASTM C78/C78M) y central (ASTM C293/C293M). Geometría, luz, módulo de rotura estimado, carga a partir de lectura, advertencias sobre posición de fractura.
- **Viga reforzada:** 3/3 barras por defecto, barras superiores/inferiores editables, diámetros, recubrimiento, extremos rectos o ganchos visuales, estribos opcionales (diámetro/número de ramas/separación). Capacidad flexional y resistencia nominal a cortante SIMPLIFICADAS; posible control por flexión/cortante. No reproduce anclajes ni fisuración no lineal.
- **Mezclas y dosificación:** masas de cemento, agua, arena y grava; módulo de finura; tamaño máximo nominal; procedencia de agregados; humedad y absorción, gravedad específica, contenido de aire, tipo de cemento, aditivos y curado. Balance de agua y volumen absoluto con rendimiento aproximado. Recetas rápidas didácticas **no certificadas**.
- **Máquina virtual:** render 3D con rotación/zoom; cilindro o viga y apoyos; acero longitudinal y estribos visibles; rampa de carga, pistón animado y grieta ilustrativa; indicador de fuerza y gráfica.
- **Resultados:** más de 10 fórmulas mostradas con sustituciones, unidades y advertencias. Correlación de E de peso normal; opción de calcular módulo de cuerda solo cuando se suministran deformaciones medidas (consulta ASTM C469).
- **Experimentos:** ingreso de la carga máxima real, registro histórico local, exportación/importación JSON, calibración opcional con al menos 3 cilindros reales a 28 días y a/c distintos (regresión empírica, R² visible).
- **Informes:** memoria en HTML y en PDF, con intento de compartir mediante el sistema Android.
- **Sin conexión:** las dependencias se incluyen en el paquete generado; los cálculos no dependen de una API externa.

## COMPILACIÓN APK EN GITHUB

Repositorio destinado: `andresocampo1322-star/HORMIGON-LABORATORIO-MAQUINA-DE-ENSAYO`.

1. Sube **el contenido** de esta carpeta a la raíz del repositorio, incluyendo `.github/workflows/android.yml` (no subas el ZIP como archivo único).
2. Abre **Actions → Compilar APK Hormigon Lab**.
3. Selecciona **Run workflow → main**, o espera la ejecución automática después del `push` a `main`.
4. Si la compilación finaliza con éxito, abre la ejecución → **Artifacts → Hormigon-Lab-Android-APK**.
5. Descarga el artifact ZIP y extrae `app-debug.apk`. Instálalo en un Android de prueba; el sistema puede solicitar permiso para instalar aplicaciones de esa fuente.

El flujo instala Node 22, Java 21 y Android SDK, ejecuta las pruebas y compila la APK debug con Gradle. **No se ha verificado en CI desde esta sesión**; si falla, revisar logs de Actions antes de afirmar que existe un APK instalable.

### Alternativa usando Windows y Git

Si el repositorio continúa vacío, descomprime el ZIP y ejecuta `SUBIR_A_GITHUB_WINDOWS.bat` tras instalar Git para Windows e iniciar sesión (Git Credential Manager). El script sube todos los archivos conservando la carpeta `.github`.

### Alternativa local: Android Studio

```bash
npm install
npm test
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

En Android Studio: Build → Build APK(s). El paquete debug se genera en `android/app/build/outputs/apk/debug/`.

### Interfaz web en PC

```bash
npm install
npm run dev
```

Abre la dirección local indicada por Vite. En un entorno con WebGL, la máquina se renderiza con Three.js; si el módulo 3D no está disponible, la aplicación tiene una vista 2D de respaldo.

## VALIDACIONES

```bash
npm test
```

**25 pruebas automatizadas** del motor: cilindros, fórmulas de flexión central/a tercios, comparación de configuraciones, cuantías de acero, estribos, humedad de agregados, rango de tasas, correlación E, registro histórico, calibración y entradas no válidas.

## CORRECTA INTERPRETACIÓN DE RESULTADOS

1. **f'c de mezcla:** No puede inferirse la resistencia a compresión de manera normativa únicamente de kg de arena, grava y cemento. El programa utiliza el f'c ingresado o un ajuste local de ensayos reales. Para edades distintas a 28 días usa una curva didáctica explícitamente marcada como tal.
2. **Dosificación:** La relación 1:2:3 presentada como ejemplo es **por masa**, no por volumen. Para una dosificación oficial deben realizarse mezclas de prueba, corregir humedades y comprobar asentamiento, aire y resistencia. La selección definitiva de materiales sigue ACI PRC-211.1 y normas pertinentes.
3. **Módulo de elasticidad:** `E≈4700√f'c` es correlación aproximada de diseño para concreto de peso normal; el módulo de C469 exige ensayos y deformaciones medidas.
4. **Armaduras:** no se evalúan longitud de desarrollo, anclajes reales, fluencia no lineal, adherencia, pandeo, efectos de tamaño, vigas profundas, estribos confinantes o interacción acero-concreto. No sustituye un software de elementos finitos ni el diseño NSR-10.
5. **Velocidad de máquina:** tasa de incremento de esfuerzo (`MPa/s` o `MPa/min`) convertida a velocidad de carga (`kN/s`). La aceleración visual de reproducción es independiente de la tasa física de ensayo.
6. **Datos históricos:** jamás se insertan ejemplos sintéticos como ensayos reales. La calibración solo usa registros que el usuario marca expresamente como mediciones reales.
7. **Seguridad:** no controlar un equipo de ensayo real ni usar estimaciones para aceptar o rechazar concretos sin datos de laboratorio y norma completa.

## REFERENCIAS TÉCNICAS

- ASTM C39/C39M-26 — https://store.astm.org/c0039_c0039m-26.html
- ASTM C78/C78M-22 — https://store.astm.org/standards/c78_c78m
- ASTM C293/C293M — https://store.astm.org/standards/c293_c293m
- ASTM C469/C469M-22 — https://store.astm.org/standards/c469_c469m
- ASTM C192/C192M-26a — https://store.astm.org/c0192_c0192m-26a.html
- ASTM C33/C33M-24a — https://store.astm.org/c0033_c0033m-24a.html
- ACI PRC-211.1-22 — https://www.concrete.org/Portals/0/Files/PDF/Previews/211.1-22_preview.pdf

Las publicaciones citadas son **referencias**; el paquete no contiene copias de normas de pago ni certifica conformidad con ellas.

## RUTA DE DESARROLLO

**MVP actual:** calculadora + simulación 3D representativa + historia + PDF.

**Etapa 2:** calibración de varios tipos de mezcla por regresiones robustas, medición y curvas tensión-deformación C469 instrumentadas, control estricto de ensayos reales y condiciones de curado.

**Etapa 3:** modelo no lineal validado experimentalmente para vigas armadas (flexión/cortante/anclaje), elementos finitos, patrones de fisura con calibración física, gestión de múltiples máquinas y reportes de laboratorio profesionales.

Licencia de prototipo académico: revisar antes de distribución pública.

## Versión 0.2 — fractura visual y telemetría

- Patrones cualitativos de compresión **C39 tipos 1–6**, seleccionables para estudiar la geometría de la rotura.
- Visualizaciones de **flexión, cortante diagonal, flexión-cortante, adherencia, aplastamiento, compresión y apoyo** en viguetas; solo se sugieren modos de forma orientativa por el modelo seccional.
- Concreto con textura procedural, superficie de fractura tridimensional con áridos, partículas localizadas y nube fina de polvo. La animación NO aplica una explosión genérica.
- Armadura longitudinal real en geometría 3D, ganchos y estribos; opción de visualizar el acero dentro de la viga.
- Medidores de **carga, esfuerzo nominal, tiempo modelado y deformación visual no medida** sincronizados con la curva simulada.
- Gráficos compatibles con dispositivos de recursos limitados: calidad automática, alta y ahorro, control de pixel ratio, pausa al cambiar de ventana y respaldo 2D ante pérdida de contexto WebGL.

**Alcance:** los mecanismos son patrones esquemáticos tomados de literatura experimental; no existe un modelo de daño continuo calibrado, solución por elementos finitos ni diagnóstico de falla automática. La selección manual de un patrón altera únicamente la animación, no la resistencia obtenida de las fórmulas.

**Referencias de clasificación:** descripción de los seis patrones ASTM C39 publicada en Sika Concrete Handbook; Carpinteri et al. (2011), *ACI Structural Journal*, modos flexión/cortante en vigas sin estribos; FHWA/NCHRP Web-Only Document 78, mecanismos de corte-diagonal y adherencia.
