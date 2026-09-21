const WebSocket = require('ws');

// Render asigna el puerto mediante la variable de entorno PORT
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// Mapa para guardar los dispositivos objetivos conectados: PIN -> WebSocket
const dispositivos = new Map();

// Genera un PIN único de 4 dígitos que no esté en uso
function generarPINUnico() {
  let pin;
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
  } while (dispositivos.has(pin));
  return pin;
}

wss.on('connection', (ws) => {
  let miPinAsignado = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // 1. EL CELULAR OBJETIVO SOLICITA UN PIN A RENDER
      if (data.type === 'SOLICITAR_PIN_OBJETIVO') {
        miPinAsignado = generarPINUnico();
        dispositivos.set(miPinAsignado, ws);
        
        ws.send(JSON.stringify({
          type: 'PIN_ASIGNADO',
          pin: miPinAsignado
        }));
        console.log(`PIN ${miPinAsignado} asignado por Render.`);
      }

      // 2. EL CONTROLADOR ENVÍA ACCIONES (PING O TOQUES) USANDO ESE PIN
      if (data.type === 'ENVIAR_TOQUE' || data.type === 'PING') {
        const objetivoWs = dispositivos.get(data.pin);

        if (objetivoWs && objetivoWs.readyState === WebSocket.OPEN) {
          objetivoWs.send(JSON.stringify(data));
          console.log(`Orden ${data.action || data.type} retransmitida al PIN ${data.pin}`);
        } else {
          ws.send(JSON.stringify({
            type: 'ERROR',
            message: 'El dispositivo con este PIN no está conectado.'
          }));
        }
      }
    } catch (e) {
      console.error('Error procesando mensaje:', e);
    }
  });

  // Si se desconecta el celular objetivo, liberamos el PIN
  ws.on('close', () => {
    if (miPinAsignado) {
      dispositivos.delete(miPinAsignado);
      console.log(`PIN ${miPinAsignado} liberado.`);
    }
  });
});

console.log(`Servidor WebSocket activo corriendo en el puerto ${PORT}`);
