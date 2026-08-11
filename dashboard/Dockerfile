FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the Next.js app
RUN npm run build

# Create non-root user for security
RUN addgroup -S nextuser && adduser -S nextuser -G nextuser \
    && chown -R nextuser:nextuser /app
USER nextuser

EXPOSE 3000

CMD ["npm", "start"]
