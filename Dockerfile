# Use Bun for install (fast)
FROM oven/bun:1.1.22 as deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN bun install

# Use official Node image for building and running
FROM node:20-alpine as builder
WORKDIR /app

# Copy dependencies from Bun layer
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build with Node (not Bun)
RUN npm run build

# Final lightweight image
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app ./

# Expose port if needed
EXPOSE 5176

CMD ["npm", "run", "start"]



# FROM node:20-alpine AS development-dependencies-env
# COPY . /app
# WORKDIR /app
# RUN npm ci

# FROM node:20-alpine AS production-dependencies-env
# COPY ./package.json package-lock.json /app/
# WORKDIR /app
# RUN npm ci --omit=dev

# FROM node:20-alpine AS build-env
# COPY . /app/
# COPY --from=development-dependencies-env /app/node_modules /app/node_modules
# WORKDIR /app
# RUN npm run build

# FROM node:20-alpine
# COPY ./package.json package-lock.json /app/
# COPY --from=production-dependencies-env /app/node_modules /app/node_modules
# COPY --from=build-env /app/build /app/build
# WORKDIR /app
# CMD ["npm", "run", "start"]