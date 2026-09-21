const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Servir archivos estáticos (el panel web en public/)
app.use(express.static(path.join(__dirname, 'public')));

// Almacén de dispositivos objetivo: { pin: { ws, width, height } }
const objetivos = {};

function generarPIN() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

wss.on('connection', (ws) => {
  let pinAsignado = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // 1. EL CELULAR SOLICITA UN PIN Y REGISTRA SU RESOLUCIÓN
      if (data.type === 'SOLICITAR_PIN_OBJETIVO') {
        pinAsignado = generarPIN();
        objetivos[pinAsignado] = {
          ws: ws,
          width: data.width || 1080,
          height: data.height || 2400
        };

        ws.send(JSON.stringify({
          type: 'PIN_ASIGNADO',
          pin: pinAsignado
        }));
        console.log(`[CELULAR CONECTADO] PIN: ${pinAsignado} | Resolución: ${data.width}x${data.height}`);
      }

      // 2. LA WEB O CONTROLADOR CONSULTA LAS DIMENSIONES DEL CELULAR POR PIN
      else if (data.type === 'CONECTAR_DESDE_WEB') {
        const objetivo = objetivos[data.pin];
        if (objetivo) {
          ws.send(JSON.stringify({
            type: 'CONEXION_EXITOSA',
            width: objetivo.width,
            height: objetivo.height
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'ERROR',
            mensaje: 'PIN no encontrado o dispositivo desconectado'
          }));
        }
      }

      // 3. REENVIAR ACCIONES (TOQUE O GESTO) AL CELULAR
      else if (data.type === 'ENVIAR_TOQUE' || data.type === 'ENVIAR_GESTO' || data.type === 'PING') {
        const objetivo = objetivos[data.pin];
        if (objetivo && objetivo.ws.readyState === WebSocket.OPEN) {
          objetivo.ws.send(JSON.stringify(data));
        }
      }
    } catch (err) {
      console.error("Error al procesar mensaje:", err);
    }
  });

  ws.on('close', () => {
    if (pinAsignado && objetivos[pinAsignado]) {
      delete objetivos[pinAsignado];
      console.log(`[CELULAR DESCONECTADO] PIN ${pinAsignado} liberado.`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
});
