# Mi Auto Backend — plan de librerías

Este documento separa las dependencias del backend de las del frontend y propone instalarlas según se necesiten. Las librerías marcadas como **ya declaradas** están en `package.json`; la instalación de dependencias aún debe completarse.

## 1. Base declarada

| Librería | Uso | Prioridad |
| --- | --- | --- |
| `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` | Servidor y módulos NestJS con adaptador Express | Necesaria |
| `@nestjs/config` | Cargar y validar configuración por entorno | Necesaria |
| `@nestjs/mongoose` + `mongoose` | Conexión MongoDB y esquemas | Necesaria |
| `class-validator` + `class-transformer` | Validar y transformar DTOs de entrada | Necesaria |
| `reflect-metadata` + `rxjs` | Dependencias internas requeridas por NestJS | Necesarias |

## 2. Herramientas de desarrollo declaradas

| Librería | Uso |
| --- | --- |
| `@nestjs/cli`, `@nestjs/schematics` | Generar módulos, servicios y controladores NestJS |
| `typescript`, `ts-node`, `tsconfig-paths`, `ts-loader` | Compilación y ejecución TypeScript |
| `jest`, `ts-jest`, `@nestjs/testing`, `supertest` | Pruebas unitarias y de API HTTP |
| `eslint`, `@eslint/js`, `@eslint/eslintrc`, `globals` | Reglas de calidad y lint |
| `prettier` | Formato automático |
| `@types/node`, `@types/express`, `@types/jest`, `@types/supertest` | Tipos TypeScript |
| `source-map-support` | Trazas legibles durante ejecución |

La plantilla tiene varias herramientas de prueba que son útiles al desarrollar, pero pueden agregarse después de que la primera API compile. No incluir una librería solo para seguir una plantilla si el proyecto no la usa.

## 3. Agregar en la etapa correspondiente

### Seguridad de API

- `helmet`: cabeceras HTTP de seguridad.
- `@nestjs/throttler`: límites de solicitudes para API y endpoints de autenticación.
- `@nestjs/terminus`: health checks de la aplicación y MongoDB cuando se despliegue.

### Autenticación Google + JWT

Decisión acordada: Google verifica la identidad al entrar; después Mi Auto usa su propio JWT de acceso de vida corta y un refresh token opaco, rotativo y revocable en cookie `HttpOnly`, `Secure` en producción y `SameSite=Lax`. El JWT de acceso vive solo en memoria del frontend, nunca en `localStorage`. MongoDB guarda el hash del refresh token en una colección `sessions`, junto con usuario, vencimiento, revocación y datos mínimos del dispositivo.

- `google-auth-library`: verificar ID tokens de Google (audiencia, firma y expiración).
- `@nestjs/jwt`: emitir/verificar JWT de acceso de Mi Auto.
- `cookie-parser`: leer la cookie HttpOnly de refresh.
- `csrf-csrf`: defensa CSRF para endpoints que usan la cookie; además validar origen.
- Módulo `sessions` con Mongoose: persistir hashes de refresh tokens, no tokens en claro.

La renovación rota el refresh token: el anterior queda invalidado y se guarda el hash del nuevo. Logout revoca la sesión y limpia la cookie. No se agrega Passport en esta arquitectura.

### Mapbox

- Backend: usar `fetch` integrado en Node.js para llamar Directions, Optimization y Geocoding, detrás de un proveedor NestJS propio. No hace falta agregar `axios` inicialmente.
- Frontend: `mapbox-gl` para mapa interactivo. Si se prefiere integración declarativa con React, evaluar `react-map-gl` en esa etapa.
- Mantener el token secreto de servidor fuera del frontend. El token público de mapas del navegador debe limitarse por origen y permisos.

### Documentación API

- `@nestjs/swagger`: documentación OpenAPI interactiva para desarrollo e integración frontend/backend.

## 4. No agregar todavía

- Redis y BullMQ: solo cuando haya trabajos en segundo plano, colas o necesidad de compartir rate limits entre varias instancias.
- Socket.IO/WebSockets: solo si el usuario necesita actualizaciones en vivo de deliveries compartidos o seguimiento por terceros.
- `axios`: Node.js moderno ya incluye `fetch`.
- ORM adicional: Mongoose ya cubre la persistencia MongoDB seleccionada.
- SDK de navegación nativa: la primera versión será web responsive; el navegador puede abrir navegación externa cuando el conductor lo solicite.

## 5. Comandos sugeridos por etapa

Base ya declarada:

```bash
npm install
```

Seguridad y diagnóstico, cuando se implementen:

```bash
npm install helmet @nestjs/throttler @nestjs/terminus
```

Google + sesión JWT acordada:

```bash
npm install google-auth-library @nestjs/jwt cookie-parser csrf-csrf
npm install -D @types/cookie-parser
```

OpenAPI:

```bash
npm install @nestjs/swagger
```

Mapa web se instala en el frontend, no aquí:

```bash
npm install mapbox-gl
```

## 6. Orden recomendado

1. Instalar y compilar las dependencias base existentes.
2. Completar módulos MongoDB: usuarios, vehículos, viajes y deliveries.
3. Añadir Helmet, throttling, health checks y OpenAPI.
4. Implementar Google + JWT de acceso en memoria + refresh opaco rotativo en cookie + sesiones hash en MongoDB.
5. Añadir el proveedor backend Mapbox mediante `fetch`.
6. Instalar Mapbox GL JS en el frontend al reemplazar el mapa de muestra.
7. Añadir Redis, colas o tiempo real únicamente cuando haya un requisito que lo justifique.

Las versiones deben resolverse e instalarse en el momento de cada etapa; no fijar números de versión de memoria. Mantener `package-lock.json` en el repositorio para builds repetibles.
