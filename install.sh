#!/bin/bash

# Pterodactyl URL Downloader Plugin Installer
# Usage: sudo bash install.sh

# Variables
PANEL_DIR="/var/www/pterodactyl"
PLUGIN_NAME="url-downloader"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root."
  exit 1
fi

# Check if Pterodactyl directory exists
if [ ! -d "$PANEL_DIR" ]; then
  echo "Pterodactyl directory not found. Please update PANEL_DIR in the script."
  exit 1
fi

echo "Installing Pterodactyl URL Downloader Plugin..."

# Step 1: Copy frontend files
echo "Copying frontend files..."
FRONTEND_DIR="$PANEL_DIR/resources/scripts/components/server/files"
cp -r frontend/UrlDownloadModal.tsx "$FRONTEND_DIR/"
cp -r frontend/FileManagerContainer.tsx "$FRONTEND_DIR/"
if [ $? -ne 0 ]; then
  echo "Failed to copy frontend files."
  exit 1
fi

# Step 2: Copy backend files
echo "Copying backend files..."
BACKEND_DIR="$PANEL_DIR/app/Http/Controllers/Api/Client/Servers"
cp -r backend/FileDownloadController.php "$BACKEND_DIR/"
if [ $? -ne 0 ]; then
  echo "Failed to copy backend files."
  exit 1
fi

# Step 3: Add routes
echo "Adding routes..."
ROUTE_FILE="$PANEL_DIR/routes/api-client.php"
ROUTE_LINE="Route::post('/servers/{server}/files/validate-url', [FileDownloadController::class, 'validateUrl']);"
if ! grep -q "$ROUTE_LINE" "$ROUTE_FILE"; then
  echo -e "\n// URL Downloader Plugin Routes" >> "$ROUTE_FILE"
  echo "Route::post('/servers/{server}/files/validate-url', [FileDownloadController::class, 'validateUrl']);" >> "$ROUTE_FILE"
  echo "Route::post('/servers/{server}/files/download', [FileDownloadController::class, 'download']);" >> "$ROUTE_FILE"
  echo "Route::get('/servers/{server}/files/download/{job}/progress', [FileDownloadController::class, 'getProgress']);" >> "$ROUTE_FILE"
  echo "Route::delete('/servers/{server}/files/download/{job}', [FileDownloadController::class, 'cancelDownload']);" >> "$ROUTE_FILE"
fi

# Step 4: Set permissions
echo "Setting permissions..."
chown -R www-data:www-data "$PANEL_DIR"
chmod -R 755 "$PANEL_DIR"

# Step 5: Clear caches
echo "Clearing caches..."
cd "$PANEL_DIR" || exit
php artisan cache:clear
php artisan view:clear

# Step 6: Restart services
echo "Restarting services..."
systemctl restart pteroq
systemctl restart nginx

echo "Installation complete! Please refresh your browser to see the changes."
