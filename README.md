# GateNova

Sistema web de demostración para administrar el acceso vehicular del instituto.

## Tecnologías
- Frontend: React + Vite
- Backend: Python + FastAPI + SQLAlchemy
- Base de datos: PostgreSQL (se administra con pgAdmin; pgAdmin es la herramienta de administración, no el motor de base de datos)

## Módulos incluidos
- Resumen: métricas consultadas desde la API.
- Usuarios: alta, listado y eliminación.
- Vehículos: alta, listado y eliminación.
- Tarjetas RFID: alta, listado y eliminación.
- Puntos de acceso: alta, listado y eliminación.
- Historial: consulta de eventos registrados.
- Registrar evento: permite registrar manualmente un evento de acceso para probar el historial.

> Este proyecto es una base funcional para desarrollo local. El panel valida las credenciales de administradores, pero antes de usarlo en producción se necesita proteger también todos los endpoints de la API, además de agregar auditoría y pruebas con el hardware. Los datos de acceso se registran manualmente; todavía no se conecta a un lector RFID ni controla físicamente una pluma.

## 1. Crear la base de datos en pgAdmin
1. Abre pgAdmin y conéctate a tu servidor PostgreSQL.
2. Crea una base de datos llamada `gatenova`.
3. El backend crea las tablas automáticamente al iniciar.

## 2. Configurar y ejecutar el backend
Requisitos: Python 3.10 o superior y PostgreSQL instalado/activo.

En una terminal, entra en la carpeta `backend`:

```bash
python -m venv .venv
```

Windows:
```powershell
.venv\Scripts\Activate.ps1
```

Linux:
```bash
source .venv/bin/activate
```

Instala dependencias:
```bash
pip install -r requirements.txt
```

Copia `.env.example` como `.env` y modifica `DATABASE_URL` con los datos de tu PostgreSQL.

Ejemplo para PostgreSQL local:
```env
DATABASE_URL=postgresql+psycopg://postgres:TU_CONTRASENA@localhost:5432/gatenova
```

Inicia la API:
```bash
uvicorn app.main:app --reload
```

Documentación interactiva: http://127.0.0.1:8000/docs

## 3. Ejecutar el frontend
Abre otra terminal, entra en `frontend` e instala Node.js si aún no lo tienes.

```bash
npm install
npm run dev
```

Abre la dirección que indique Vite, normalmente http://localhost:5173.

El frontend usa `http://127.0.0.1:8000` como URL de API. Puedes cambiarla en `frontend/.env` si es necesario.

## Notas sobre el modelo
- `users.institutional_code` identifica al usuario dentro del instituto.
- `card.user_id` relaciona una tarjeta con su usuario. Se conserva el historial de tarjetas, incluso si se desactivan.
- `vehicle.user_id` relaciona un vehículo con su responsable.
- `access_logs` registra el evento, resultado, tarjeta, vehículo y punto de acceso.
- Los campos `card_id` y `vehicle_id` del historial admiten valores nulos para registrar intentos donde no se pudo identificar una tarjeta o vehículo.
- El estado “vehículos dentro” se calcula a partir de eventos autorizados de entrada y salida. En esta versión es una estimación del historial, no una detección física.

## Datos de demostración
Al iniciar por primera vez se crean dos puntos de acceso de ejemplo si la tabla está vacía. No se generan usuarios, tarjetas ni vehículos ficticios.


## Ajuste para el esquema PostgreSQL existente

Esta versión utiliza las tablas plurales ya presentes en tu base de datos:

- `users`
- `cards`
- `vehicles`
- `access_points`
- `access_logs`

Las tablas antiguas `card` y `vehicle` (singulares) no son utilizadas por la aplicación.

### Antes de iniciar FastAPI

En pgAdmin, selecciona la base de datos `gatenova` y abre Query Tool. Primero ejecuta `database/add_admin_role.sql` y confirma que terminó correctamente; después ejecuta una sola vez `database/migrate_gatenova.sql`. Se deben ejecutar por separado para que PostgreSQL confirme el nuevo valor del enum antes de que la segunda migración lo use. La migración principal elimina `users.card_user`, que apuntaba a la tabla antigua `card`, y agrega `users.username` y `users.password`. La contraseña se guarda como hash bcrypt; las cuentas sin acceso mantienen ambos campos en `NULL`. La asignación de tarjetas se realiza desde `cards.user_id`.

La API adapta los nombres de la interfaz a las columnas reales:
- `institutional_code` de la API corresponde a `users.institutional_id` (BIGINT).
- `role` de la API corresponde a `users.rol` (tipo enum PostgreSQL `rol_user`).
- El listado de roles se obtiene directamente de los valores definidos en `rol_user`.
- No se utiliza una columna `active` en `users`, porque no existe en el esquema proporcionado.

Después de ejecutar la migración, reinicia FastAPI. No elimines ni recrees la base de datos.

### Configurar el primer administrador

La migración agrega `admin` al enum `rol_user`. El login solo acepta ese rol. En pgAdmin, identifica una fila administrativa:

```sql
SELECT user_id, name, last_name, institutional_id
FROM public.users
WHERE rol = 'admin';
```

Genera un hash bcrypt en la terminal:

```bash
python -c "import bcrypt; print(bcrypt.hashpw(input('Nueva contraseña: ').encode('utf-8'), bcrypt.gensalt()).decode('ascii'))"
```

Luego establece el nombre de usuario y pega el hash generado en Query Tool:

```sql
UPDATE public.users
SET username = 'Admin', password = '<hash_bcrypt_generado>'
WHERE user_id = <user_id_administrativo>
  AND rol = 'admin';
```

No escribas la contraseña directamente en la columna: debe ser el hash generado. Solo los usuarios con rol `admin` pueden tener credenciales; puedes administrarlas desde el formulario de usuarios.
