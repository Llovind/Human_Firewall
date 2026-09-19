FROM node:22-alpine

WORKDIR /app

# Create the runtime identity before copying source so we only change
# ownership for Next's writable build output, not the entire node_modules tree.
RUN addgroup -S nextuser && adduser -S nextuser -G nextuser

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the Next.js app
RUN npm run build

# Next may write incremental cache files at runtime.
RUN chown -R nextuser:nextuser /app/.next
USER nextuser

EXPOSE 3000

CMD ["npm", "start"]
