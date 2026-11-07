FROM node:20-alpine
WORKDIR /app
COPY services ./services
COPY data ./data
# Cac mock khong dung thu vien ngoai nao -> khong can npm install
ENV SERVICE=wms
CMD ["sh", "-c", "node services/$SERVICE.js"]
