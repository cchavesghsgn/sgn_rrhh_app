
#!/bin/bash

echo "=== PRUEBA SIMPLE DE CARGA DE IMAGEN ==="

BASE_URL="http://localhost:3000"
IMAGE_PATH="/home/ubuntu/Uploads/logo completo color.png"

echo "📤 Probando carga directa de imagen..."
echo "URL: $BASE_URL/api/test-upload"
echo "Imagen: $IMAGE_PATH"
echo

# Probar carga sin autenticación primero
curl -v \
  -X POST \
  -F "profileImage=@$IMAGE_PATH" \
  -F "testField=test-value" \
  "$BASE_URL/api/test-upload" 2>&1

echo
echo "=== FIN DE LA PRUEBA ==="
