# Dataset de reservas para ML — predicción de cancelaciones

Dataset **anonimizado** de reservas de Rooms Madrid, pensado para entrenar un modelo que
anticipe qué reservas van a cancelarse / no presentarse.

## Regenerar

```bash
node ml/export_reservations_dataset.mjs            # → ml/dataset/
node ml/export_reservations_dataset.mjs --out DIR  # otra carpeta
```

Lee de Supabase (solo lectura) con `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` del `.env`
de la raíz. La carpeta `ml/dataset/` está en `.gitignore`: son datos de negocio, no se suben.

Ficheros generados:

| Fichero | Contenido |
|---|---|
| `reservations_dataset.csv` | Una fila por reserva, UTF-8 con BOM (abre bien en Excel), separador `,`, booleanos como `0/1`, nulos como vacío |
| `summary.md` | Porcentajes por estado, tasa de cancelación por sala/canal/mes/antelación… |
| `dataset_meta.json` | Fecha de exportación, nº de filas, lista de columnas, conteos |

## Privacidad

- De `customers` **solo** se leen `id`, `created_at` y `no_contact`. Nunca nombre, teléfono, email ni notas.
- `customer_id` se sustituye por `customer_key` (entero por orden de alta, no reversible sin la BD).
- Textos libres (`internal_notes`, `cancellation_reason`, mensajes de decoración) **no se exportan**:
  se reducen a un booleano `has_*` o a una categoría por palabras clave.
- `reservation_id` es el UUID de la reserva: opaco, sirve para cruzar con la BD si hace falta.

## Target y semántica de los estados

| `status` (BD) | Significado real en operación | `outcome` derivado |
|---|---|---|
| `completed`, `in_progress` | Servicio prestado (`in_progress` = recepción olvidó marcar completada) | `honored` |
| `confirmed` con `end_at` pasado | Prestada pero sin marcar (`honored_assumed = 1`) | `honored` |
| `confirmed` futura | Aún no ha ocurrido | `upcoming` |
| `cancelled` | **Cancelación anticipada O no-show** (el personal usa el mismo estado para ambos; el enum `no_show` no se usa nunca) | `cancelled` |
| `rejected` | Reserva web cuyo pago falló o no se completó en 60 min (abandono de checkout) | `rejected` |
| `pending` | Reserva web esperando pago (transitorio) | `pending` |

- **`target_cancelled`**: `1` si `outcome ∈ {cancelled, no_show}`, `0` si `honored`, vacío en el resto
  (`rejected`, `upcoming`, `pending` → excluir del entrenamiento).
- Para separar **no-show** de **cancelación anticipada** usa `cancellation_reason_category`
  (`no_show` vs `customer_cancelled`); ~29 % de las canceladas quedan como `unspecified` (recepción
  no escribió motivo). Es la información más valiosa para una plataforma anticipativa: el no-show
  es el que bloquea la sala sin aviso.
- `rejected` es otro fenómeno (abandono de pago online). Si quieres predecirlo, monta un target aparte
  solo sobre `created_via_web = 1`.

## ⚠️ Fuga de información (leakage)

Columnas que **solo se conocen después del desenlace**. Úsalas para análisis, nunca como feature:

| Columna | Por qué |
|---|---|
| `status`, `outcome`, `honored_assumed`, `target_cancelled` | Son el target |
| `cancellation_reason_category` | Se rellena al cancelar |
| `updated_at`, `hours_from_last_update_to_start` | Última modificación ≈ momento de la cancelación |

Columnas a usar **con cautela** (no son leakage claro, pero conviene saber qué miden):

