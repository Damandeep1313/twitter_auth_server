# Use Node.js 18 LTS Alpine (lightweight and stable)
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the source code
COPY . .

# Expose app port
EXPOSE 3000

# Start the app
CMD ["node", "secure-auth.js"]
