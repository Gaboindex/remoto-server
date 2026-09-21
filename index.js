const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Servir archivos estáticos (el panel web en public/)
app.use(express.static(path.join(__dirname, 'public')));

// Almacén de dispositivos objetivo: { pin: { phoneWs, webWs, width, height } }
const objetivos = {};

function generarPIN() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

wss.on('connection', (ws) => {
  let pinAsignado = null;
  let tipoCliente = null; // 'CELULAR' o 'WEB'

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // 1. EL CELULAR SOLICITA UN PIN Y REGISTRA SU RESOLUCIÓN
      if (data.type === 'SOLICITAR_PIN_OBJETIVO') {
        tipoCliente = 'CELULAR';
        pinAsignado = generarPIN();
        
        objetivos[pinAsignado] = {
          phoneWs: ws,
          webWs: null, // Se asignará cuando la PC se conecte
          width: data.width || 1080,
          height: data.height || 2400
        };

        ws.send(JSON.stringify({
          type: 'PIN_ASIGNADO',
          pin: pinAsignado
        }));
        console.log(`[CELULAR CONECTADO] PIN: ${pinAsignado} | Resolución: ${data.width}x${data.height}`);
      }

      // 2. LA WEB O CONTROLADOR SE CONECTA USANDO EL PIN
      else if (data.type === 'CONECTAR_DESDE_WEB') {
        tipoCliente = 'WEB';
        pinAsignado = data.pin;
        const objetivo = objetivos[pinAsignado];

        if (objetivo) {
          objetivo.webWs = ws; // Guardamos la conexión de la PC
          ws.send(JSON.stringify({
            type: 'CONEXION_EXITOSA',
            width: objetivo.width,
            height: objetivo.height
          }));
          console.log(`[PANEL WEB CONECTADO] Vinculado al PIN: ${pinAsignado}`);
        } else {
          ws.send(JSON.stringify({
            type: 'ERROR',
            mensaje: 'PIN no encontrado o dispositivo desconectado'
          }));
        }
      }

      // 3. REENVIAR ACCIONES TÁCTILES (DEL WEB AL CELULAR)
      else if (data.type === 'ENVIAR_TOQUE' || data.type === 'ENVIAR_GESTO' || data.type === 'PING') {
        const objetivo = objetivos[data.pin];
        if (objetivo && objetivo.phoneWs && objetivo.phoneWs.readyState === WebSocket.OPEN) {
          objetivo.phoneWs.send(JSON.stringify(data));
        }
      }

      // 4. REENVIAR STREAM DE VIDEO (DEL CELULAR AL WEB) [¡ESTO FALTABA!]
      else if (data.type === 'STREAM_FRAME') {
        const objetivo = objetivos[data.pin];
        if (objetivo && objetivo.webWs && objetivo.webWs.readyState === WebSocket.OPEN) {
          objetivo.webWs.send(JSON.stringify({
            type: 'STREAM_FRAME',
            frame: data.frame
          }));
        }
      }
    } catch (err) {
      console.error("Error al procesar mensaje:", err);
    }
  });

  ws.on('close', () => {
    if (pinAsignado && objetivos[pinAsignado]) {
      if (tipoCliente === 'CELULAR') {
        console.log(`[CELULAR DESCONECTADO] PIN ${pinAsignado} liberado.`);
        delete objetivos[pinAsignado];
      } else if (tipoCliente === 'WEB') {
        console.log(`[PANEL WEB DESCONECTADO] Del PIN ${pinAsignado}.`);
        if (objetivos[pinAsignado]) {
          objetivos[pinAsignado].webWs = null;
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
});
