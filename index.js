const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

const dispositivos = new Map();

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

      // 1. SOLICITAR PIN
      if (data.type === 'SOLICITAR_PIN_OBJETIVO') {
        miPinAsignado = generarPINUnico();
        dispositivos.set(miPinAsignado, ws);
        
        ws.send(JSON.stringify({
          type: 'PIN_ASIGNADO',
          pin: miPinAsignado
        }));
      }

      // 2. RETRANSMITIR ACCIONES (TOQUES, PINGS Y GESTOS)
      if (data.type === 'ENVIAR_TOQUE' || data.type === 'PING' || data.type === 'ENVIAR_GESTO') {
        const objetivoWs = dispositivos.get(data.pin);

        if (objetivoWs && objetivoWs.readyState === WebSocket.OPEN) {
          objetivoWs.send(JSON.stringify(data));
        }
      }
    } catch (e) {
      console.error('Error:', e);
    }
  });

  ws.on('close', () => {
    if (miPinAsignado) {
      dispositivos.delete(miPinAsignado);
    }
  });
});