| Columna | Observación |
|---|---|
| `deposit_paid`, `deposit_amount`, `paid_amount`, `paid_ratio`, `has_online_payment` | En prod solo se informan en reservas **web** (el pago ocurre al reservar, así que se conocen en `created_at`). Recepción nunca registra pagos → en reservas de mostrador valen 0 siempre. Son en la práctica un proxy de «reserva web pagada» (cancelan 8,3 % vs 18,4 %) |
| `created_via_web = 1` y `deposit_paid = 0` y `status = cancelled` (41 filas) | Son reservas web que nunca pagaron y recepción canceló a mano antes de existir la auto-cancelación; semánticamente son `rejected`. Considera excluirlas o reetiquetarlas |
| `has_internal_notes` | No se sabe cuándo se escribió la nota. Correlaciona con **menos** cancelaciones (12,9 % vs 19,5 %), así que no parece escribirse al cancelar, pero no hay garantía |

Recomendación: **split temporal** (entrena jun–ago 2026, valida sep 2026) en lugar de aleatorio.

## Diccionario de columnas

Hora local = `Europe/Madrid`. `dow` ISO: 1 = lunes … 7 = domingo.

### Identificación
| Columna | Tipo | Descripción |
|---|---|---|
| `reservation_id` | uuid | Id opaco de la reserva |
| `customer_key` | int | Cliente anonimizado (vacío = reserva sin cliente asociado) |

### Target
| Columna | Tipo | Descripción |
|---|---|---|
| `status` | enum | Estado crudo en BD |
| `outcome` | enum | `honored` / `cancelled` / `no_show` / `rejected` / `upcoming` / `pending` |
| `target_cancelled` | 0/1/∅ | Target binario recomendado |
| `honored_assumed` | 0/1 | `honored` inferido por fecha pasada sin marcar `completed` |

### Sala
| Columna | Tipo | Descripción |
|---|---|---|
| `room_name` | str | Nombre de la sala |
| `building` | enum | `bernabeu` / `ventas` / `america` |
| `rate_group` | str | Grupo de tarifa (proxy de gama de precio) |
| `room_capacity` | int | Capacidad base |
| `room_jacuzzi_option` | enum | `none` / `optional` / `always` |
| `room_has_tv`, `room_has_swing`, `room_allows_overnight` | 0/1 | Prestaciones |

### Tiempo
| Columna | Tipo | Descripción |
|---|---|---|
| `created_at` | ISO | Momento en que se creó la reserva (UTC) |
| `created_local_date`, `created_local_hour`, `created_dow` | | Descomposición local de `created_at` |
| `start_at`, `end_at` | ISO | Inicio / fin del servicio (UTC) |
| `start_local_date`, `start_local_hour`, `start_dow`, `start_month`, `start_year` | | Descomposición local de `start_at` |
| `start_is_weekend` | 0/1 | Sáb o dom |
| `start_is_fri_sat` | 0/1 | Vie o sáb (noches fuertes) |
| `duration_min` | int | Duración (720 = noche completa) |
| `lead_time_hours`, `lead_time_days` | float | Antelación `start_at − created_at`. **Negativa** = recepción dio de alta la reserva después de empezar (walk-in); esas casi nunca se cancelan |
| `is_overnight` | 0/1 | Noche completa |

### Canal y configuración
| Columna | Tipo | Descripción |
|---|---|---|
| `created_by_role` | enum | `public` (web) / `reception` / `admin` |
| `created_via_web` | 0/1 | `created_by_role = public` |
| `with_jacuzzi` | 0/1 | Jacuzzi contratado |
| `people`, `has_third_person` | int, 0/1 | Personas; >2 = suplemento |
| `manual_override` | 0/1 | Se saltó el buffer de limpieza |
| `cleaning_minutes` | int | Buffer de limpieza asignado |
| `customer_no_contact` | 0/1 | El cliente pidió no ser contactado |

### Importes (€)
| Columna | Descripción |
|---|---|
| `base_price` | Precio de la sala |
| `third_person_surcharge` | Suplemento 3ª persona |
| `dynamic_surcharge`, `has_dynamic_surcharge`, `dynamic_reason` | Recargo dinámico (`Alta Demanda V-S (+30%)`, `Precio manual (admin)`…) |
| `extras_total`, `discount_amount`, `total` | Totales |
| `deposit_amount`, `deposit_ratio`, `deposit_paid` | Depósito (solo informado en reservas web) |
| `paid_amount`, `paid_ratio` | Pagado (solo informado en reservas web) |
| `has_online_payment` | Pasó por TPV Redsys |
| `has_promo`, `promo_discount_type`, `promo_discount_value`, `promo_single_use` | Código promocional (por ahora ninguna reserva lo usa) |

