# AbiPago - Monorepo

Monorepo del proyecto AbiPago utilizando pnpm workspaces.

## Estructura del Proyecto

```
htm-abipago/
├── apps/
│   └── frontend/          # Aplicación Expo/React Native
├── packages/
│   └── contracts/         # Smart Contracts con Foundry
└── stitch/               # Prototipos HTML
```

## Requisitos Previos

- Node.js >= 18
- pnpm >= 10.0.0
- Foundry (para smart contracts)

## Instalación

```bash
# Instalar pnpm si no lo tienes
npm install -g pnpm@10.0.0

# Instalar dependencias de todos los workspaces
pnpm install

# Instalar dependencias de Foundry (contratos)
cd packages/contracts
forge install
cd ../..
```

## Comandos Disponibles

### Frontend
```bash
# Iniciar aplicación móvil
pnpm mobile
# o
pnpm dev
```

### Contratos
```bash
# Compilar contratos
pnpm contracts:build

# Ejecutar tests
pnpm contracts:test

# Exportar ABIs
pnpm contracts:export
```

### General
```bash
# Ejecutar linter en todos los paquetes
pnpm lint

# Agregar dependencia a un workspace específico
pnpm --filter @abipago/frontend add <package>
pnpm --filter @abipago/contracts add <package>
```

## Configuración de Git

El proyecto incluye:
- `.gitignore` principal para todo el monorepo
- `.gitignore` específicos en cada paquete cuando es necesario
- `.npmrc` con configuraciones de pnpm

### Archivos Ignorados

- **Foundry**: `lib/`, `cache/`, `out/` en packages/contracts (deben instalarse con `forge install`)

## Desarrollo

1. Clona el repositorio
2. Ejecuta `pnpm install` en la raíz para instalar dependencias de Node.js
3. Ejecuta `cd packages/contracts && forge install` para instalar dependencias de Foundry
4. Navega al workspace que necesites trabajar
5# Desarrollo

1. Clona el repositorio
2. Ejecuta `pnpm install` en la raíz
3. Navega al workspace que necesites trabajar
4. Los cambios en paquetes compartidos se reflejan automáticamente

## Workspaces

El monorepo está configurado con los siguientes workspaces:
- `apps/*` - Aplicaciones del proyecto
- `packages/*` - Paquetes compartidos y contratos

## Troubleshooting
 de Node.js:
```bash
# Limpiar todo y reinstalar
pnpm store prune
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

Si tienes problemas con las dependencias de Foundry:
```bash
# Reinstalar dependencias de Foundry
cd packages/contracts
rm -rf lib
forgenpm-lock.yaml
pnpm install
```
