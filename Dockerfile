# Multi-service Dockerfile for ResearchHub OS Microservices
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Parameterize target service (gateway, auth, project, experiment, dataset, document, publication, equipment, activity, notification, lab)
ARG SERVICE_NAME=gateway
ENV SERVICE_NAME=${SERVICE_NAME}

# Copy package descriptors and source trees
COPY package*.json ./
COPY shared ./shared
COPY services/${SERVICE_NAME} ./services/${SERVICE_NAME}

# Install production dependencies for the target service and shared library
RUN npm ci --omit=dev --workspace=shared --workspace=services/${SERVICE_NAME}

# Run under unprivileged node user
RUN chown -R node:node /app
USER node

EXPOSE 8080

CMD ["sh", "-c", "node services/${SERVICE_NAME}/src/index.js"]