### Extras
| Columna | Descripción |
|---|---|
| `n_extras_lines`, `extras_qty_total`, `extras_gift_count` | Líneas, unidades y regalos |
| `extras_decoration_qty`, `extras_drinks_qty`, `extras_hookah_qty`, `extras_accessories_qty`, `extras_services_qty` | Unidades por categoría |
| `extras_names` | Nombres de catálogo separados por `\|` (no es PII) |
| `has_bed_message`, `has_screen_message` | Mensajes de decoración (columnas no existen aún en prod → siempre 0) |
| `has_internal_notes` | Hay notas internas (ver «con cautela») |

### Histórico del cliente (point-in-time, sin fuga)
Calculado solo con reservas **creadas antes** de esta y cuyo desenlace ya era conocido en `created_at`.

| Columna | Descripción |
|---|---|
| `cust_is_new` | Primera reserva del cliente |
| `cust_prev_bookings` | Reservas anteriores |
| `cust_prev_honored`, `cust_prev_cancelled`, `cust_prev_no_show`, `cust_prev_rejected` | Desenlaces anteriores conocidos |
| `cust_prev_cancel_rate` | `(cancelled + no_show) / resueltas` (vacío si no hay resueltas) |
| `cust_days_since_first_seen` | Días desde el alta del cliente |
| `cust_days_since_prev_booking` | Días desde su reserva anterior |

> Limitación: recepción crea un cliente nuevo casi en cada reserva (5.336 clientes para 5.609 reservas),
> así que estas features solo están informadas en ~5 % de las filas. Los recurrentes identificados
> cancelan más (27,6 % vs 17,4 %), probablemente porque solo se reutiliza la ficha cuando el cliente
> ya dio problemas.

### Post-hoc (⚠️ solo análisis)
| Columna | Descripción |
|---|---|
| `updated_at` | Última modificación |
| `hours_from_last_update_to_start` | `start_at − updated_at`: para canceladas ≈ con cuánta antelación se canceló |
| `cancellation_reason_category` | `no_show`, `customer_cancelled`, `unspecified`, `rescheduled`, `unpaid`, `unreachable`, `duplicate`, `error_or_test`, `other`; en `rejected`: `auto_unpaid`, `payment_failed` |

## Caveats de los datos

- Datos desde el **27-may-2026** (arranque del sistema). Las 17 reservas de mayo son pruebas (16 canceladas): descártalas.
- Class balance: **17,9 %** positivos sobre 5.458 filas etiquetadas.
- `people`, `with_jacuzzi`, `is_overnight`, extras y promos tienen poca varianza (casi todo 2 personas, sin jacuzzi, sin extras).
- `dynamic_reason = "Precio manual (admin)"` (32 % de las filas) indica que admin fijó el precio a mano.

## Arranque rápido (Python)

```python
import pandas as pd
df = pd.read_csv("ml/dataset/reservations_dataset.csv")
df = df[df.target_cancelled.notna() & (df.start_local_date >= "2026-06-01")]

LEAK = ["status","outcome","honored_assumed","cancellation_reason_category","updated_at",
        "hours_from_last_update_to_start",                      # post-hoc
        "reservation_id","customer_key","created_at","start_at","end_at",
        "created_local_date","start_local_date","extras_names"] # ids / texto
X = pd.get_dummies(df.drop(columns=LEAK + ["target_cancelled"]), dummy_na=True)
y = df.target_cancelled.astype(int)

train = df.start_local_date < "2026-09-01"     # split temporal
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import roc_auc_score, average_precision_score
clf = HistGradientBoostingClassifier(class_weight="balanced").fit(X[train], y[train])
p = clf.predict_proba(X[~train])[:, 1]
print("AUC", roc_auc_score(y[~train], p), "AP", average_precision_score(y[~train], p))
```
