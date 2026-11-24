# Mi Auto Backend

API inicial de Mi Auto construida con NestJS, TypeScript y MongoDB/Mongoose.

## Requisitos

- Node.js 22 o superior recomendado.
- MongoDB local o una instancia administrada.

## Inicio local

```bash
cp .env.example .env
npm install
docker compose up -d mongodb
npm run start:dev
```

La API escucha en `http://localhost:3000`; MongoDB debe estar disponible en la URI configurada en `MONGODB_URI` para que los endpoints de datos funcionen.

## Endpoints iniciales

- `GET /api/health`: estado del servicio y conexión a MongoDB.
- `GET /api/vehicles`: lista vehículos del usuario local de desarrollo.
- `PUT /api/vehicles/primary`: crea o actualiza el vehículo principal.
- `GET /api/trips`: historial del usuario (máximo 100 registros recientes).
- `POST /api/trips`: registra una ruta, calcula combustible, peajes y gasto por persona.
- `PATCH /api/trips/:id/route`: recalcula la ruta de un delivery activo con nuevas paradas.
- `PATCH /api/trips/:id/complete`: finaliza un delivery.
- `GET /api/routes/places?q=...`: busca sugerencias de origen/destino en Quintero para seleccionar antes de calcular.
- `POST /api/routes/plan`: geocodifica ubicaciones, ordena paradas y devuelve alternativas.
- `GET /api/pricing/delivery`: consulta los tramos y tarifa actual de delivery.
- `PUT /api/pricing/delivery`: guarda los tramos horarios de delivery del usuario.
- `GET /api/auth/csrf`: entrega token CSRF para operaciones de sesión.
- `POST /api/auth/google`: verifica la credencial de Google, crea/actualiza usuario y abre sesión.
- `POST /api/auth/refresh`: rota el refresh token HttpOnly y entrega un JWT de acceso nuevo.
- `POST /api/auth/logout`: revoca la sesión actual.
- `GET /api/auth/me`: devuelve el usuario autenticado.

Los endpoints de vehículos, historial, rutas y tarifas requieren `Authorization: Bearer <accessToken>`. El JWT de acceso es breve. El refresh token es opaco, se almacena como hash en MongoDB y viaja en cookie HttpOnly. Google Sign-In requiere configurar `GOOGLE_CLIENT_ID` en `.env`; no se aceptan cuentas con email no verificado.

Ejemplo de vehículo:

```json
{
  "name": "Auto principal",
  "make": "",
  "model": "",
  "fuelType": "gasoline",
  "efficiencyKmPerLiter": 12.2,
  "fuelPriceClp": 1350
}
```

Ejemplo de ruta (distancia en metros y dinero en CLP):

```json
{
  "type": "shared",
  "origin": "Plaza de Quintero",
  "destination": "Loncura",
  "distanceMeters": 8400,
  "durationSeconds": 1140,
  "tollsClp": 0,
  "otherCostsClp": 0
}
```

## Variables de entorno

- `NODE_ENV`: entorno de ejecución.
- `PORT`: puerto HTTP (3000 por defecto).
- `FRONTEND_ORIGIN`: orígenes frontend permitidos, separados por coma.
- `MONGODB_URI`: cadena de conexión MongoDB.
- `GOOGLE_CLIENT_ID`: ID OAuth de cliente web configurado en Google Cloud.
- `MAPBOX_ACCESS_TOKEN`: token de servidor con permisos para búsqueda, directions y optimization.
- `JWT_ACCESS_SECRET`: secreto fuerte generado localmente para firmar JWT de acceso.
- `JWT_ACCESS_TTL`: duración breve del JWT de acceso (10 minutos por defecto).
- `REFRESH_TOKEN_TTL_DAYS`: duración máxima del refresh token rotativo (30 días por defecto).

No guardar el archivo `.env` en Git. `.env.example` contiene únicamente valores locales de ejemplo.

## Estado

Base NestJS con autenticación Google, JWT de acceso en memoria, refresh token opaco rotativo en cookie HttpOnly y sesiones revocables por hash en MongoDB. Vehículos, rutas, tarifas y planificación exigen JWT. `npm test -- --runInBand` ejecuta las pruebas unitarias.

La selección planificada de dependencias por etapa está en [PLAN-LIBRERIAS.md](./PLAN-LIBRERIAS.md).
