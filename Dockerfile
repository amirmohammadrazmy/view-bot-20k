# Use an official Node.js runtime as a parent image
FROM node:18-slim

# Set the working directory in the container
WORKDIR /app

# Install system dependencies for Puppeteer and Tesseract, including Chromium
RUN apt-get update && apt-get install -y \
    chromium-browser \
    libxtst6 \
    libxss1 \
    libxrender1 \
    libxrandr2 \
    libxi6 \
    libxfixes3 \
    libxext6 \
    libxdamage1 \
    libxcursor1 \
    libxcomposite1 \
    libxcb1 \
    libx11-xcb1 \
    libx11-6 \
    libstdc++6 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libnss3 \
    libnspr4 \
    libgtk-3-0 \
    libglib2.0-0 \
    libgcc1 \
    libgbm1 \
    libfontconfig1 \
    libexpat1 \
    libdbus-1-3 \
    libcups2 \
    libcairo2 \
    libc6 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libasound2 \
    libappindicator3-1 \
    fonts-liberation \
    ca-certificates \
    wget \
    xdg-utils \
    tesseract-ocr \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install app dependencies.
RUN npm install --omit=dev

# Bundle app source
COPY . .

# The default command to run the app (will be overridden by railway.toml)
CMD [ "node", "main.js" ]